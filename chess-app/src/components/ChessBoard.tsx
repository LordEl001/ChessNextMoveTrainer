/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, DragEvent, CSSProperties } from 'react';
import { Chess } from 'chess.js';
import { BoardTheme, Color, PieceType } from '../types';
import { THEMES } from './ThemeConfig';

interface ChessBoardProps {
  game: Chess;
  onMove: (from: string, to: string, promotion?: string) => void;
  isFlipped: boolean;
  theme: BoardTheme;
  selectedSquare: string | null;
  setSelectedSquare: (sq: string | null) => void;
  lastMove: { from: string; to: string } | null;
  interactive: boolean;
  isPredictionMode?: boolean;
  predictedFromSquare?: string | null;
  predictedToSquare?: string | null;
  onPredictionSquareClick?: (square: string) => void;
}

export function getPieceUrl(color: Color, type: PieceType): string {
  const isLight = color === 'w';
  const prefix = 'https://upload.wikimedia.org/wikipedia/commons/';
  
  switch (type) {
    case 'p': return `${prefix}${isLight ? '4/45/Chess_plt45.svg' : 'c/c7/Chess_pdt45.svg'}`;
    case 'r': return `${prefix}${isLight ? '7/72/Chess_rlt45.svg' : 'f/ff/Chess_rdt45.svg'}`;
    case 'n': return `${prefix}${isLight ? '7/70/Chess_nlt45.svg' : 'e/ef/Chess_ndt45.svg'}`;
    case 'b': return `${prefix}${isLight ? 'b/b1/Chess_blt45.svg' : '9/98/Chess_bdt45.svg'}`;
    case 'q': return `${prefix}${isLight ? '1/15/Chess_qlt45.svg' : '4/47/Chess_qdt45.svg'}`;
    case 'k': return `${prefix}${isLight ? '4/42/Chess_klt45.svg' : 'f/f0/Chess_kdt45.svg'}`;
  }
}

export default function ChessBoard({
  game,
  onMove,
  isFlipped,
  theme,
  selectedSquare,
  setSelectedSquare,
  lastMove,
  interactive,
  isPredictionMode = false,
  predictedFromSquare = null,
  predictedToSquare = null,
  onPredictionSquareClick,
}: ChessBoardProps) {
  const activeTheme = THEMES[theme];

  // Promotion local overlay state
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(null);

  // Grid indexing helper
  const ranks = useMemo(() => {
    const list = ['8', '7', '6', '5', '4', '3', '2', '1'];
    return isFlipped ? [...list].reverse() : list;
  }, [isFlipped]);

  const files = useMemo(() => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    return isFlipped ? [...list].reverse() : list;
  }, [isFlipped]);

  // Map of square coordinates with its piece
  const boardState = useMemo(() => {
    const board = game.board();
    const map: Record<string, { type: PieceType; color: Color } | null> = {};
    
    // Normal files/ranks mapping
    const tempFiles = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (let r = 0; r < 8; r++) {
      const rankNum = 8 - r;
      for (let c = 0; c < 8; c++) {
        const fileChar = tempFiles[c];
        const piece = board[r][c];
        map[`${fileChar}${rankNum}`] = piece ? { type: piece.type, color: piece.color } : null;
      }
    }
    return map;
  }, [game]);

  // Compute legal moves from the selected square
  const legalDestinations = useMemo(() => {
    if (!selectedSquare || !interactive) return new Set<string>();
    const moves = game.moves({ square: selectedSquare as any, verbose: true });
    return new Set<string>(moves.map((m) => m.to));
  }, [game, selectedSquare, interactive]);

  // Check if a move is promotion-eligible
  const checkPromotion = (from: string, to: string): boolean => {
    const piece = boardState[from];
    if (!piece || piece.type !== 'p') return false;
    
    const rank = to[1];
    return (piece.color === 'w' && rank === '8') || (piece.color === 'b' && rank === '1');
  };

  // Click handler
  const handleSquareClick = (square: string) => {
    if (isPredictionMode && onPredictionSquareClick) {
      onPredictionSquareClick(square);
      return;
    }

    if (!interactive) return;

    if (selectedSquare === square) {
      // Deselect if active square clicked again
      setSelectedSquare(null);
      return;
    }

    const clickedPiece = boardState[square];

    // If a legal destination is clicked, commit the move
    if (selectedSquare && legalDestinations.has(square)) {
      if (checkPromotion(selectedSquare, square)) {
        setPromotionPending({ from: selectedSquare, to: square });
      } else {
        onMove(selectedSquare, square);
        setSelectedSquare(null);
      }
      return;
    }

    // Select personal pieces
    if (clickedPiece && clickedPiece.color === game.turn()) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  // Promotion select commit
  const handlePromotionChoice = (choice: 'q' | 'r' | 'b' | 'n') => {
    if (promotionPending) {
      onMove(promotionPending.from, promotionPending.to, choice);
      setPromotionPending(null);
      setSelectedSquare(null);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent, square: string) => {
    if (isPredictionMode || !interactive) {
      e.preventDefault();
      return;
    }
    const piece = boardState[square];
    if (piece && piece.color === game.turn()) {
      e.dataTransfer.setData('text/plain', square);
      setSelectedSquare(square);
    } else {
      e.preventDefault();
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault(); // necessary to permit dropping
  };

  const handleDrop = (e: DragEvent, square: string) => {
    e.preventDefault();
    const fromSquare = e.dataTransfer.getData('text/plain');
    if (!fromSquare || fromSquare === square) return;

    if (legalDestinations.has(square)) {
      if (checkPromotion(fromSquare, square)) {
        setPromotionPending({ from: fromSquare, to: square });
      } else {
        onMove(fromSquare, square);
        setSelectedSquare(null);
      }
    } else {
      // Select the other squared piece if of same color
      const pieceOnDropped = boardState[square];
      if (pieceOnDropped && pieceOnDropped.color === game.turn()) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
    }
  };

  return (
    <div className="relative w-full aspect-square bg-stone-900 rounded-lg shadow-2xl border-[12px] border-[#3d3d2e] overflow-hidden select-none" id="chessboard-container">
      {/* 8x8 Grid with explicit dimensions and absolute layout to prevent aspect-ratio height clipping in Safari */}
      <div className="absolute inset-0 grid grid-cols-8 grid-rows-[repeat(8,minmax(0,1fr))]">
        {ranks.map((rank) =>
          files.map((file) => {
            const squareSquare = `${file}${rank}`;
            const piece = boardState[squareSquare];
            const isLight = (parseInt(rank) + file.charCodeAt(0)) % 2 !== 0;
            const isSelected = selectedSquare === squareSquare;
            const isLastMoveFrom = lastMove?.from === squareSquare;
            const isLastMoveTo = lastMove?.to === squareSquare;

            // Compute background color
            let bgStyle = isLight ? activeTheme.light : activeTheme.dark;
            
            // Build element style overlay
            const cellStyle: CSSProperties = {
              backgroundColor: bgStyle,
            };

            const isHighlighted = isLastMoveFrom || isLastMoveTo;
            const isPredictedFrom = predictedFromSquare === squareSquare;
            const isPredictedTo = predictedToSquare === squareSquare;

            return (
              <div
                key={squareSquare}
                id={`square-${squareSquare}`}
                style={cellStyle}
                onClick={() => handleSquareClick(squareSquare)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, squareSquare)}
                className="relative flex items-center justify-center cursor-pointer transition-colors duration-150 group"
              >
                {/* Last Move Highlight */}
                {isHighlighted && (
                  <div
                    style={{ backgroundColor: activeTheme.highlight }}
                    className="absolute inset-0 z-0 pointer-events-none"
                  />
                )}

                {/* Prediction Highlights */}
                {isPredictedFrom && (
                  <div className="absolute inset-0 border-[3.5px] border-dashed border-sky-500 z-10 pointer-events-none bg-sky-500/10 animate-pulse" />
                )}
                {isPredictedTo && (
                  <div className="absolute inset-0 border-[3.5px] border-solid border-sky-500 z-10 pointer-events-none bg-sky-500/15" />
                )}

                {/* Prediction Badges */}
                {isPredictedFrom && (
                  <span className="absolute top-1 right-1 bg-sky-600 text-white text-[8px] md:text-[9px] px-1 font-bold rounded z-20 font-sans tracking-wide">
                    Start
                  </span>
                )}
                {isPredictedTo && (
                  <span className="absolute top-1 right-1 bg-sky-600 text-white text-[8px] md:text-[9px] px-1 font-bold rounded z-20 font-sans tracking-wide">
                    End
                  </span>
                )}

                {/* Selected square outline state */}
                {isSelected && (
                  <div
                    style={{ backgroundColor: activeTheme.selected }}
                    className="absolute inset-x-0 inset-y-0 border-2 border-natural-accent z-10 pointer-events-none"
                  />
                )}

                {/* Piece rendering */}
                {piece && (
                  <img
                    id={`piece-${squareSquare}`}
                    src={getPieceUrl(piece.color, piece.type)}
                    alt={`${piece.color === 'w' ? 'White' : 'Black'} ${piece.type}`}
                    draggable={!isPredictionMode && interactive && piece.color === game.turn()}
                    onDragStart={(e) => handleDragStart(e, squareSquare)}
                    referrerPolicy="no-referrer"
                    className={`w-[84%] h-[84%] z-20 object-contain selection:bg-transparent cursor-grab active:cursor-grabbing hover:scale-105 transition-transform duration-105 ${
                      interactive && piece.color === game.turn() ? 'group-hover:drop-shadow-lg' : ''
                    }`}
                  />
                )}

                {/* Legal destination indicator */}
                {legalDestinations.has(squareSquare) && (
                  <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                    {piece ? (
                      // Capture Indicator: Red/Alert ring
                      <div
                        style={{ border: `3.5px solid ${activeTheme.legalCapture}` }}
                        className="w-[84%] h-[84%] rounded-full animate-pulse"
                      />
                    ) : (
                      // Normal Legal Move Dot
                      <div
                        style={{ backgroundColor: activeTheme.legalDot }}
                        className="w-[28%] h-[28%] rounded-full shadow-inner"
                      />
                    )}
                  </div>
                )}

                {/* Rank Number Coordinates (rendered on column index 1/8) */}
                {((!isFlipped && file === 'a') || (isFlipped && file === 'h')) && (
                  <span
                    className={`absolute top-0.5 left-1 font-mono text-[9px] md:text-[11px] font-bold leading-none select-none z-10 ${
                      isLight ? 'text-stone-700/60' : 'text-stone-100/60'
                    }`}
                  >
                    {rank}
                  </span>
                )}

                {/* File Letter Coordinates (rendered on row index 1) */}
                {((!isFlipped && rank === '1') || (isFlipped && rank === '8')) && (
                  <span
                    className={`absolute bottom-0.5 right-1 font-mono text-[9px] md:text-[11px] font-bold leading-none select-none z-10 ${
                      isLight ? 'text-stone-700/60' : 'text-stone-100/60'
                    }`}
                  >
                    {file}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pawn Promotion Dialog Overlay */}
      {promotionPending && (
        <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-2xl max-w-xs w-full text-center">
            <h3 className="text-natural-text text-md font-bold mb-3 font-serif italic">Pawn Promotion</h3>
            <p className="text-stone-500 text-xs mb-5 font-sans">Choose what piece your pawn will promote to:</p>
            <div className="grid grid-cols-4 gap-2">
              {(['q', 'r', 'b', 'n'] as const).map((choice) => {
                const turnColor = game.turn();
                return (
                  <button
                    key={choice}
                    id={`promote-${choice}`}
                    onClick={() => handlePromotionChoice(choice)}
                    className="flex flex-col items-center justify-center p-2.5 bg-stone-50 hover:bg-natural-accent/15 border border-stone-200 hover:border-natural-accent rounded-lg transition-all"
                  >
                    <img
                      src={getPieceUrl(turnColor, choice)}
                      alt={choice === 'q' ? 'Queen' : choice === 'r' ? 'Rook' : choice === 'b' ? 'Bishop' : 'Knight'}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 object-contain animate-fade-in"
                    />
                    <span className="text-[9px] text-stone-600 font-bold mt-1 uppercase font-sans">
                      {choice === 'q' ? 'Queen' : choice === 'r' ? 'Rook' : choice === 'b' ? 'Bishop' : 'Knight'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
