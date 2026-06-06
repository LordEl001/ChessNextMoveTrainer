/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Clock, User, Cpu } from 'lucide-react';
import { Chess } from 'chess.js';
import { Color } from '../types';
import CapturedPieces from './CapturedPieces';

interface PlayerBarProps {
  game: Chess;
  barColor: Color;
  name: string;
  isComputer: boolean;
  timeLeft: number | null; // null means infinite
  isActive: boolean;
  isFlipped: boolean;
}

export default function PlayerBar({
  game,
  barColor,
  name,
  isComputer,
  timeLeft,
  isActive,
}: PlayerBarProps) {
  // Format seconds into MM:SS format
  const formatTime = (totalSeconds: number | null): string => {
    if (totalSeconds === null) return '∞';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const padSec = seconds.toString().padStart(2, '0');
    return `${minutes}:${padSec}`;
  };

  const isLowTime = timeLeft !== null && timeLeft <= 20;

  return (
    <div
      id={`player-bar-${barColor}`}
      className={`flex items-center justify-between px-4 py-3 bg-white border rounded-xl shadow-xs transition-all ${
        isActive
          ? 'border-natural-accent bg-white ring-1 ring-natural-accent/10 shadow-sm'
          : 'border-stone-200 bg-white/60'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar */}
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 border transition-colors ${
            isActive
              ? 'bg-natural-accent/10 border-natural-accent'
              : 'bg-stone-50 border-stone-200'
          }`}
        >
          {isComputer ? (
            <Cpu className={`w-5 h-5 transition-colors ${isActive ? 'text-natural-accent' : 'text-stone-400'}`} />
          ) : (
            <User className={`w-5 h-5 transition-colors ${isActive ? 'text-natural-accent' : 'text-stone-400'}`} />
          )}
        </div>

        {/* Name and Captured pieces */}
        <div className="flex flex-col min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className={`text-[13px] md:text-sm font-bold truncate select-none tracking-tight ${isActive ? 'text-natural-text' : 'text-stone-600'}`}>
              {name}
            </span>
            <span className="font-mono text-[9px] md:text-[10px] uppercase font-bold text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded shrink-0">
              {barColor === 'w' ? 'White' : 'Black'}
            </span>
          </div>
          {/* Captured Pieces display */}
          <CapturedPieces game={game} playerColor={barColor} />
        </div>
      </div>

      {/* Clock Timer display */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs md:text-sm font-bold tracking-wider transition-all select-none ${
          isActive
            ? isLowTime
              ? 'bg-red-500/10 border-red-500 text-red-600 animate-pulse'
              : 'bg-natural-accent/10 border-natural-accent text-natural-accent'
            : 'bg-stone-100 border-stone-200 text-stone-400'
        }`}
      >
        <Clock className={`w-3.5 h-3.5 shrink-0 ${isActive && isLowTime ? 'text-red-500' : 'text-stone-400'}`} />
        <span>{formatTime(timeLeft)}</span>
      </div>
    </div>
  );
}
