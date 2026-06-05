/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardTheme, BoardThemeConfig } from '../types';

export const THEMES: Record<BoardTheme, BoardThemeConfig> = {
  natural: {
    name: 'Natural Tones',
    light: '#E6E1D3',
    dark: '#7A7A5D',
    highlight: 'rgba(92, 92, 64, 0.45)',
    selected: 'rgba(92, 92, 64, 0.70)',
    legalDot: 'rgba(40, 40, 30, 0.22)',
    legalCapture: 'rgba(239, 68, 68, 0.55)',
  },
  emerald: {
    name: 'Emerald Slate',
    light: '#eeeed2',
    dark: '#769656',
    highlight: 'rgba(247, 247, 105, 0.5)',
    selected: 'rgba(247, 247, 105, 0.75)',
    legalDot: 'rgba(0, 0, 0, 0.18)',
    legalCapture: 'rgba(239, 68, 68, 0.45)',
  },
  wood: {
    name: 'Classic Walnut',
    light: '#f0d9b5',
    dark: '#b58863',
    highlight: 'rgba(130, 151, 105, 0.5)',
    selected: 'rgba(230, 204, 153, 0.75)',
    legalDot: 'rgba(0, 0, 0, 0.22)',
    legalCapture: 'rgba(224, 80, 80, 0.5)',
  },
  ice: {
    name: 'Arctic Frost',
    light: '#e2e8f0',
    dark: '#475569',
    highlight: 'rgba(56, 189, 248, 0.4)',
    selected: 'rgba(14, 165, 233, 0.6)',
    legalDot: 'rgba(51, 65, 85, 0.25)',
    legalCapture: 'rgba(244, 63, 94, 0.55)',
  },
  obsidian: {
    name: 'Midnight Onyx',
    light: '#e4e4e7',
    dark: '#27272a',
    highlight: 'rgba(161, 161, 170, 0.35)',
    selected: 'rgba(161, 161, 170, 0.55)',
    legalDot: 'rgba(24, 24, 27, 0.25)',
    legalCapture: 'rgba(239, 68, 68, 0.55)',
  },
};
