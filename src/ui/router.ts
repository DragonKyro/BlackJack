// Hash routes, so the phone's back button walks back through the app and
// GitHub Pages needs no rewrites:
//   #/                       home
//   #/play  #/play/go        a mode's setup, then the mode itself
//   (likewise strategy, counting, bet, smart)
//   #/charts/hard            strategy charts (hard, soft, pairs, deviations)
//   #/spread                 bet spread analyzer
//   #/stats/heatmap          stats (summary, heatmap, trend, sessions)

import { useSyncExternalStore } from 'react';

export type Mode = 'play' | 'strategy' | 'counting' | 'bet' | 'smart';
export type ChartTab = 'hard' | 'soft' | 'pairs' | 'deviations';
export type StatsTab = 'summary' | 'heatmap' | 'trend' | 'sessions';

export type Route =
  | { name: 'home' }
  | { name: 'mode'; mode: Mode; go: boolean }
  | { name: 'charts'; tab: ChartTab }
  | { name: 'spread' }
  | { name: 'stats'; tab: StatsTab };

const MODES: Mode[] = ['play', 'strategy', 'counting', 'bet', 'smart'];
const CHART_TABS: ChartTab[] = ['hard', 'soft', 'pairs', 'deviations'];
const STATS_TABS: StatsTab[] = ['summary', 'heatmap', 'trend', 'sessions'];

export function parseHash(hash: string): Route {
  const [a, b] = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (MODES.includes(a as Mode)) return { name: 'mode', mode: a as Mode, go: b === 'go' };
  if (a === 'charts') return { name: 'charts', tab: CHART_TABS.includes(b as ChartTab) ? (b as ChartTab) : 'hard' };
  if (a === 'spread') return { name: 'spread' };
  if (a === 'stats') return { name: 'stats', tab: STATS_TABS.includes(b as StatsTab) ? (b as StatsTab) : 'summary' };
  return { name: 'home' };
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseHash(hash);
}

export const paths = {
  home: '#/',
  setup: (m: Mode) => `#/${m}`,
  go: (m: Mode) => `#/${m}/go`,
  charts: (t: ChartTab = 'hard') => `#/charts/${t}`,
  spread: '#/spread',
  stats: (t: StatsTab = 'summary') => `#/stats/${t}`,
};

/** Pages pushed by go() this visit, so an in-app "back" knows whether history.back() stays in the app. */
let pushed = 0;

/** Navigate; `replace` swaps the current history entry (no extra back step). */
export function go(path: string, replace = false): void {
  if (replace) {
    window.location.replace(path);
  } else {
    pushed++;
    window.location.hash = path.slice(1);
  }
}

/** Back through history when we got here within the app, else straight to `fallback`. */
export function back(fallback: string): void {
  if (pushed > 0) {
    pushed--;
    window.history.back();
  } else {
    go(fallback, true);
  }
}
