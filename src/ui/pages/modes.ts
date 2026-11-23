// The modes as the home page and the setups present them.

import type { IconName } from '../shared/Icon';
import type { Mode } from '../router';

export interface ModeInfo {
  name: string;
  blurb: string;
  icon: IconName;
  tone: '' | 'tone-red' | 'tone-green' | 'tone-blue' | 'tone-purple';
  keys: [string, string][];
}

export const MODE_INFO: Record<Mode, ModeInfo> = {
  play: {
    name: 'Play Blackjack',
    blurb: 'A full table: your bankroll, splits, doubles, insurance — with a coach on every play.',
    icon: 'coins',
    tone: '',
    keys: [
      ['Enter', 'deal / next hand'],
      ['← →', 'bet ± a minimum'],
      ['H S D P R', 'hit, stand, double, split, surrender'],
      ['Y N', 'insurance'],
      ['T', 'strategy chart'],
    ],
  },
  strategy: {
    name: 'Strategy Trainer',
    blurb: 'Rapid-fire basic strategy decisions with instant feedback. Smart mode drills your weak spots.',
    icon: 'bolt',
    tone: 'tone-green',
    keys: [
      ['H S D P R', 'your play'],
      ['any key', 'next hand'],
      ['T', 'strategy chart'],
      ['Esc', 'back'],
    ],
  },
  counting: {
    name: 'Counting Trainer',
    blurb: 'Keep the Hi-Lo running count while a full table plays out. You’re asked every few cards.',
    icon: 'eye',
    tone: 'tone-blue',
    keys: [
      ['0–9 −', 'type the count'],
      ['Enter', 'answer / continue'],
      ['Space', 'pause / resume'],
      ['Esc', 'back'],
    ],
  },
  bet: {
    name: 'Bet Trainer',
    blurb: 'Count, convert to a true count, and size your bet off the spread. The hands play themselves.',
    icon: 'target',
    tone: 'tone-purple',
    keys: [
      ['0–9 −', 'type'],
      ['Tab', 'count ↔ bet'],
      ['Enter', 'submit / continue'],
      ['Esc', 'back'],
    ],
  },
  smart: {
    name: 'Smart Trainer',
    blurb: 'Everything at once: count, bet and play your hand — all three graded.',
    icon: 'brain',
    tone: 'tone-red',
    keys: [
      ['0–9 −', 'type'],
      ['Tab', 'count ↔ bet'],
      ['Enter', 'submit / next'],
      ['H S D P R', 'your play'],
      ['T', 'strategy chart'],
    ],
  },
};
