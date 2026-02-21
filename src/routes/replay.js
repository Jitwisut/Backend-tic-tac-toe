const express = require('express');
const { param, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * @route   GET /api/replay/:roomId
 * @desc    Get all moves for a game replay
 * @access  Private
 */
router.get(
    '/:roomId',
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

            // Get room details
            const room = await prisma.room.findUnique({
                where: { id: req.params.roomId },
                include: {
                    player1: { select: { id: true, username: true } },
                    player2: { select: { id: true, username: true } },
                    winner: { select: { id: true, username: true } }
                }
            });

            if (!room) {
                return res.status(404).json({
                    success: false,
                    error: 'Room not found'
                });
            }

            // Get all moves in order
            const moves = await prisma.move.findMany({
                where: { roomId: req.params.roomId },
                orderBy: { moveOrder: 'asc' },
                include: {
                    player: { select: { id: true, username: true } }
                }
            });

            // Build board states for each move
            const boardStates = [];
            let currentBoard = '---------';

            for (const move of moves) {
                const boardArray = currentBoard.split('');
                boardArray[move.position] = move.symbol;
                currentBoard = boardArray.join('');

                boardStates.push({
                    moveOrder: move.moveOrder,
                    player: move.player,
                    position: move.position,
                    symbol: move.symbol,
                    boardAfterMove: currentBoard,
                    createdAt: move.createdAt
                });
            }

            res.json({
                success: true,
                data: {
                    game: {
                        id: room.id,
                        code: room.code,
                        player1: room.player1,
                        player2: room.player2,
                        winner: room.winner,
                        isDraw: room.isDraw,
                        finalBoard: room.board,
                        status: room.status,
                        createdAt: room.createdAt
                    },
                    moves: boardStates,
                    totalMoves: moves.length
                }
            });
        } catch (error) {
            console.error('Get replay error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get replay'
            });
        }
    }
);

/**
 * @route   GET /api/replay/user/history
 * @desc    Get user's game history
 * @access  Private
 */
router.get('/user/history', authenticate, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        // Get rooms where user was a player
        const rooms = await prisma.room.findMany({
            where: {
                OR: [
                    { player1Id: req.user.id },
                    { player2Id: req.user.id }
                ],
                status: 'finished'
            },
            include: {
                player1: { select: { id: true, username: true } },
                player2: { select: { id: true, username: true } },
                winner: { select: { id: true, username: true } },
                _count: { select: { moves: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });

        // Count total games
        const totalGames = await prisma.room.count({
            where: {
                OR: [
                    { player1Id: req.user.id },
                    { player2Id: req.user.id }
                ],
                status: 'finished'
            }
        });

        // Calculate stats
        const stats = await prisma.room.groupBy({
            by: ['winnerId'],
            where: {
                OR: [
                    { player1Id: req.user.id },
                    { player2Id: req.user.id }
                ],
                status: 'finished'
            },
            _count: true
        });

        let wins = 0;
        let losses = 0;
        let draws = 0;

        for (const stat of stats) {
            if (stat.winnerId === req.user.id) {
                wins = stat._count;
            } else if (stat.winnerId === null) {
                // Check if these are actually draws
                const drawCount = await prisma.room.count({
                    where: {
                        OR: [
                            { player1Id: req.user.id },
                            { player2Id: req.user.id }
                        ],
                        status: 'finished',
                        isDraw: true
                    }
                });
                draws = drawCount;
            } else {
                losses += stat._count;
            }
        }

        res.json({
            success: true,
            data: {
                games: rooms.map(room => ({
                    id: room.id,
                    code: room.code,
                    player1: room.player1,
                    player2: room.player2,
                    winner: room.winner,
                    isDraw: room.isDraw,
                    moveCount: room._count.moves,
                    result: room.winnerId === req.user.id ? 'win' : room.isDraw ? 'draw' : 'loss',
                    createdAt: room.createdAt
                })),
                pagination: {
                    total: totalGames,
                    limit,
                    offset,
                    hasMore: offset + rooms.length < totalGames
                },
                stats: {
                    total: totalGames,
                    wins,
                    losses,
                    draws,
                    winRate: totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : 0
                }
            }
        });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get game history'
        });
    }
});

module.exports = router;
