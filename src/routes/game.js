const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const {
    checkWinner,
    isDraw,
    isValidMove,
    makeMove,
    countMoves,
    getGameStatus
} = require('../services/gameLogic');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route   POST /api/game/:roomId/move
 * @desc    Make a move (with race condition protection)
 * @access  Private
 */
router.post(
    '/:roomId/move',
    authenticate,
    [
        param('roomId').isUUID().withMessage('Invalid room ID'),
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

            const { roomId } = req.params;
            const { position } = req.body;
            const clientVersion = req.body.version;

            // Use transaction with optimistic locking for race condition prevention
            const result = await prisma.$transaction(async (tx) => {
                // Get room with lock
                const room = await tx.room.findUnique({
                    where: { id: roomId },
                    include: {
                        player1: { select: { id: true, username: true } },
                        player2: { select: { id: true, username: true } }
                    }
                });

                if (!room) {
                    throw new Error('ROOM_NOT_FOUND');
                }

                // Validate game state
                if (room.status === 'waiting') {
                    throw new Error('GAME_NOT_STARTED');
                }

                if (room.status === 'finished') {
                    throw new Error('GAME_FINISHED');
                }

                // Check if client version matches (optimistic locking)
                if (clientVersion !== undefined && room.version !== clientVersion) {
                    throw new Error('VERSION_CONFLICT');
                }

                // Determine player's role
                let playerRole;
                if (room.player1Id === req.user.id) {
                    playerRole = 'player1';
                } else if (room.player2Id === req.user.id) {
                    playerRole = 'player2';
                } else {
                    throw new Error('NOT_A_PLAYER');
                }

                // Check if it's this player's turn
                if (room.currentTurn !== playerRole) {
                    throw new Error('NOT_YOUR_TURN');
                }

                // Validate move
                if (!isValidMove(room.board, position)) {
                    throw new Error('INVALID_MOVE');
                }

                // Determine symbol (player1 = X, player2 = O)
                const symbol = playerRole === 'player1' ? 'X' : 'O';

                // Make the move
                const newBoard = makeMove(room.board, position, symbol);

                // Check game result
                const winner = checkWinner(newBoard);
                const draw = isDraw(newBoard);

                // Determine new game state
                let newStatus = 'in-progress';
                let winnerId = null;
                let newCurrentTurn = playerRole === 'player1' ? 'player2' : 'player1';

                if (winner) {
                    newStatus = 'finished';
                    winnerId = req.user.id;
                    newCurrentTurn = null;
                } else if (draw) {
                    newStatus = 'finished';
                    newCurrentTurn = null;
                }

                // Update room with version increment
                const updatedRoom = await tx.room.update({
                    where: { id: roomId },
                    data: {
                        board: newBoard,
                        currentTurn: newCurrentTurn,
                        status: newStatus,
                        winnerId: winnerId,
                        isDraw: draw,
                        version: room.version + 1
                    },
                    include: {
                        player1: { select: { id: true, username: true } },
                        player2: { select: { id: true, username: true } },
                        winner: { select: { id: true, username: true } }
                    }
                });

                // Record move in history
                const moveCount = countMoves(room.board);
                await tx.move.create({
                    data: {
                        roomId: roomId,
                        playerId: req.user.id,
                        position: position,
                        symbol: symbol,
                        moveOrder: moveCount + 1
                    }
                });

                return updatedRoom;
            });

            res.json({
                success: true,
                data: {
                    room: {
                        id: result.id,
                        code: result.code,
                        status: result.status,
                        player1: result.player1,
                        player2: result.player2,
                        player1Id: result.player1Id,
                        player2Id: result.player2Id,
                        currentTurn: result.currentTurn,
                        board: result.board,
                        winner: result.winner,
                        isDraw: result.isDraw,
                        version: result.version
                    }
                }
            });
        } catch (error) {
            console.error('Make move error:', error);

            const errorMessages = {
                'ROOM_NOT_FOUND': { status: 404, message: 'Room not found' },
                'GAME_NOT_STARTED': { status: 400, message: 'Game has not started yet' },
                'GAME_FINISHED': { status: 400, message: 'Game is already finished' },
                'VERSION_CONFLICT': { status: 409, message: 'Game state has changed. Please refresh and try again.' },
                'NOT_A_PLAYER': { status: 403, message: 'You are not a player in this game' },
                'NOT_YOUR_TURN': { status: 400, message: 'It is not your turn' },
                'INVALID_MOVE': { status: 400, message: 'Invalid move. Position already taken or out of bounds.' }
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
                error: 'Failed to make move'
            });
        }
    }
);

/**
 * @route   GET /api/game/:roomId/state
 * @desc    Get current game state (for polling)
 * @access  Private
 */
router.get(
    '/:roomId/state',
    authenticate,
    [param('roomId').isUUID().withMessage('Invalid room ID')],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid room ID'
                });
            }

            const room = await prisma.room.findUnique({
                where: { id: req.params.roomId },
                include: {
                    player1: { select: { id: true, username: true } },
                    player2: { select: { id: true, username: true } },
                    winner: { select: { id: true, username: true } },
                    moves: {
                        orderBy: { moveOrder: 'desc' },
                        take: 1,
                        select: { position: true, symbol: true, moveOrder: true }
                    }
                }
            });

            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }

            // Determine user's role
            let userRole = 'spectator';
            if (room.player1Id === req.user.id) userRole = 'player1';
            else if (room.player2Id === req.user.id) userRole = 'player2';

            res.json({
                success: true,
                data: {
                    room: {
                        id: room.id,
                        code: room.code,
                        status: room.status,
                        player1: room.player1,
                        player2: room.player2,
                        player1Id: room.player1Id,
                        player2Id: room.player2Id,
                        currentTurn: room.currentTurn,
                        board: room.board,
                        winner: room.winner,
                        isDraw: room.isDraw,
                        version: room.version,
                        lastMove: room.moves[0] || null,
                        updatedAt: room.updatedAt
                    },
                    userRole
                }
            });
        } catch (error) {
            console.error('Get game state error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get game state'
            });
        }
    }
);

/**
 * @route   GET /api/game/:roomId/status
 * @desc    Quick status check (whose turn, winner)
 * @access  Private
 */
router.get(
    '/:roomId/status',
    authenticate,
    [param('roomId').isUUID().withMessage('Invalid room ID')],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid room ID'
                });
            }

            const room = await prisma.room.findUnique({
                where: { id: req.params.roomId },
                select: {
                    id: true,
                    status: true,
                    currentTurn: true,
                    board: true,
                    winnerId: true,
                    isDraw: true,
                    version: true,
                    updatedAt: true
                }
            });

            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }

            // Check if it's user's turn
            let isMyTurn = false;
            const fullRoom = await prisma.room.findUnique({
                where: { id: req.params.roomId },
                select: { player1Id: true, player2Id: true, currentTurn: true }
            });

            if (fullRoom.player1Id === req.user.id && room.currentTurn === 'player1') {
                isMyTurn = true;
            } else if (fullRoom.player2Id === req.user.id && room.currentTurn === 'player2') {
                isMyTurn = true;
            }

            res.json({
                success: true,
                data: {
                    status: room.status,
                    currentTurn: room.currentTurn,
                    isMyTurn,
                    hasWinner: !!room.winnerId,
                    isDraw: room.isDraw,
                    version: room.version,
                    updatedAt: room.updatedAt
                }
            });
        } catch (error) {
            console.error('Get status error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get status'
            });
        }
    }
);

module.exports = router;
