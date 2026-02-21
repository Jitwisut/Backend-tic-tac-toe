/**
 * Game Logic Service
 * Contains core Tic-Tac-Toe logic including win detection and validation
 */

// Winning combinations (indices)
const WINNING_COMBINATIONS = [
  [0, 1, 2], // Top row
  [3, 4, 5], // Middle row
  [6, 7, 8], // Bottom row
  [0, 3, 6], // Left column
  [1, 4, 7], // Middle column
  [2, 5, 8], // Right column
  [0, 4, 8], // Diagonal top-left to bottom-right
  [2, 4, 6], // Diagonal top-right to bottom-left
];

/**
 * Check if there's a winner on the board
 * @param {string} board - 9-character string representing the board
 * @returns {string|null} - 'X', 'O', or null if no winner
 */
function checkWinner(board) {
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    if (board[a] !== "-" && board[a] === board[b] && board[b] === board[c]) {
      return board[a]; // Return 'X' or 'O'
    }
  }
  return null;
}

/**
 * Check if the game is a draw
 * @param {string} board - 9-character string representing the board
 * @returns {boolean} - true if draw (board full, no winner)
 */
function isDraw(board) {
  return !board.includes("-") && !checkWinner(board);
}

/**
 * Check if a position is valid and empty
 * @param {string} board - 9-character string
 * @param {number} position - Position 0-8
 * @returns {boolean}
 */
function isValidMove(board, position) {
  if (position < 0 || position > 8) return false;
  return board[position] === "-";
}

/**
 * Make a move on the board
 * @param {string} board - Current board state
 * @param {number} position - Position 0-8
 * @param {string} symbol - 'X' or 'O'
 * @returns {string} - New board state
 */
function makeMove(board, position, symbol) {
  const boardArray = board.split("");
  boardArray[position] = symbol;
  return boardArray.join("");
}

/**
 * Count moves on the board
 * @param {string} board - 9-character string
 * @returns {number}
 */
function countMoves(board) {
  return board.split("").filter((c) => c !== "-").length;
}

/**
 * Get available positions
 * @param {string} board - 9-character string
 * @returns {number[]} - Array of available positions
 */
function getAvailableMoves(board) {
  const moves = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === "-") {
      moves.push(i);
    }
  }
  return moves;
}

/**
 * Determine which symbol should play next
 * @param {string} board - Current board state
 * @returns {string} - 'X' or 'O'
 */
function getNextSymbol(board) {
  const xCount = board.split("").filter((c) => c === "X").length;
  const oCount = board.split("").filter((c) => c === "O").length;
  return xCount <= oCount ? "X" : "O";
}

/**
 * Validate game state
 * @param {string} board - 9-character string
 * @returns {object} - { valid: boolean, error?: string }
 */
function validateBoard(board) {
  if (!board || board.length !== 9) {
    return { valid: false, error: "Invalid board length" };
  }

  for (const char of board) {
    if (char !== "X" && char !== "O" && char !== "-") {
      return { valid: false, error: "Invalid board characters" };
    }
  }

  const xCount = board.split("").filter((c) => c === "X").length;
  const oCount = board.split("").filter((c) => c === "O").length;

  // X always goes first, so X count should be equal to or one more than O
  if (xCount < oCount || xCount > oCount + 1) {
    return { valid: false, error: "Invalid move count" };
  }

  return { valid: true };
}

/**
 * Get game status from board
 * @param {string} board - 9-character string
 * @returns {object} - { status, winner, isDraw }
 */
function getGameStatus(board) {
  const winner = checkWinner(board);
  if (winner) {
    return { status: "finished", winner, isDraw: false };
  }
  if (isDraw(board)) {
    return { status: "finished", winner: null, isDraw: true };
  }
  return { status: "in-progress", winner: null, isDraw: false };
}

module.exports = {
  WINNING_COMBINATIONS,
  checkWinner,
  isDraw,
  isValidMove,
  makeMove,
  countMoves,
  getAvailableMoves,
  getNextSymbol,
  validateBoard,
  getGameStatus,
};
