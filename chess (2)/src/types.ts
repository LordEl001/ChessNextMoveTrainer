/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameMode = 'pass-and-play' | 'vs-computer';
export type AIDifficulty = number;

export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type Color = 'w' | 'b';

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface MoveLog {
  id: string;
  san: string;
  from: string;
  to: string;
  color: Color;
  fenBefore: string;
  fenAfter: string;
}

export type BoardTheme = 'natural' | 'emerald' | 'wood' | 'ice' | 'obsidian';

export interface BoardThemeConfig {
  name: string;
  light: string;
  dark: string;
  highlight: string;
  selected: string;
  legalDot: string;
  legalCapture: string;
}

export interface ClockSetting {
  name: string;
  seconds: number | null; // null for infinite
}

export interface GameStats {
  whiteCaptured: PieceType[];
  blackCaptured: PieceType[];
  materialDifference: number; // Positive = White is up, Negative = Black is up
}

export interface PredictionRecord {
  moveNumber: number;
  predictedMove: { from: string; to: string };
  actualMove: { from: string; to: string };
  scoreEarned: number;
}

