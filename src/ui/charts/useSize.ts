// The rendered width of an element (charts draw in real pixels so text and
// line widths never scale with the container).

import { useLayoutEffect, useRef, useState } from 'react';

export function useWidth<T extends HTMLElement>(fallback = 320): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || fallback);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setW(Math.round(cw));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w];
}
