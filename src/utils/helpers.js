/**
 * Utility helpers for the application
 */

/**
 * Generate a random room code
 * @param {number} length - Length of the code (default: 6)
 * @returns {string} - Random alphanumeric code
 */
function generateRoomCode(length = 6) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (I, O, 0, 1)
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Parse board string to array representation
 * @param {string} board - 9-character string
 * @returns {string[]} - 9-element array
 */
function boardToArray(board) {
    return board.split('');
}

/**
 * Convert board array to string
 * @param {string[]} boardArray - 9-element array
 * @returns {string} - 9-character string
 */
function arrayToBoard(boardArray) {
    return boardArray.join('');
}

/**
 * Format board for display
 * @param {string} board - 9-character string
 * @returns {string[][]} - 3x3 array
 */
function formatBoard(board) {
    const arr = boardToArray(board);
    return [
        [arr[0], arr[1], arr[2]],
        [arr[3], arr[4], arr[5]],
        [arr[6], arr[7], arr[8]]
    ];
}

/**
 * Generate a unique ID
 * @returns {string}
 */
function generateId() {
    const { v4: uuidv4 } = require('uuid');
    return uuidv4();
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    generateRoomCode,
    boardToArray,
    arrayToBoard,
    formatBoard,
    generateId,
    sleep
};
