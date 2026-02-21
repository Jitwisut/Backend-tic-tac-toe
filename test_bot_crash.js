
const { findBestMove } = require('./src/services/bot');
const { makeMove, checkWinner } = require('./src/services/gameLogic');

// Scenario from screenshot:
// Board: ----O-XOX
// Indices:
// 0 1 2
// 3 4 5
// 6 7 8
// 4=O, 6=X, 7=O, 8=X.
// Player (X) moves at 0 (for example). newBoard: X---O-XOX
// Bot (O) to move.

const board = 'X---O-XOX';
const botSymbol = 'O';
const playerSymbol = 'X';

console.log('Testing findBestMove...');
console.log('Board:', board);
console.log('Bot:', botSymbol);

try {
    const move = findBestMove(board, botSymbol, playerSymbol);
    console.log('Best Move:', move);

    if (move !== -1) {
        const newBoard = makeMove(board, move, botSymbol);
        console.log('New Board:', newBoard);
    }
} catch (error) {
    console.error('CRASHED:', error);
}
