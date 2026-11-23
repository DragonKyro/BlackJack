// Offline: the service worker (vite-plugin-pwa / Workbox) precaches the whole
// app — fonts and the Firebase SDK included — so after the first visit it
// opens and plays with no connection. A new build installs in the background;
// the reload that switches to it waits until you're on a page without a
// table in play (home, setups, charts, stats).

import { registerSW } from 'virtual:pwa-register';

const atTable = () => /^#\/(play|strategy|counting|bet|smart)\/go/.test(window.location.hash);

function reloadWhenIdle(): void {
  if (!atTable()) {
    window.location.reload();
    return;
  }
  const onNav = () => {
    if (atTable()) return;
    window.removeEventListener('hashchange', onNav);
    window.location.reload();
  };
  window.addEventListener('hashchange', onNav);
}

export function registerOffline(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  registerSW({ immediate: true, onNeedReload: reloadWhenIdle });
}
