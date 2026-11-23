import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-800.css';
import './ui/styles/theme.css';
import './ui/styles/pages.css';
import './ui/styles/table.css';
import './ui/styles/trainers.css';
import './ui/styles/charts.css';
import './ui/styles/stats.css';
import { initCloud } from './net/cloud';
import { usePrefs } from './store/prefsStore';
import { warmCards } from './ui/cards/cardArt';
import { whenIdle } from './ui/sounds';
import { App } from './ui/App';
import { registerOffline } from './pwa';

initCloud();
registerOffline();
warmCards(usePrefs.getState().fourColor ? 'four' : 'two', (cb) => whenIdle(cb, { timeout: 2000 }));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
