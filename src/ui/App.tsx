// Routes: home, each mode's setup and table, the charts, the analyzer, stats.

import { useEffect } from 'react';
import { usePrefs } from '@/store/prefsStore';
import { useRoute } from './router';
import { Home } from './pages/Home';
import { SetupPage } from './pages/Setup';
import { PlayPage } from './pages/PlayPage';
import { StrategyTrainer } from './pages/StrategyTrainer';
import { CountingTrainer } from './pages/CountingTrainer';
import { BetTrainer } from './pages/BetTrainer';
import { SmartTrainer } from './pages/SmartTrainer';
import { ChartsPage } from './pages/ChartsPage';
import { SpreadPage } from './pages/SpreadPage';
import { StatsPage } from './pages/StatsPage';

export function App() {
  const route = useRoute();
  const fourColor = usePrefs((s) => s.fourColor);
  const key = route.name === 'mode' ? `${route.mode}-${route.go}` : route.name;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);

  return (
    <div className={`app${fourColor ? ' suits-four' : ''}`}>
      {route.name === 'home' && <Home />}
      {route.name === 'mode' && !route.go && <SetupPage key={route.mode} mode={route.mode} />}
      {route.name === 'mode' && route.go && route.mode === 'play' && <PlayPage />}
      {route.name === 'mode' && route.go && route.mode === 'strategy' && <StrategyTrainer />}
      {route.name === 'mode' && route.go && route.mode === 'counting' && <CountingTrainer />}
      {route.name === 'mode' && route.go && route.mode === 'bet' && <BetTrainer />}
      {route.name === 'mode' && route.go && route.mode === 'smart' && <SmartTrainer />}
      {route.name === 'charts' && <ChartsPage tab={route.tab} />}
      {route.name === 'spread' && <SpreadPage />}
      {route.name === 'stats' && <StatsPage tab={route.tab} />}
    </div>
  );
}
