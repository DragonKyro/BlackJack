// Where the shoe and the discard tray are on screen, so cards can fly from
// one and to the other. UI only.

const els = new Map<'shoe' | 'discard' | 'tray', HTMLElement>();

export function setAnchor(name: 'shoe' | 'discard' | 'tray', el: HTMLElement | null): void {
  if (el) els.set(name, el);
  else els.delete(name);
}

export function anchorRect(name: 'shoe' | 'discard' | 'tray'): DOMRect | null {
  const el = els.get(name);
  if (!el || !el.isConnected) return null;
  return el.getBoundingClientRect();
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
