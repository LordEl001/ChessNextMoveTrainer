/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { Chess } from 'chess.js';
import { Color, PieceType } from '../types';
import { getPieceUrl } from './ChessBoard';

interface CapturedPiecesProps {
  game: Chess;
  playerColor: Color; // The player who captured these pieces
}

const PIECE_VALUES: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

// Piece render priority order
const RENDER_ORDER: PieceType[] = ['q', 'r', 'b', 'n', 'p'];

export default function CapturedPieces({ game, playerColor }: CapturedPiecesProps) {
  const capturedList = useMemo(() => {
    const board = game.board();
    
    // Starting counts
    const startCounts: Record<PieceType, number> = {
      p: 8,
      r: 2,
      n: 2,
      b: 2,
      q: 1,
      k: 1,
    };

    // Current active counts for the OPPONENT's color
    const opponentColor: Color = playerColor === 'w' ? 'b' : 'w';
    const activeCounts: Record<PieceType, number> = {
      p: 0,
      r: 0,
      n: 0,
      b: 0,
      q: 0,
      k: 0,
    };

    // Traverse board to count active opponent pieces
    for (const r of board) {
      for (const sq of r) {
        if (sq && sq.color === opponentColor) {
          activeCounts[sq.type]++;
        }
      }
    }

    // Determine the captured pieces
    const captured: PieceType[] = [];
    for (const type of RENDER_ORDER) {
      const diff = startCounts[type] - activeCounts[type];
      if (diff > 0) {
        for (let i = 0; i < diff; i++) {
          captured.push(type);
        }
      }
    }

    return captured;
  }, [game, playerColor]);

  // Material evaluation score
  const relativeValue = useMemo(() => {
    const board = game.board();
    let whiteTotalValue = 0;
    let blackTotalValue = 0;

    for (const r of board) {
      for (const sq of r) {
        if (sq) {
          const val = PIECE_VALUES[sq.type];
          if (sq.color === 'w') {
            whiteTotalValue += val;
          } else {
            blackTotalValue += val;
          }
        }
      }
    }

    // The current player score relative to opponent
    if (playerColor === 'w') {
      const diff = whiteTotalValue - blackTotalValue;
      return diff > 0 ? `+${diff}` : null;
    } else {
      const diff = blackTotalValue - whiteTotalValue;
      return diff > 0 ? `+${diff}` : null;
    }
  }, [game, playerColor]);

  if (capturedList.length === 0) {
    return <div className="h-6 flex items-center text-xs text-stone-400 italic font-mono">No captures</div>;
  }

  const opponentColor: Color = playerColor === 'w' ? 'b' : 'w';

  return (
    <div className="flex items-center gap-2 flex-wrap min-h-6 py-1 select-none" id={`captured-${playerColor}`}>
      <div className="flex items-center -space-x-1">
        {capturedList.map((type, idx) => (
          <img
            key={`${type}-${idx}`}
            src={getPieceUrl(opponentColor, type)}
            alt={`Captured ${type}`}
            referrerPolicy="no-referrer"
            className="w-5 h-5 object-contain hover:scale-125 transition-transform duration-75 filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] cursor-default"
            title={`${opponentColor === 'w' ? 'White' : 'Black'} captured ${type.toUpperCase()}`}
          />
        ))}
      </div>
      {relativeValue && (
        <span className="font-mono text-[10px] md:text-xs font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">
          {relativeValue}
        </span>
      )}
    </div>
  );
}
