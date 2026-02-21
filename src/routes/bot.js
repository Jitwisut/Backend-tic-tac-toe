const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { isValidMove, makeMove, countMoves } = require('../services/gameLogic');
const { findBestMove, checkGameOver } = require('../services/bot');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route   POST /api/bot/create
 * @desc    Create a new bot game
 * @access  Private
 */
router.post('/create', authenticate, async (req, res) => {
    try {
        const { goFirst } = req.body;

        // Player goes first by default
        let board = '---------';
        let currentTurn = 'player';
        const playerSymbol = goFirst === false ? 'O' : 'X';
        const botSymbol = playerSymbol === 'X' ? 'O' : 'X';

        // Build moves data for initial creation
        let initialMoves = undefined;

        // If bot goes first, make bot's move
        if (goFirst === false) {
            const botMove = findBestMove(board, botSymbol, playerSymbol);
            board = makeMove(board, botMove, botSymbol);
            currentTurn = 'player';

            // Record bot's first move in the create call below
            initialMoves = {
                create: {
                    player: 'bot',
                    position: botMove,
                    symbol: botSymbol,
                    moveOrder: 1
                }
            };
        }

        // Create bot game (single creation)
        const game = await prisma.botGame.create({
            data: {
                userId: req.user.id,
                board: board,
                playerSymbol: playerSymbol,
                currentTurn: currentTurn,
                ...(initialMoves && { moves: initialMoves })
            },
            include: {
                moves: {
                    orderBy: { moveOrder: 'asc' }
                }
            }
        });

        res.status(201).json({
            success: true,
            data: {
                game: {
                    id: game.id,
                    board: game.board,
                    playerSymbol: game.playerSymbol,
                    botSymbol: botSymbol,
                    currentTurn: game.currentTurn,
                    status: game.status,
                    version: game.version,
                    moves: game.moves
                }
            }
        });
    } catch (error) {
        console.error('Create bot game error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create bot game'
        });
    }
});

/**
 * @route   POST /api/bot/:gameId/move
 * @desc    Make a move in bot game (player moves, then bot responds)
 * @access  Private
 */
router.post(
    '/:gameId/move',
    authenticate,
    [
        param('gameId').isUUID().withMessage('Invalid game ID'),
        body('position')
            .isInt({ min: 0, max: 8 })
            .withMessage('Position must be between 0 and 8'),
        body('version')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Invalid version number')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array().map(e => e.msg)
                });
            }

            const { gameId } = req.params;
            const { position } = req.body;
            const clientVersion = req.body.version;

            // Use transaction for race condition prevention
            const result = await prisma.$transaction(async (tx) => {
                const game = await tx.botGame.findUnique({
                    where: { id: gameId },
                    include: { moves: true }
                });

                if (!game) {
                    throw new Error('GAME_NOT_FOUND');
                }

                if (game.userId !== req.user.id) {
                    throw new Error('NOT_YOUR_GAME');
                }

                if (game.status === 'finished') {
                    throw new Error('GAME_FINISHED');
                }

                if (game.currentTurn !== 'player') {
                    throw new Error('NOT_YOUR_TURN');
                }

                // Check version for optimistic locking
                if (clientVersion !== undefined && game.version !== clientVersion) {
                    throw new Error('VERSION_CONFLICT');
                }

                // Validate player's move
                if (!isValidMove(game.board, position)) {
                    throw new Error('INVALID_MOVE');
                }

                const playerSymbol = game.playerSymbol;
                const botSymbol = playerSymbol === 'X' ? 'O' : 'X';
                const currentMoveOrder = game.moves.length;

                // Make player's move
                let newBoard = makeMove(game.board, position, playerSymbol);

                // Record player's move
                await tx.botMove.create({
                    data: {
                        gameId: gameId,
                        player: 'player',
                        position: position,
                        symbol: playerSymbol,
                        moveOrder: currentMoveOrder + 1
                    }
                });

                // Check if game is over after player's move
                let gameOver = checkGameOver(newBoard);
                let botMove = null;

                if (!gameOver.isOver) {
                    // Bot's turn
                    botMove = findBestMove(newBoard, botSymbol, playerSymbol);
                    newBoard = makeMove(newBoard, botMove, botSymbol);

                    // Record bot's move
                    await tx.botMove.create({
                        data: {
                            gameId: gameId,
                            player: 'bot',
                            position: botMove,
                            symbol: botSymbol,
                            moveOrder: currentMoveOrder + 2
                        }
                    });

                    // Check if game is over after bot's move
                    gameOver = checkGameOver(newBoard);
                }

                // Determine winner
                let winner = null;
                if (gameOver.winner === playerSymbol) {
                    winner = 'player';
                } else if (gameOver.winner === botSymbol) {
                    winner = 'bot';
                }

                // Update game state
                const updatedGame = await tx.botGame.update({
                    where: { id: gameId },
                    data: {
                        board: newBoard,
                        currentTurn: gameOver.isOver ? null : 'player',
                        status: gameOver.isOver ? 'finished' : 'in-progress',
                        winner: winner,
                        version: game.version + 1
                    },
                    include: {
                        moves: {
                            orderBy: { moveOrder: 'asc' }
                        }
                    }
                });

                return {
                    game: updatedGame,
                    botMove,
                    playerSymbol,
                    botSymbol
                };
            });

            res.json({
                success: true,
                data: {
                    game: {
                        id: result.game.id,
                        board: result.game.board,
                        playerSymbol: result.playerSymbol,
                        botSymbol: result.botSymbol,
                        currentTurn: result.game.currentTurn,
                        status: result.game.status,
                        winner: result.game.winner,
                        version: result.game.version,
                        moves: result.game.moves
                    },
                    botMove: result.botMove
                }
            });
        } catch (error) {
            console.error('Bot move error:', error);

            const errorMessages = {
                'GAME_NOT_FOUND': { status: 404, message: 'Game not found' },
                'NOT_YOUR_GAME': { status: 403, message: 'This is not your game' },
                'GAME_FINISHED': { status: 400, message: 'Game is already finished' },
                'NOT_YOUR_TURN': { status: 400, message: 'It is not your turn' },
                'VERSION_CONFLICT': { status: 409, message: 'Game state changed. Please refresh.' },
                'INVALID_MOVE': { status: 400, message: 'Invalid move. Position already taken.' }
            };

            const errorInfo = errorMessages[error.message];
            if (errorInfo) {
                return res.status(errorInfo.status).json({
                    success: false,
                    error: errorInfo.message
                });
            }

            res.status(500).json({
                success: false,
                error: `Failed to make move: ${error.message}`
            });
        }
    }
);

/**
 * @route   GET /api/bot/user/games
 * @desc    Get user's bot game history
 * @access  Private
 * NOTE: This route MUST be defined BEFORE /:gameId to avoid route conflict
 */
router.get('/user/games', authenticate, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const games = await prisma.botGame.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
                _count: { select: { moves: true } }
            }
        });

        const total = await prisma.botGame.count({
            where: { userId: req.user.id }
        });

        // Stats
        const stats = {
            total: 0,
            wins: 0,
            losses: 0,
            draws: 0
        };

        const finishedGames = await prisma.botGame.findMany({
            where: { userId: req.user.id, status: 'finished' },
            select: { winner: true }
        });

        for (const game of finishedGames) {
            stats.total++;
            if (game.winner === 'player') stats.wins++;
            else if (game.winner === 'bot') stats.losses++;
            else stats.draws++;
        }

        res.json({
            success: true,
            data: {
                games: games.map(game => ({
                    id: game.id,
                    status: game.status,
                    winner: game.winner,
                    moveCount: game._count.moves,
                    createdAt: game.createdAt
                })),
                pagination: {
                    total,
                    limit,
                    offset,
                    hasMore: offset + games.length < total
                },
                stats
            }
        });
    } catch (error) {
        console.error('Get bot games error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get games'
        });
    }
});

/**
 * @route   GET /api/bot/:gameId
 * @desc    Get bot game state
 * @access  Private
 */
router.get(
    '/:gameId',
    authenticate,
    [param('gameId').isUUID().withMessage('Invalid game ID')],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid game ID'
                });
            }

            const game = await prisma.botGame.findUnique({
                where: { id: req.params.gameId },
                include: {
                    moves: {
                        orderBy: { moveOrder: 'asc' }
                    }
                }
            });

            if (!game) {
                return res.status(404).json({
                    success: false,
                    error: 'Game not found'
                });
            }

            if (game.userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
            }

            const botSymbol = game.playerSymbol === 'X' ? 'O' : 'X';

            res.json({
                success: true,
                data: {
                    game: {
                        id: game.id,
                        board: game.board,
                        playerSymbol: game.playerSymbol,
                        botSymbol: botSymbol,
                        currentTurn: game.currentTurn,
                        status: game.status,
                        winner: game.winner,
                        version: game.version,
                        moves: game.moves,
                        createdAt: game.createdAt
                    }
                }
            });
        } catch (error) {
            console.error('Get bot game error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get game'
            });
        }
    }
);

module.exports = router;
