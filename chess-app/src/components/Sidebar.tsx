/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, FormEvent } from 'react';
import { Chess } from 'chess.js';
import { 
  Play, 
  RotateCcw, 
  RotateCw, 
  Copy, 
  Check, 
  Upload, 
  Eye, 
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { BoardTheme, GameMode, AIDifficulty, MoveLog, PredictionRecord } from '../types';
import { THEMES } from './ThemeConfig';

interface SidebarProps {
  game: Chess;
  moveHistory: MoveLog[];
  currentMoveIndex: number; // -1 means live, otherwise index of move being viewed
  onSelectMoveIndex: (idx: number) => void;
  gameMode: GameMode;
  onSetGameMode: (mode: GameMode) => void;
  aiDifficulty: AIDifficulty;
  onSetAiDifficulty: (dif: AIDifficulty) => void;
  boardTheme: BoardTheme;
  onSetBoardTheme: (theme: BoardTheme) => void;
  clockSetting: number | null; // minutes or null
  onSetClockSetting: (minutes: number | null) => void;
  onUndo: () => void;
  onReset: () => void;
  onFlipBoard: () => void;
  onLoadFEN: (fen: string) => boolean; // returns success
  gameStatus: string;
  gameWinner: string | null;
  hasTimer: boolean;
  predictionRecords?: PredictionRecord[];
  onShowSummary?: () => void;
  isGameActive: boolean;
  onResign: () => void;
}

export default function Sidebar({
  game,
  moveHistory,
  currentMoveIndex,
  onSelectMoveIndex,
  gameMode,
  onSetGameMode,
  aiDifficulty,
  onSetAiDifficulty,
  boardTheme,
  onSetBoardTheme,
  clockSetting,
  onSetClockSetting,
  onUndo,
  onReset,
  onFlipBoard,
  onLoadFEN,
  gameStatus,
  gameWinner,
  hasTimer,
  predictionRecords = [],
  onShowSummary,
  isGameActive,
  onResign,
}: SidebarProps) {

  const [fenInput, setFenInput] = useState('');
  const [copiedFEN, setCopiedFEN] = useState(false);
  const [copiedPGN, setCopiedPGN] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const moveLogContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll move log to bottom on live play
  useEffect(() => {
    if (currentMoveIndex === -1 && moveLogContainerRef.current) {
      moveLogContainerRef.current.scrollTop = moveLogContainerRef.current.scrollHeight;
    }
  }, [moveHistory, currentMoveIndex]);

  // Copy helpers
  const handleCopyFEN = () => {
    navigator.clipboard.writeText(game.fen());
    setCopiedFEN(true);
    setTimeout(() => setCopiedFEN(false), 2000);
  };

  const handleCopyPGN = () => {
    navigator.clipboard.writeText(game.pgn() || '1. e4 (example start)');
    setCopiedPGN(true);
    setTimeout(() => setCopiedPGN(false), 2000);
  };

  const handleLoadFENSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!fenInput.trim()) return;

    const success = onLoadFEN(fenInput.trim());
    if (success) {
      setFenInput('');
    } else {
      setErrorMessage('Invalid FEN format. Please check the string.');
    }
  };

  // Group moves into standard turns (White / Black pairs)
  const groupedTurns = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    groupedTurns.push({
      turnNumber: Math.floor(i / 2) + 1,
      whiteMove: moveHistory[i],
      blackMove: moveHistory[i + 1] || null,
      whiteIdx: i,
      blackIdx: i + 1,
    });
  }

  return (
    <div className="flex flex-col h-full bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-xs" id="sidebar-container">
      {/* 1. Game Status Hub */}
      <div className="p-5 border-b border-stone-200 bg-stone-50">
        <h2 className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2 font-mono">Match Status</h2>
        <div className="flex items-start justify-between">
          <div>
            <div className={`text-md font-serif italic font-bold tracking-tight leading-tight mb-1 ${
              gameWinner ? 'text-natural-accent' : 'text-stone-800'
            }`}>
              {gameStatus}
            </div>
            {gameWinner && (
              <div className="text-xs text-stone-500 font-sans">
                {gameWinner === 'Draw' 
                  ? 'The game ended peacefully in a draw.' 
                  : `Congratulations to ${gameWinner === 'w' ? 'White' : 'Black'} for the victory!`}
              </div>
            )}
            {(game.isGameOver() || gameWinner) && onShowSummary && (
              <button
                id="btn-sidebar-show-summary"
                onClick={onShowSummary}
                className="mt-3 w-full py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors hover:scale-102 active:scale-98 cursor-pointer font-sans"
              >
                🏆 View Performance Summary
              </button>
            )}
            {isGameActive && (
              <button
                id="btn-sidebar-resign"
                onClick={onResign}
                className="mt-3 w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all hover:scale-102 active:scale-98 cursor-pointer font-sans"
              >
                🏳️ Resign Match
              </button>
            )}
          </div>
          {currentMoveIndex !== -1 && (
            <button
              id="btn-resume-live"
              onClick={() => onSelectMoveIndex(-1)}
              className="px-3 py-1.5 bg-natural-accent hover:bg-stone-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs active:scale-95 animate-pulse"
            >
              <Eye className="w-3.5 h-3.5" />
              Resume Live
            </button>
          )}
        </div>
      </div>

      {/* 2. Scrollable Configuration & Log sections */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* Game Mode Controls */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-2.5 font-mono">Game Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              id="mode-pass-and-play"
              onClick={() => onSetGameMode('pass-and-play')}
              className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                gameMode === 'pass-and-play'
                  ? 'bg-natural-accent border-natural-accent text-white shadow-sm'
                  : 'bg-white border-stone-200 text-stone-600 hover:text-stone-800 hover:bg-stone-50'
              }`}
            >
              Pass & Play
            </button>
            <button
              id="mode-vs-computer"
              onClick={() => onSetGameMode('vs-computer')}
              className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                gameMode === 'vs-computer'
                  ? 'bg-natural-accent border-natural-accent text-white shadow-sm'
                  : 'bg-white border-stone-200 text-stone-600 hover:text-stone-800 hover:bg-stone-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-stone-200" />
              vs Computer
            </button>
          </div>

          {/* AI Difficulty Selector if in Computer mode */}
          {gameMode === 'vs-computer' && (
            <div className="mt-3 bg-stone-50 p-3 rounded-lg border border-stone-200 animate-fade-in animate-duration-150">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 font-mono">Opponent Level</span>
                <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                  Level {aiDifficulty}
                </span>
              </div>
              
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <select
                    id="ai-difficulty-select"
                    value={aiDifficulty}
                    onChange={(e) => onSetAiDifficulty(Number(e.target.value))}
                    className="w-full bg-white border border-stone-200 rounded-lg py-2 px-3 text-xs font-semibold text-stone-700 focus:outline-hidden focus:border-sky-500 transition-colors cursor-pointer appearance-none pr-8 font-sans"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
                      let label = `Level ${level}`;
                      if (level === 1) label += " (Beginner - Depth 1)";
                      else if (level === 5) label += " (Intermediate - Depth 5)";
                      else if (level >= 8) label += ` (Expert - Depth ${5 + (level - 5) * 2} + Lichess)`;
                      else label += ` (Depth ${level <= 5 ? level : 5 + (level - 5) * 2})`;
                      return (
                        <option key={level} value={level}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-stone-400">
                    <svg className="w-4 h-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Informative description */}
              <div className="mt-2 text-[10px] text-stone-500 leading-normal font-sans">
                {aiDifficulty >= 8 ? (
                  <span className="text-sky-700 font-semibold font-sans">✨ High difficulty mode activates Lichess Cloud Grandmaster calculations!</span>
                ) : (
                  <span>Levels 1–7 limit opponent evaluation depth to guarantee fair, consistent beginner-to-intermediate games.</span>
                )}
              </div>
            </div>
          )}

          {/* Prediction Analytics Block */}
          {gameMode === 'vs-computer' && (() => {
            const totalPredictions = predictionRecords.length;
            const totalScore = predictionRecords.reduce((sum, rec) => sum + rec.scoreEarned, 0);
            const exactMatches = predictionRecords.filter(rec => rec.scoreEarned === 1.0).length;
            const partialMatches = predictionRecords.filter(rec => rec.scoreEarned === 0.4).length;
            const accuracyPct = totalPredictions > 0 ? Math.round((totalScore / totalPredictions) * 100) : 0;

            return (
              <div className="mt-3 bg-gradient-to-br from-sky-50/40 to-white border border-sky-100 rounded-xl p-4 shadow-3xs animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 font-mono flex items-center gap-1">
                    🔮 Accuracy scorecard
                  </span>
                  <span className="text-[10px] font-semibold py-0.5 px-2 bg-sky-50 text-sky-700 rounded-full border border-sky-100/60 font-sans">
                    Score: <strong className="text-sky-800 font-mono text-xs">{totalScore.toFixed(1)}</strong>
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-2.5 text-center mb-3">
                  <div className="bg-white/80 border border-stone-100 p-2 rounded-lg">
                    <div className="text-stone-400 text-[8px] uppercase tracking-wider font-mono font-bold">Guessed</div>
                    <div className="text-stone-850 font-serif font-bold text-md leading-tight mt-0.5">
                      {totalPredictions}
                    </div>
                  </div>
                  <div className="bg-white/80 border border-stone-100 p-2 rounded-lg">
                    <div className="text-emerald-500 text-[8px] uppercase tracking-wider font-mono font-bold">Exact</div>
                    <div className="text-emerald-700 font-serif font-bold text-md leading-tight mt-0.5">
                      {exactMatches}
                    </div>
                  </div>
                  <div className="bg-white/80 border border-stone-100 p-2 rounded-lg">
                    <div className="text-sky-500 text-[8px] uppercase tracking-wider font-mono font-bold">Accuracy</div>
                    <div className="text-sky-700 font-serif font-bold text-md leading-tight mt-0.5">
                      {accuracyPct}%
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-sky-500 h-full transition-all duration-300"
                    style={{ width: `${accuracyPct}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1.5 text-[8px] text-stone-400 font-sans leading-none">
                  <span>0% Correct</span>
                  <span>{partialMatches} partial match{partialMatches !== 1 ? 'es' : ''}</span>
                  <span>100% Exact</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Dynamic Move Log Table */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-2 font-mono">Move Log</label>
          <div ref={moveLogContainerRef} className="bg-stone-50 rounded-xl border border-stone-200 h-52 overflow-y-auto flex flex-col p-2.5">
            {groupedTurns.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                <Info className="w-5 h-5 text-stone-400 mb-1.5" />
                <span className="text-xs text-stone-500 font-sans">Move pieces to generate coordinates and log moves.</span>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-y-1 text-xs select-none">
                {groupedTurns.map((turn) => {
                  const isWhiteActive = currentMoveIndex === turn.whiteIdx;
                  const isBlackActive = currentMoveIndex === turn.blackIdx;

                  return (
                    <div key={turn.turnNumber} className="contents">
                      {/* Turn Number Column */}
                      <div className="col-span-2 text-stone-400 font-mono text-center py-1 border-r border-stone-200">
                        {turn.turnNumber}.
                      </div>

                      {/* White Move Column */}
                      <button
                        id={`move-log-${turn.whiteIdx}`}
                        onClick={() => onSelectMoveIndex(turn.whiteIdx)}
                        className={`col-span-5 text-left pl-3 py-1 font-mono rounded cursor-pointer transition-colors ${
                          isWhiteActive
                            ? 'bg-natural-accent text-white font-bold shadow-xs'
                            : 'text-stone-700 hover:bg-stone-200/50 hover:text-stone-950'
                        }`}
                      >
                        {turn.whiteMove.san}
                      </button>

                      {/* Black Move Column */}
                      {turn.blackMove ? (
                        <button
                          id={`move-log-${turn.blackIdx}`}
                          onClick={() => onSelectMoveIndex(turn.blackIdx)}
                          className={`col-span-5 text-left pl-3 py-1 font-mono rounded cursor-pointer transition-colors ${
                            isBlackActive
                              ? 'bg-natural-accent text-white font-bold shadow-xs'
                              : 'text-stone-700 hover:bg-stone-200/50 hover:text-stone-950'
                          }`}
                        >
                          {turn.blackMove.san}
                        </button>
                      ) : (
                        <div className="col-span-5" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Custom Timer Clock preset controls */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-2 font-mono">Time Control</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Unlimited', val: null },
              { label: '3 min', val: 3 },
              { label: '5 min', val: 5 },
              { label: '10 min', val: 10 },
              { label: '15 min', val: 15 },
              { label: '30 min', val: 30 },
            ].map((preset) => (
              <button
                key={preset.label}
                id={`time-preset-${preset.val || 'infinite'}`}
                onClick={() => onSetClockSetting(preset.val)}
                className={`py-1.5 text-center text-[10px] font-bold tracking-wide uppercase rounded-md border transition-all ${
                  clockSetting === preset.val
                    ? 'bg-natural-accent border-natural-accent text-white font-bold'
                    : 'bg-white border-stone-200 text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {hasTimer && (
            <span className="text-[9px] text-stone-400 block mt-1.5 font-sans italic leading-tight">
              ⏱ Timers begin counting down after White makes their opening move.
            </span>
          )}
        </div>

        {/* Board Aesthetic customization */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-2 font-mono">Board Theme</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(THEMES) as BoardTheme[]).map((thm) => {
              const thmConfig = THEMES[thm];
              return (
                <button
                  key={thm}
                  id={`theme-${thm}`}
                  onClick={() => onSetBoardTheme(thm)}
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${
                    boardTheme === thm
                      ? 'bg-stone-50 border-natural-accent text-stone-900 font-bold shadow-xs'
                      : 'bg-white border-stone-200 text-stone-500 hover:text-stone-850 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex w-6 h-6 border border-stone-200 rounded overflow-hidden shadow-inner shrink-0 leading-none">
                    <span className="w-1/2 h-full" style={{ backgroundColor: thmConfig.light }} />
                    <span className="w-1/2 h-full" style={{ backgroundColor: thmConfig.dark }} />
                  </div>
                  <span className="text-[11px] font-semibold truncate leading-none">
                    {thmConfig.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Utilities: FEN/PGN importing */}
        <div className="border border-stone-200 rounded-xl p-3 bg-stone-50">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-2 font-mono">Advanced Utilities</span>
          
          {/* FEN Loader */}
          <form onSubmit={handleLoadFENSubmit} className="space-y-1.5">
            <span className="text-[9px] text-stone-500 font-mono block">Load Board State (FEN)</span>
            <div className="flex gap-1.5">
              <input
                type="text"
                id="fen-input-field"
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                placeholder="r1bqkbnr/pppp1ppp/..."
                className="flex-1 bg-white border border-stone-200 focus:border-natural-accent rounded-lg px-2.5 py-1 text-xs text-stone-800 placeholder-stone-300 outline-none font-mono"
              />
              <button
                type="submit"
                id="btn-submit-fen"
                className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg text-stone-700 font-bold text-xs flex items-center justify-center shrink-0 hover:scale-102 transition-transform"
                title="Load Position"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>
            {errorMessage && (
              <span className="text-[9px] text-red-500 block leading-tight font-sans">
                {errorMessage}
              </span>
            )}
          </form>

          {/* Copy Board state details */}
          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-stone-200">
            <button
              type="button"
              id="btn-copy-fen"
              onClick={handleCopyFEN}
              className="py-1 px-2 border border-stone-200 hover:border-natural-accent bg-white hover:bg-stone-50 rounded-md text-[10px] font-bold text-stone-500 hover:text-stone-800 flex items-center justify-center gap-1 transition-all"
            >
              {copiedFEN ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copiedFEN ? 'Copied!' : 'Copy FEN'}
            </button>
            <button
              type="button"
              id="btn-copy-pgn"
              onClick={handleCopyPGN}
              className="py-1 px-2 border border-stone-200 hover:border-natural-accent bg-white hover:bg-stone-50 rounded-md text-[10px] font-bold text-stone-500 hover:text-stone-800 flex items-center justify-center gap-1 transition-all"
            >
              {copiedPGN ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copiedPGN ? 'Copied!' : 'Copy PGN'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Global Control Bar */}
      <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-2 shrink-0 border-b rounded-b-2xl">
        <button
          id="btn-flip"
          onClick={onFlipBoard}
          className="flex-1 py-2 px-2 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-300 text-stone-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
          title="Flip Board Perspective"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Flip View
        </button>

        <button
          id="btn-takeback"
          onClick={onUndo}
          className="flex-1 py-2 px-2 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-300 text-stone-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
          title="Undo last move"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Undo
        </button>

        <button
          id="btn-reset"
          onClick={onReset}
          className="flex-1 py-2 px-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
          title="Start fresh match"
        >
          <Play className="w-3.5 h-3.5 rotate-90" />
          Restart
        </button>
      </div>
    </div>
  );
}
