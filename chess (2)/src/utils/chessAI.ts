/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Chess } from 'chess.js';
import { PieceType, Color } from '../types';

// Piece values for positional analysis
const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (PST) from the perspective of White.
// Positive values are good for White, negative are bad or evaluated relative to the active player.
// We index these arrays by: [row * 8 + col]. Note: Row 0 is Rank 8, Row 7 is Rank 1.
// Pawns: encourage center control, advancing, and promoting
const PAWN_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5,  5, 10, 25, 25, 10,  5,  5],
  [0,  0,  0, 20, 20,  0,  0,  0],
  [5, -5,-10,  0,  0,-10, -5,  5],
  [5, 10, 10,-20,-20, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

// Knights: encourage staying in the center, punish corners
const KNIGHT_PST = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

// Bishops: encourage open diagonals, punish edges
const BISHOP_PST = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

// Rooks: encourage ranks 7 and 8, open center files
const ROOK_PST = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [0,  0,  0,  5,  5,  0,  0,  0]
];

// Queens: encourage active central but safe placement
const QUEEN_PST = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [-5,  0,  5,  5,  5,  5,  0, -5],
  [0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  5,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

// Kings: middlegame (stay in corner, safe behind pawns)
const KING_MIDDLEGAME_PST = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [20, 20,  0,  0,  0,  0, 20, 20],
  [20, 30, 10,  0,  0, 10, 30, 20]
];

// Helper to look up PST values based on piece type, color, and square index
function getPieceSquareValue(pieceType: PieceType, color: Color, row: number, col: number): number {
  // Flip row index for black pieces since tables are white-focused
  const evalRow = color === 'w' ? row : 7 - row;
  const evalCol = color === 'w' ? col : 7 - col;

  let table: number[][] | null = null;
  switch (pieceType) {
    case 'p':
      table = PAWN_PST;
      break;
    case 'n':
      table = KNIGHT_PST;
      break;
    case 'b':
      table = BISHOP_PST;
      break;
    case 'r':
      table = ROOK_PST;
      break;
    case 'q':
      table = QUEEN_PST;
      break;
    case 'k':
      table = KING_MIDDLEGAME_PST;
      break;
  }

  if (table) {
    return table[evalRow][evalCol];
  }
  return 0;
}

/**
 * Performs static evaluation of a position from White's perspective.
 * Positive = White is winning, Negative = Black is winning.
 */
export function evaluateBoard(game: Chess): number {
  let score = 0;
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = board[r][c];
      if (square) {
        const materialValue = PIECE_VALUES[square.type];
        const pstValue = getPieceSquareValue(square.type, square.color, r, c);
        const squareVal = materialValue + pstValue;

        if (square.color === 'w') {
          score += squareVal;
        } else {
          score -= squareVal;
        }
      }
    }
  }

  return score;
}

/**
 * Minimax algorithm with Alpha-Beta pruning.
 * Returns [evaluationScore, bestMove]
 */
function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizingPlayer: boolean
): [number, any | null] {
  // Base case: game over or target depth reached
  if (depth === 0 || game.isGameOver()) {
    const score = evaluateBoard(game);
    return [score, null];
  }

  const moves = game.moves({ verbose: true });
  if (moves.length === 0) {
    const score = evaluateBoard(game);
    return [score, null];
  }

  // Sort moves slightly for better alpha-beta efficiency (captures and checks first)
  const sortedMoves = [...moves].sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    if (a.captured) scoreA += PIECE_VALUES[a.captured];
    if (b.captured) scoreB += PIECE_VALUES[b.captured];
    if (a.san.includes('+')) scoreA += 50;
    if (b.san.includes('+')) scoreB += 50;
    return scoreB - scoreA;
  });

  let bestMove: any | null = null;

  if (isMaximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of sortedMoves) {
      game.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion || 'q', // default to queen promotion
      });

      const [evaluation] = minimax(game, depth - 1, alpha, beta, false);
      game.undo();

      if (evaluation > maxEval) {
        maxEval = evaluation;
        bestMove = move;
      }
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) {
        break; // beta cut-off
      }
    }
    return [maxEval, bestMove];
  } else {
    let minEval = Infinity;
    for (const move of sortedMoves) {
      game.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion || 'q',
      });

      const [evaluation] = minimax(game, depth - 1, alpha, beta, true);
      game.undo();

      if (evaluation < minEval) {
        minEval = evaluation;
        bestMove = move;
      }
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) {
        break; // alpha cut-off
      }
    }
    return [minEval, bestMove];
  }
}

/**
 * Returns the best move for the active turn in Chess.js.
 */
export function getBestMove(game: Chess, difficulty: 'easy' | 'medium' | 'hard'): any | null {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return null;

  const activeColor = game.turn();
  const isMaximizing = activeColor === 'w';

  // 1. Easy Mode: Selects a random move, but is 35% likely to take a hanging heavy piece if it exists.
  if (difficulty === 'easy') {
    const captures = moves.filter(m => m.captured);
    if (captures.length > 0 && Math.random() < 0.35) {
      // Sort captures by value to take the most valuable piece
      captures.sort((a,b) => {
        const valA = PIECE_VALUES[a.captured as keyof typeof PIECE_VALUES] || 0;
        const valB = PIECE_VALUES[b.captured as keyof typeof PIECE_VALUES] || 0;
        return valB - valA;
      });
      return captures[0];
    }
    const randomIndex = Math.floor(Math.random() * moves.length);
    return moves[randomIndex];
  }

  // 2. Medium Mode: Depth 2 Search (Very fast, handles tactical forks, mates in 1 or 2)
  if (difficulty === 'medium') {
    const [_, move] = minimax(game, 2, -Infinity, Infinity, isMaximizing);
    return move;
  }

  // 3. Hard Mode: Depth 3 Search with Positional PST matrices
  const [_, move] = minimax(game, 3, -Infinity, Infinity, isMaximizing);
  return move;
}

/**
 * Resilient computer move engine that queries the Express backend Proxy route.
 * If the connection is dropped or blocked, it utilizes a client-side chess.js-driven
 * legal move fallback generator to guarantee the UI never hangs.
 */
export async function getComputerMove(
  fen: string,
  difficulty: number = 5
): Promise<{ from: string; to: string; promotion?: string }> {
  try {
    const response = await fetch(`/api/computer-move?fen=${encodeURIComponent(fen)}&difficulty=${difficulty}`);
    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }
    const move = await response.json();
    if (!move || !move.from || !move.to) {
      throw new Error("Invalid move object structure returned by proxy");
    }
    return move;
  } catch (err: any) {
    console.warn("[getComputerMove] Client failed to fetch from backend proxy. Querying local backup engine:", err.message || err);
    
    // Ultimate client-side failsafe: query our intelligent local minimax AI search engine
    const temp = new Chess(fen);
    const difficultyMode: 'easy' | 'medium' | 'hard' = difficulty <= 3 ? 'easy' : difficulty <= 6 ? 'medium' : 'hard';
    const chosen = getBestMove(temp, difficultyMode);
    if (chosen) {
      return {
        from: chosen.from,
        to: chosen.to,
        promotion: chosen.promotion
      };
    }
    
    // Low-level backup
    const possibleMoves = temp.moves({ verbose: true });
    if (possibleMoves.length > 0) {
      const captures = possibleMoves.filter(m => m.captured);
      const randomChosen = captures.length > 0 ? captures[0] : possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      return {
        from: randomChosen.from,
        to: randomChosen.to,
        promotion: randomChosen.promotion
      };
    }
    throw new Error("No legal moves exist in this board position.");
  }
}

