/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { 
  GameMode, 
  AIDifficulty, 
  BoardTheme, 
  MoveLog,
  PredictionRecord
} from './types';
import ChessBoard from './components/ChessBoard';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import { getComputerMove } from './utils/chessAI';

// ----------------------------------------------------
// Core Prediction Scoring Engine
// ----------------------------------------------------

/**
 * Global array to store detailed prediction analytics for every processed computer move.
 */
export let gamePredictionData: PredictionRecord[] = [];

/**
 * Evaluates the user's prediction compared to the actual played computer move.
 * Returns the earned points according to the weighted scoring system:
 * - Exact Match: +1.0 Point
 * - Correct piece or start square: +0.4 Points
 * - Correct destination square: +0.4 Points
 * - Miss: 0.0 Points
 */
export function evaluatePrediction(
  predicted: { from: string; to: string },
  actual: { from: string; to: string }
): number {
  if (predicted.from === actual.from && predicted.to === actual.to) {
    return 1.0;
  }
  if (predicted.from === actual.from && predicted.to !== actual.to) {
    return 0.4;
  }
  if (predicted.from !== actual.from && predicted.to === actual.to) {
    return 0.4;
  }
  return 0.0;
}

export default function App() {
  // 1. Core Chess State
  const [game, setGame] = useState(() => new Chess());
  const [boardTheme, setBoardTheme] = useState<BoardTheme>('natural');
  const [gameMode, setGameMode] = useState<GameMode>('pass-and-play');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>(5);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const aiSearchingRef = useRef(false);

  // 1b. Prediction Engine State
  const [isPredictionMode, setIsPredictionMode] = useState(false);
  const [predictedFrom, setPredictedFrom] = useState<string | null>(null);
  const [predictedTo, setPredictedTo] = useState<string | null>(null);
  const [hasPredictedThisTurn, setHasPredictedThisTurn] = useState(false);
  const [predictionRecords, setPredictionRecords] = useState<PredictionRecord[]>([]);
  const [lastPredictionResult, setLastPredictionResult] = useState<{
    scoreEarned: number;
    matchType: 'exact' | 'partial-start' | 'partial-end' | 'miss';
    predictedFrom: string;
    predictedTo: string;
    actualFrom: string;
    actualTo: string;
  } | null>(null);

  // Handshake to keep the global array in sync with dynamic react state
  useEffect(() => {
    gamePredictionData = predictionRecords;
  }, [predictionRecords]);

  // Maintain move history records
  const [moveHistory, setMoveHistory] = useState<MoveLog[]>([]);
  // Points to a historical move. -1 is live, otherwise an index in moveHistory
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(-1);

  // Last move coordinate highlights { from, to }
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // 2. Timer Clocks State
  const [clockSetting, setClockSetting] = useState<number | null>(10); // Default: 10 mins
  const [whiteTime, setWhiteTime] = useState<number | null>(600); // in seconds
  const [blackTime, setBlackTime] = useState<number | null>(600);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [lastMoveTime, setLastMoveTime] = useState<number | null>(null);
  const [flaggedWinner, setFlaggedWinner] = useState<'w' | 'b' | null>(null);
  const [resignedWinner, setResignedWinner] = useState<'w' | 'b' | null>(null);
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  // 3. Modals and Confirmations
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showGameOverModal, setShowGameOverModal] = useState(false);

  // Active turn tracking
  const activeTurn = game.turn();

  // Create temporary game instance to display history if needed
  const displayGame = useMemo(() => {
    if (currentMoveIndex === -1) {
      return game;
    }
    const histGame = new Chess();
    // Load FEN of the state *after* that move
    histGame.load(moveHistory[currentMoveIndex].fenAfter);
    return histGame;
  }, [game, moveHistory, currentMoveIndex]);

  // Audio elements or subtle buzzer effects (can be simulated triggers)
  const playSound = (type: 'move' | 'capture' | 'check' | 'gameover') => {
    try {
      // Create high-quality synthesizer beeps to circumvent external asset dependencies
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.connect(gain);
      gain.connect(context.destination);

      if (type === 'move') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, context.currentTime);
        gain.gain.setValueAtTime(0.08, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.1);
        osc.start();
        osc.stop(context.currentTime + 0.1);
      } else if (type === 'capture') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, context.currentTime);
        gain.gain.setValueAtTime(0.12, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
        osc.start();
        osc.stop(context.currentTime + 0.15);
      } else if (type === 'check') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(580, context.currentTime);
        gain.gain.setValueAtTime(0.1, context.currentTime);
        osc.frequency.setValueAtTime(440, context.currentTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
        osc.start();
        osc.stop(context.currentTime + 0.22);
      } else if (type === 'gameover') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, context.currentTime);
        gain.gain.setValueAtTime(0.15, context.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, context.currentTime + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.45);
        osc.start();
        osc.stop(context.currentTime + 0.45);
      }
    } catch (_) {
      // AudioContext fails silently if browser blocks autoplay (which is standard and expected)
    }
  };

  // 4. Clock ticking effect
  useEffect(() => {
    let interval: any = null;

    if (isTimerRunning && !game.isGameOver() && !flaggedWinner && !resignedWinner) {
      interval = setInterval(() => {
        const turn = game.turn();
        if (turn === 'w') {
          setWhiteTime((prev) => {
            if (prev === null) return null;
            if (prev <= 1) {
              setFlaggedWinner('b');
              setIsTimerRunning(false);
              playSound('gameover');
              return 0;
            }
            return prev - 1;
          });
        } else {
          setBlackTime((prev) => {
            if (prev === null) return null;
            if (prev <= 1) {
              setFlaggedWinner('w');
              setIsTimerRunning(false);
              playSound('gameover');
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isTimerRunning, game, flaggedWinner, resignedWinner]);

  // Adjust timers when Clock setting changes
  useEffect(() => {
    if (clockSetting === null) {
      setWhiteTime(null);
      setBlackTime(null);
    } else {
      const secs = clockSetting * 60;
      setWhiteTime(secs);
      setBlackTime(secs);
    }
    setIsTimerRunning(false);
    setFlaggedWinner(null);
    setResignedWinner(null);
  }, [clockSetting]);

  // 4c. Trigger Game-Over Summary Dashboard Modal on Checkmate, Stalemate, Flag Falls, or Resignations
  useEffect(() => {
    const isFinished = game.isGameOver() || flaggedWinner !== null || resignedWinner !== null;
    if (isFinished) {
      const timer = setTimeout(() => {
        setShowGameOverModal(true);
      }, 750);
      return () => clearTimeout(timer);
    } else {
      setShowGameOverModal(false);
    }
  }, [game, flaggedWinner, resignedWinner]);

  // 4b. Prediction Mode Event Handlers
  const handlePredictionSquareClick = (square: string) => {
    if (!predictedFrom) {
      setPredictedFrom(square);
    } else if (!predictedTo) {
      if (square !== predictedFrom) {
        setPredictedTo(square);
      } else {
        setPredictedFrom(null);
      }
    } else {
      setPredictedFrom(square);
      setPredictedTo(null);
    }
    setLastPredictionResult(null);
  };

  const handleConfirmPrediction = () => {
    if (predictedFrom && predictedTo) {
      setIsPredictionMode(false);
      setHasPredictedThisTurn(true);
    }
  };

  // 5. Commit Move Logic Handler
  const makeMove = (from: string, to: string, promotion: string = 'q') => {
    // If exploring history, block accidental live edits
    if (currentMoveIndex !== -1) return;

    try {
      const fenBefore = game.fen();
      const tempGame = new Chess();
      tempGame.load(fenBefore);

      // Perform move in temp variable for verification
      const moveResult = tempGame.move({ from, to, promotion });
      if (!moveResult) return;

      // Sfx trigger
      if (tempGame.inCheck()) {
        playSound('check');
      } else if (moveResult.captured) {
        playSound('capture');
      } else {
        playSound('move');
      }

      // Update game
      setGame(tempGame);

      // Handle timer activation on Black's first turn response
      if (clockSetting !== null && !isTimerRunning && moveHistory.length === 0) {
        setIsTimerRunning(true);
      }

      // Record move logs
      const moveLog: MoveLog = {
        id: Math.random().toString(36).substr(2, 9),
        san: moveResult.san,
        from,
        to,
        color: moveResult.color,
        fenBefore,
        fenAfter: tempGame.fen(),
      };

      setMoveHistory((prev) => [...prev, moveLog]);
      setLastMove({ from, to });

      if (tempGame.isGameOver()) {
        setIsTimerRunning(false);
        playSound('gameover');
      }

      // Automatically trigger Prediction mode if it becomes computer's turn and game isn't over
      if (gameMode === 'vs-computer' && tempGame.turn() === 'b' && !tempGame.isGameOver()) {
        setIsPredictionMode(true);
        setPredictedFrom(null);
        setPredictedTo(null);
        setHasPredictedThisTurn(false);
        setLastPredictionResult(null);
      }
    } catch (err) {
      // Invalid move caught gracefully
    }
  };

  // 6. Local AI Turn Execution
  useEffect(() => {
    const isAiTurn = gameMode === 'vs-computer' && activeTurn === 'b';
    const isLive = currentMoveIndex === -1;
    const isGameOver = game.isGameOver() || flaggedWinner || resignedWinner;

    if (isAiTurn && isLive && !isGameOver && !isThinking && !aiSearchingRef.current) {
      if (!hasPredictedThisTurn && !isPredictionMode) {
        setIsPredictionMode(true);
        setPredictedFrom(null);
        setPredictedTo(null);
        return;
      }

      if (hasPredictedThisTurn && !isPredictionMode) {
        aiSearchingRef.current = true;
        setIsThinking(true);
        let active = true;

        const runAsyncAi = async () => {
          try {
            // Buffer to allow thinking indicator animation to settle nicely
            await new Promise((resolve) => setTimeout(resolve, 800));
            if (!active) return;

            const bestMove = await getComputerMove(game.fen(), aiDifficulty);
            if (!active) return;

            if (bestMove) {
              const predFrom = predictedFrom!;
              const predTo = predictedTo!;
              const actFrom = bestMove.from;
              const actTo = bestMove.to;

              const score = evaluatePrediction({ from: predFrom, to: predTo }, { from: actFrom, to: actTo });

              // Calculate matching type
              let matchType: 'exact' | 'partial-start' | 'partial-end' | 'miss' = 'miss';
              if (score === 1.0) {
                matchType = 'exact';
                playSound('check');
              } else if (score === 0.4 && predFrom === actFrom) {
                matchType = 'partial-start';
                playSound('move');
              } else if (score === 0.4 && predTo === actTo) {
                matchType = 'partial-end';
                playSound('move');
              } else {
                matchType = 'miss';
              }

              // Save record
              const newRecord: PredictionRecord = {
                moveNumber: Math.ceil((moveHistory.length + 1) / 2),
                predictedMove: { from: predFrom, to: predTo },
                actualMove: { from: actFrom, to: actTo },
                scoreEarned: score,
              };

              setPredictionRecords((prev) => [...prev, newRecord]);

              setLastPredictionResult({
                scoreEarned: score,
                matchType,
                predictedFrom: predFrom,
                predictedTo: predTo,
                actualFrom: actFrom,
                actualTo: actTo,
              });

              makeMove(bestMove.from, bestMove.to, bestMove.promotion);
            }
          } catch (err) {
            console.error("Error executing computer opponent API turn:", err);
          } finally {
            if (active) {
              aiSearchingRef.current = false;
              setIsThinking(false);
            }
          }
        };

        runAsyncAi();

        return () => {
          active = false;
          aiSearchingRef.current = false;
        };
      }
    }
  }, [game, gameMode, activeTurn, currentMoveIndex, aiDifficulty, hasPredictedThisTurn, isPredictionMode, predictedFrom, predictedTo, moveHistory]);

  // 7. Core Sidebar Commands
  const handleUndo = () => {
    if (moveHistory.length === 0) return;

    // Reset history viewer indexing
    setCurrentMoveIndex(-1);

    // Reset prediction states
    setIsPredictionMode(false);
    setPredictedFrom(null);
    setPredictedTo(null);
    setHasPredictedThisTurn(false);
    setLastPredictionResult(null);
    setPredictionRecords((prev) => prev.slice(0, prev.length - 1));

    const tempGame = new Chess();

    // If vs computer, undo BOTH player's move and Computer AI's move
    if (gameMode === 'vs-computer' && moveHistory.length >= 2) {
      const targetMove = moveHistory[moveHistory.length - 3];
      if (targetMove) {
        tempGame.load(targetMove.fenAfter);
        setGame(tempGame);
        setMoveHistory((prev) => prev.slice(0, prev.length - 2));
        const prevMove = moveHistory[moveHistory.length - 4];
        setLastMove(prevMove ? { from: prevMove.from, to: prevMove.to } : null);
      } else {
        // Revert to starting layout
        setGame(new Chess());
        setMoveHistory([]);
        setLastMove(null);
        setIsTimerRunning(false);
        setFlaggedWinner(null);
      }
    } else {
      // In Pass-and-play, undo single ply
      const targetMove = moveHistory[moveHistory.length - 2];
      if (targetMove) {
        tempGame.load(targetMove.fenAfter);
        setGame(tempGame);
        setMoveHistory((prev) => prev.slice(0, prev.length - 1));
        const prevMove = moveHistory[moveHistory.length - 3];
        setLastMove(prevMove ? { from: prevMove.from, to: prevMove.to } : null);
      } else {
        setGame(new Chess());
        setMoveHistory([]);
        setLastMove(null);
        setIsTimerRunning(false);
        setFlaggedWinner(null);
      }
    }
    playSound('move');
  };

  const handleResetMatch = (force = false) => {
    if (!force && moveHistory.length > 0 && !game.isGameOver() && !flaggedWinner && !resignedWinner) {
      setShowExitConfirm(true);
      return;
    }

    setGame(new Chess());
    setMoveHistory([]);
    setCurrentMoveIndex(-1);
    setLastMove(null);
    setSelectedSquare(null);
    setIsThinking(false);
    setFlaggedWinner(null);
    setResignedWinner(null);
    setShowResignConfirm(false);

    // Reset prediction states
    setIsPredictionMode(false);
    setPredictedFrom(null);
    setPredictedTo(null);
    setHasPredictedThisTurn(false);
    setLastPredictionResult(null);
    setPredictionRecords([]);

    if (clockSetting !== null) {
      const secs = clockSetting * 60;
      setWhiteTime(secs);
      setBlackTime(secs);
    }
    setIsTimerRunning(false);
    setShowExitConfirm(false);
    setShowGameOverModal(false);
    playSound('move');
  };

  const handleLoadFEN = (fen: string): boolean => {
    try {
      const temp = new Chess();
      // Validates and loads (throws on failure)
      temp.load(fen);
      setGame(temp);
      setMoveHistory([]);
      setCurrentMoveIndex(-1);
      setLastMove(null);
      setSelectedSquare(null);
      setFlaggedWinner(null);
      setIsTimerRunning(false);
      playSound('check');

      // Reset prediction states
      setIsPredictionMode(false);
      setPredictedFrom(null);
      setPredictedTo(null);
      setHasPredictedThisTurn(false);
      setLastPredictionResult(null);

      return true;
    } catch (_) {}
    return false;
  };

  // 8. Analyze Match Outcomes Text
  const { gameStatus, gameWinner } = useMemo(() => {
    if (resignedWinner) {
      return {
        gameStatus: `Resignation! ${resignedWinner === 'w' ? 'White' : 'Black'} wins`,
        gameWinner: resignedWinner,
      };
    }

    if (flaggedWinner) {
      return {
        gameStatus: `${flaggedWinner === 'w' ? 'White' : 'Black'} wins on time!`,
        gameWinner: flaggedWinner,
      };
    }

    if (game.isGameOver()) {
      if (game.isCheckmate()) {
        const loserColor = game.turn();
        const winner = loserColor === 'w' ? 'b' : 'w';
        return {
          gameStatus: `Checkmate! ${winner === 'w' ? 'White' : 'Black'} wins`,
          gameWinner: winner,
        };
      }
      if (game.isStalemate()) {
        return {
          gameStatus: `Draw (Stalemate)`,
          gameWinner: 'Draw',
        };
      }
      if (game.isThreefoldRepetition()) {
        return {
          gameStatus: `Draw (Threefold repetition)`,
          gameWinner: 'Draw',
        };
      }
      if (game.isInsufficientMaterial()) {
        return {
          gameStatus: `Draw (Insufficient Material)`,
          gameWinner: 'Draw',
        };
      }
      return {
        gameStatus: `Draw`,
        gameWinner: 'Draw',
      };
    }

    if (game.inCheck()) {
      return {
        gameStatus: `Check! (${game.turn() === 'w' ? 'White' : 'Black'}'s Turn)`,
        gameWinner: null,
      };
    }

    return {
      gameStatus: `${game.turn() === 'w' ? 'White' : 'Black'}'s Turn`,
      gameWinner: null,
    };
  }, [game, flaggedWinner, resignedWinner]);

  // 10. Prediction statistics for Game Over Performance modal
  const totalPredictionsSum = predictionRecords.length;
  const totalPointsEarnedSum = predictionRecords.reduce((sum, rec) => sum + rec.scoreEarned, 0);
  const exactMatchesCountSum = predictionRecords.filter(rec => rec.scoreEarned === 1.0).length;
  const partialMatchesCountSum = predictionRecords.filter(rec => rec.scoreEarned === 0.4).length;
  const missesCountSum = predictionRecords.filter(rec => rec.scoreEarned === 0).length;
  const predictionScorePercentageSum = totalPredictionsSum > 0 ? Math.round((totalPointsEarnedSum / totalPredictionsSum) * 100) : 0;

  let feedbackPhraseSum = "Solid positioning sense. With more practice, you'll anticipate like a grandmaster!";
  if (predictionScorePercentageSum < 40) {
    feedbackPhraseSum = "Keep practicing your spatial awareness!";
  } else if (predictionScorePercentageSum > 70) {
    feedbackPhraseSum = "Excellent grandmaster-level anticipation!";
  }

  return (
    <div className="min-h-screen bg-natural-bg text-natural-text flex flex-col font-sans transition-colors duration-200">
      {/* Premium Theme Layout Header */}
      <header className="w-full h-16 border-b border-stone-200 bg-white px-6 md:px-8 flex items-center justify-between shrink-0 shadow-xs mb-6 select-none">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-natural-accent rounded-lg flex items-center justify-center text-white text-2xl font-serif">♘</div>
          <h1 className="text-xl md:text-2xl font-serif italic font-bold text-natural-accent">Grandmaster Chess</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs md:text-sm font-medium text-stone-600">Live Game</span>
          </div>
          <div className="hidden sm:block text-xs md:text-sm text-stone-500">
            Opponent: <span className="font-bold text-stone-700">{gameMode === 'vs-computer' ? `AI Level ${aiDifficulty}` : 'Local Friend'}</span>
          </div>
        </div>
      </header>

      {/* Main Container Frame limits width */}
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 flex-1 flex flex-col lg:flex-row gap-6 items-stretch">
        
        {/* Chess Board Panel (Left Side on Desktop) */}
        <div className="flex-1 flex flex-col gap-4 justify-center">
          
          {/* Opponent Info Bar */}
          <PlayerBar
            game={game}
            barColor={isFlipped ? 'w' : 'b'}
            name={
              gameMode === 'vs-computer'
                ? isFlipped
                  ? 'You' 
                  : `Computer AI (Level: ${aiDifficulty})`
                : isFlipped
                  ? 'Player 1'
                  : 'Player 2'
            }
            isComputer={gameMode === 'vs-computer' && !isFlipped}
            timeLeft={isFlipped ? whiteTime : blackTime}
            isActive={!isFlipped ? activeTurn === 'b' && !game.isGameOver() : activeTurn === 'w' && !game.isGameOver()}
            isFlipped={isFlipped}
          />

          {/* Core Interactive Chessboard */}
          <div className="relative">
            {/* History review floating banner */}
            {currentMoveIndex !== -1 && (
              <div className="absolute inset-x-0 -top-1 bg-amber-100 border border-amber-200 text-stone-850 py-1.5 px-4 font-semibold text-xs text-center rounded-t-lg z-40 shadow-xs flex items-center justify-center gap-1.5 select-none animate-fade-in font-sans">
                <span>Viewing history move #{currentMoveIndex + 1}. Live match is paused.</span>
                <button
                  onClick={() => setCurrentMoveIndex(-1)}
                  className="px-2 py-0.5 bg-stone-800 text-white rounded font-bold text-[10px] hover:bg-stone-900 transition-colors uppercase"
                >
                  Return
                </button>
              </div>
            )}            <ChessBoard
              game={displayGame}
              onMove={makeMove}
              isFlipped={isFlipped}
              theme={boardTheme}
              selectedSquare={selectedSquare}
              setSelectedSquare={setSelectedSquare}
              lastMove={lastMove}
              interactive={currentMoveIndex === -1 && !game.isGameOver() && !flaggedWinner && !resignedWinner && !isThinking && (gameMode !== 'vs-computer' || game.turn() === 'w')}
              isPredictionMode={isPredictionMode}
              predictedFromSquare={predictedFrom}
              predictedToSquare={predictedTo}
              onPredictionSquareClick={handlePredictionSquareClick}
            />

            {/* Simulated CPU thinking overlay */}
            {isThinking && (
              <div className="absolute inset-0 bg-stone-950/15 rounded-lg backdrop-blur-[1px] flex flex-col items-center justify-center z-30 select-none animate-fade-in animate-duration-100">
                <div className="flex items-center gap-2 bg-white/95 py-3 px-6 rounded-xl border border-stone-200 shadow-xl">
                  <div className="w-4 h-4 border-2 border-natural-accent border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-xs font-bold text-natural-text font-sans tracking-tight">AI is contemplating...</span>
                </div>
              </div>
            )}
          </div>

          {/* Prediction Mode Panel (rendered outside Chessboard to never overlap) */}
          {isPredictionMode && (
            <div id="prediction-panel" className="w-full bg-white border border-stone-200 rounded-xl shadow-md p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in pointer-events-auto">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 shrink-0 font-serif text-lg">
                  🔮
                </div>
                <div className="text-left">
                  <h4 className="text-xs md:text-sm font-serif italic text-stone-800 font-bold">Prediction Phase</h4>
                  <p className="text-[10px] md:text-xs text-stone-500 leading-tight">
                    Where do you think your opponent will play next? Tap the starting square, then the destination square on the board.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-bold text-stone-400 font-mono tracking-wider">Your Guess</span>
                  <span className="text-xs font-mono font-bold text-stone-700 bg-stone-100 border border-stone-200 px-2.5 py-0.5 rounded mt-0.5 min-w-[70px] text-center">
                    {predictedFrom ? predictedFrom.toUpperCase() : '__'} ➔ {predictedTo ? predictedTo.toUpperCase() : '__'}
                  </span>
                </div>
                <button
                  id="btn-confirm-prediction"
                  onClick={handleConfirmPrediction}
                  disabled={!predictedFrom || !predictedTo}
                  className={`py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                    predictedFrom && predictedTo
                      ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-md hover:scale-102 active:scale-98 cursor-pointer'
                      : 'bg-stone-50 border border-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  Confirm Prediction
                </button>
              </div>
            </div>
          )}

          {/* Prediction Validation Outcome Alert (rendered outside Chessboard to never overlap) */}
          {!isPredictionMode && lastPredictionResult && (
            <div id="prediction-outcome-panel" className={`w-full border rounded-xl shadow-md p-3.5 flex items-center justify-between gap-3 animate-fade-in pointer-events-auto ${
              lastPredictionResult.scoreEarned === 1.0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : lastPredictionResult.scoreEarned === 0.4
                  ? 'bg-sky-50 border-sky-100 text-sky-950'
                  : 'bg-stone-50 border-stone-200 text-stone-700'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-md leading-none ${
                  lastPredictionResult.scoreEarned === 1.0 
                    ? 'bg-emerald-100 text-emerald-600' 
                    : lastPredictionResult.scoreEarned === 0.4
                      ? 'bg-sky-100 text-sky-600'
                      : 'bg-stone-100 text-stone-500'
                }`}>
                  {lastPredictionResult.scoreEarned === 1.0 ? '🎉' : lastPredictionResult.scoreEarned === 0.4 ? '⚡' : '❌'}
                </div>
                <div className="text-left leading-tight">
                  <h4 className="text-xs md:text-sm font-serif italic font-bold">
                    {lastPredictionResult.scoreEarned === 1.0 
                      ? 'Exact Match! +1.0 Point' 
                      : lastPredictionResult.matchType === 'partial-start'
                        ? 'Correct Piece/Start! +0.4 Points'
                        : lastPredictionResult.matchType === 'partial-end'
                          ? 'Correct Destination! +0.4 Points'
                          : 'Miss! +0 Points'
                    }
                  </h4>
                  <p className="text-[10px] md:text-xs text-stone-505 mt-0.5 leading-snug">
                    {lastPredictionResult.scoreEarned === 1.0 
                      ? `Magnificent accuracy! You predicted the computer's exact play of ${lastPredictionResult.actualFrom.toUpperCase()} ➔ ${lastPredictionResult.actualTo.toUpperCase()}!`
                      : lastPredictionResult.scoreEarned === 0.4
                        ? `Partial Credit! Predicted ${lastPredictionResult.predictedFrom.toUpperCase()} ➔ ${lastPredictionResult.predictedTo.toUpperCase()}, computer selected ${lastPredictionResult.actualFrom.toUpperCase()} ➔ ${lastPredictionResult.actualTo.toUpperCase()}.`
                        : `Predicted ${lastPredictionResult.predictedFrom.toUpperCase()} ➔ ${lastPredictionResult.predictedTo.toUpperCase()}, but opponent played ${lastPredictionResult.actualFrom.toUpperCase()} ➔ ${lastPredictionResult.actualTo.toUpperCase()}.`
                    }
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLastPredictionResult(null)}
                className="text-stone-400 hover:text-stone-600 text-xs font-bold px-2.5 py-1 hover:bg-stone-100/50 rounded-lg transition-colors border border-transparent hover:border-stone-200 cursor-pointer shrink-0"
              >
                Close
              </button>
            </div>
          )}

          {/* Local User Info Bar */}
          <PlayerBar
            game={game}
            barColor={isFlipped ? 'b' : 'w'}
            name={
              gameMode === 'vs-computer'
                ? isFlipped
                  ? `Computer AI (Level: ${aiDifficulty})`
                  : 'You'
                : isFlipped
                  ? 'Player 2'
                  : 'Player 1'
            }
            isComputer={gameMode === 'vs-computer' && isFlipped}
            timeLeft={isFlipped ? blackTime : whiteTime}
            isActive={isFlipped ? activeTurn === 'b' && !game.isGameOver() && !flaggedWinner && !resignedWinner : activeTurn === 'w' && !game.isGameOver() && !flaggedWinner && !resignedWinner}
            isFlipped={isFlipped}
          />
        </div>

        {/* Sidebar Configuration Panel (Right Side on Desktop) */}
        <div className="w-full lg:w-[410px] shrink-0">
          <Sidebar
            game={game}
            moveHistory={moveHistory}
            currentMoveIndex={currentMoveIndex}
            onSelectMoveIndex={setCurrentMoveIndex}
            gameMode={gameMode}
            onSetGameMode={setGameMode}
            aiDifficulty={aiDifficulty}
            onSetAiDifficulty={setAiDifficulty}
            boardTheme={boardTheme}
            onSetBoardTheme={setBoardTheme}
            clockSetting={clockSetting}
            onSetClockSetting={setClockSetting}
            onUndo={handleUndo}
            onReset={() => handleResetMatch(false)}
            onFlipBoard={() => setIsFlipped(!isFlipped)}
            onLoadFEN={handleLoadFEN}
            gameStatus={gameStatus}
            gameWinner={gameWinner}
            hasTimer={clockSetting !== null}
            predictionRecords={predictionRecords}
            onShowSummary={() => setShowGameOverModal(true)}
            isGameActive={!game.isGameOver() && !flaggedWinner && !resignedWinner}
            onResign={() => setShowResignConfirm(true)}
          />
        </div>
      </div>

      {/* Resign Chess Match Confirmation Modal */}
      {showResignConfirm && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <h3 className="text-[#3d3d2e] text-md font-serif italic font-bold mb-2">Confirm Resignation?</h3>
            <p className="text-stone-500 text-xs mb-6">Are you sure you want to resign the game? Your opponent will be declared the winner.</p>
            <div className="flex gap-2 justify-end">
              <button
                id="btn-cancel-resign"
                onClick={() => setShowResignConfirm(false)}
                className="py-1.5 px-4 bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                No, Keep Playing
              </button>
              <button
                id="btn-confirm-resign"
                onClick={() => {
                  const currentTurn = game.turn();
                  const winnerColor = currentTurn === 'w' ? 'b' : 'w';
                  setResignedWinner(winnerColor);
                  setIsTimerRunning(false);
                  setShowResignConfirm(false);
                  playSound('gameover');
                }}
                className="py-1.5 px-4 bg-red-50 hover:bg-red-100 text-red-750 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                🏳️ Yes, Resign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Exit Modal Overlay */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <h3 className="text-[#3d3d2e] text-md font-serif italic font-bold mb-2">Restart Chess Match?</h3>
            <p className="text-stone-500 text-xs mb-6">Are you sure you want to end this active match and clear the board? Active progress will be lost.</p>
            <div className="flex gap-2 justify-end">
              <button
                id="btn-cancel-exit"
                onClick={() => setShowExitConfirm(false)}
                className="py-1.5 px-4 bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 rounded-lg text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                id="btn-confirm-exit"
                onClick={() => handleResetMatch(true)}
                className="py-1.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                Yes, Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Performance Summary Dashboard Modal Overlay */}
      {showGameOverModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-stone-200 rounded-3xl p-8 shadow-2xl max-w-md w-full relative text-center">
            {/* Medal graphic adornment */}
            <div className="w-16 h-16 bg-gradient-to-tr from-sky-100 to-sky-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-sky-100/60 shadow-inner">
              <span className="text-3xl">🏆</span>
            </div>
            
            <h3 className="text-stone-850 text-xl font-serif italic font-bold mb-1">Match Concluded!</h3>
            <p className="text-stone-500 text-xs mb-6 px-4">
              Thank you for playing. Here is your prediction scorecard analysis for the computer moves.
            </p>

            {totalPredictionsSum === 0 ? (
              <div className="py-6 border border-dashed border-stone-200 rounded-2xl mb-6 bg-stone-50/50">
                <span className="text-3xl block mb-2">♟️</span>
                <h4 className="text-xs font-serif font-bold text-stone-700">No predictions recorded this game</h4>
                <p className="text-[10px] text-stone-500 max-w-[240px] mx-auto mt-1 leading-normal">
                  Toggle <strong className="text-stone-600">Vs-Computer</strong> mode during your next match and tap anticipated moves in real-time to track metrics!
                </p>
              </div>
            ) : (
              <>
                {/* SVG Circular Progress Ring */}
                <div className="relative w-40 h-40 mx-auto mb-6 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    {/* Background circle */}
                    <circle
                      cx="80"
                      cy="80"
                      r="64"
                      className="stroke-stone-100 fill-none"
                      strokeWidth="10"
                    />
                    {/* Active progress ring arc */}
                    <circle
                      cx="80"
                      cy="80"
                      r="64"
                      className="stroke-sky-600 fill-none transition-all duration-1000 ease-out"
                      strokeWidth="10"
                      strokeDasharray={2 * Math.PI * 64}
                      strokeDashoffset={2 * Math.PI * 64 - (predictionScorePercentageSum / 100) * (2 * Math.PI * 64)}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Central Text HUD */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                    <span className="text-3xl font-serif font-bold text-stone-850">
                      {predictionScorePercentageSum}%
                    </span>
                    <span className="text-[9px] font-mono tracking-wider font-bold text-stone-400 uppercase mt-1">
                      Accuracy Score
                    </span>
                  </div>
                </div>

                {/* Score formula visualization */}
                <div className="mb-6">
                  <div className="bg-stone-50 border border-stone-150 rounded-xl py-2 px-3 inline-flex items-center gap-2 text-xs text-stone-500 font-mono">
                    <span className="text-[10px] uppercase font-bold text-stone-400">Score</span>
                    <span className="text-stone-300">|</span>
                    <span className="font-bold text-stone-700">
                      ({totalPointsEarnedSum.toFixed(1)} / {totalPredictionsSum}) × 100%
                    </span>
                    <span>=</span>
                    <span className="font-bold text-sky-700">{predictionScorePercentageSum}%</span>
                  </div>
                </div>

                {/* Feedback statement based on accuracy bracket */}
                <div className="bg-sky-50/50 border border-sky-100/60 rounded-2xl p-4 mb-6">
                  <p className="text-xs text-sky-900 leading-snug font-sans font-medium italic">
                    &ldquo;{feedbackPhraseSum}&rdquo;
                  </p>
                </div>

                {/* Breakdown Grid stats */}
                <div className="grid grid-cols-3 gap-2.5 mb-8">
                  <div className="bg-white border border-stone-200 p-2.5 rounded-xl text-center">
                    <span className="text-[9px] uppercase tracking-wider text-stone-400 font-mono font-bold block">Exact</span>
                    <span className="text-sm font-serif font-bold text-emerald-600 block mt-1">{exactMatchesCountSum} Match{exactMatchesCountSum !== 1 ? 'es' : ''}</span>
                    <span className="text-[8px] text-stone-400 font-mono font-semibold block mt-0.5">1.0 Pt / match</span>
                  </div>
                  <div className="bg-white border border-stone-200 p-2.5 rounded-xl text-center">
                    <span className="text-[9px] uppercase tracking-wider text-stone-400 font-mono font-bold block">Partial</span>
                    <span className="text-sm font-serif font-bold text-sky-600 block mt-1">{partialMatchesCountSum} Hit{partialMatchesCountSum !== 1 ? 's' : ''}</span>
                    <span className="text-[8px] text-stone-400 font-mono font-semibold block mt-0.5">0.4 Pt / hit</span>
                  </div>
                  <div className="bg-white border border-stone-200 p-2.5 rounded-xl text-center">
                    <span className="text-[9px] uppercase tracking-wider text-stone-400 font-mono font-bold block">Misses</span>
                    <span className="text-sm font-serif font-bold text-stone-500 block mt-1">{missesCountSum} Miss{missesCountSum !== 1 ? 'es' : ''}</span>
                    <span className="text-[8px] text-stone-400 font-mono font-semibold block mt-0.5">0.0 Pt / miss</span>
                  </div>
                </div>
              </>
            )}

            {/* Actions for Modal */}
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                id="btn-close-game-over-summary"
                onClick={() => setShowGameOverModal(false)}
                className="py-2.5 px-5 bg-white border border-stone-200 text-stone-600 rounded-xl text-xs font-bold transition hover:bg-stone-50 cursor-pointer sm:flex-1 font-sans"
              >
                Close & Review Board
              </button>
              <button
                id="btn-play-again-dashboard"
                onClick={() => handleResetMatch(true)}
                className="py-2.5 px-5 bg-sky-600 hover:bg-sky-700 text-white border border-transparent rounded-xl text-xs font-bold transition shadow-md hover:scale-102 active:scale-98 cursor-pointer sm:flex-1 font-sans"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Elegant Footer conforming to Natural Tones mockup */}
      <footer className="w-full h-12 border-t border-stone-200 bg-white px-6 md:px-8 flex items-center justify-between text-[11px] md:text-xs text-stone-400 mt-8 select-none shrink-0">
        <div>Engine Mode: Stockfish 16.1 (Simulated local PST)</div>
        <div className="flex gap-4 italic font-medium text-stone-500">
          <span>FIDE Grandmaster Standards Compliant</span>
          <span>&copy; {new Date().getFullYear()} Grandmaster Chess Academy</span>
        </div>
      </footer>
    </div>
  );
}
