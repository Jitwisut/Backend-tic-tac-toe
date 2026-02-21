/**
 * Bot Service - Unbeatable Tic-Tac-Toe Bot using Minimax Algorithm
 * The bot will never lose - it will either win or draw
 */

const { checkWinner, isDraw, getAvailableMoves, makeMove } = require('./gameLogic');

/**
 * Minimax algorithm with alpha-beta pruning
 * @param {string} board - Current board state
 * @param {number} depth - Current depth in the game tree
 * @param {boolean} isMaximizing - True if maximizing player (bot)
 * @param {number} alpha - Alpha value for pruning
 * @param {number} beta - Beta value for pruning
 * @param {string} botSymbol - Bot's symbol ('X' or 'O')
 * @param {string} playerSymbol - Player's symbol ('X' or 'O')
 * @returns {number} - Score of the board position
 */
function minimax(board, depth, isMaximizing, alpha, beta, botSymbol, playerSymbol) {
    // Check terminal states
    const winner = checkWinner(board);

    if (winner === botSymbol) {
        return 10 - depth; // Bot wins (prefer faster wins)
    }
    if (winner === playerSymbol) {
        return depth - 10; // Player wins (prefer slower losses)
    }
    if (isDraw(board)) {
        return 0; // Draw
    }

    const availableMoves = getAvailableMoves(board);

    if (isMaximizing) {
        // Bot's turn - maximize score
        let maxScore = -Infinity;

        for (const position of availableMoves) {
            const newBoard = makeMove(board, position, botSymbol);
            const score = minimax(newBoard, depth + 1, false, alpha, beta, botSymbol, playerSymbol);
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);

            if (beta <= alpha) {
                break; // Alpha-beta pruning
            }
        }

        return maxScore;
    } else {
        // Player's turn - minimize score
        let minScore = Infinity;

        for (const position of availableMoves) {
            const newBoard = makeMove(board, position, playerSymbol);
            const score = minimax(newBoard, depth + 1, true, alpha, beta, botSymbol, playerSymbol);
            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);

            if (beta <= alpha) {
                break; // Alpha-beta pruning
            }
        }

        return minScore;
    }
}

/**
 * Find the best move for the bot
 * @param {string} board - Current board state
 * @param {string} botSymbol - Bot's symbol ('X' or 'O')
 * @param {string} playerSymbol - Player's symbol ('X' or 'O')
 * @returns {number} - Best position to play (0-8)
 */
function findBestMove(board, botSymbol, playerSymbol) {
    const availableMoves = getAvailableMoves(board);

    if (availableMoves.length === 0) {
        return -1; // No moves available
    }

    // If board is empty or only one move, use strategy shortcuts
    if (availableMoves.length === 9) {
        // First move: center or corner is optimal
        return 4; // Center
    }

    if (availableMoves.length === 8 && board[4] === '-') {
        // If center is available and opponent took a corner, take center
        return 4;
    }

    // 1. Check for immediate win
    for (const position of availableMoves) {
        const newBoard = makeMove(board, position, botSymbol);
        if (checkWinner(newBoard) === botSymbol) {
            return position;
        }
    }

    // 2. Check for immediate block
    for (const position of availableMoves) {
        const newBoard = makeMove(board, position, playerSymbol);
        if (checkWinner(newBoard) === playerSymbol) {
            return position;
        }
    }

    let bestMove = availableMoves[0];
    let bestScore = -Infinity;

    for (const position of availableMoves) {
        const newBoard = makeMove(board, position, botSymbol);
        const score = minimax(newBoard, 0, false, -Infinity, Infinity, botSymbol, playerSymbol);

        if (score > bestScore) {
            bestScore = score;
            bestMove = position;
        }
    }

    return bestMove;
}

/**
 * Check if game is over
 * @param {string} board - Current board state
 * @returns {object} - { isOver: boolean, winner: string|null, isDraw: boolean }
 */
function checkGameOver(board) {
    const winner = checkWinner(board);
    const draw = isDraw(board);

    return {
        isOver: winner !== null || draw,
        winner: winner,
        isDraw: draw
    };
}

module.exports = {
    minimax,
    findBestMove,
    checkGameOver
};
