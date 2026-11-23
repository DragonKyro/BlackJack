// Playing cards on screen. CardImg is the bare art; TableCard is a card dealt
// onto the felt: it flies in from the shoe on mount (turning face up on the
// way unless it's dealt face down), turns over when `down` flips, slides
// across when it moves to a new hand (a split), and flies to the discard tray
// when `sweep` is set.
//
// Cheap at rest: a card is a flat element with one image. Only while it
// turns over does it get the 3D context and both faces.

import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { cardLabel, type Card } from '@/bj/cards';
import { paceMs, usePrefs } from '@/store/prefsStore';
import { anchorRect, prefersReducedMotion } from '../table/anchors';
import { cardSrc, type CardLayout } from './cardArt';

export function CardImg({ card, layout = 'full' }: { card: Card | null; layout?: CardLayout }) {
  const fourColor = usePrefs((s) => s.fourColor);
  return <img className="card-img" src={cardSrc(card, layout, fourColor ? 'four' : 'two')} alt={card ? cardLabel(card) : 'card back'} draggable={false} decoding="sync" />;
}

export function CardView({ card, layout = 'full', className, style }: { card: Card | null; layout?: CardLayout; className?: string; style?: CSSProperties }) {
  return (
    <span className={`card${className ? ` ${className}` : ''}`} style={style}>
      <CardImg card={card} layout={layout} />
    </span>
  );
}

function center(r: DOMRect) {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Where cards that just left the table were (by card), so a split card slides instead of flying from the shoe. */
const departed = new Map<Card, { rect: DOMRect; at: number }>();
const DEPART_MS = 300;

const canAnimate = (el: HTMLElement | null) => !!el && !!el.animate && !prefersReducedMotion();

type Turn = 'deal' | 'reveal' | null;

export const TableCard = memo(function TableCard({
  card,
  down = false,
  fly = true,
  sweep = false,
  layout = 'full',
  className,
  style,
  flightMs,
}: {
  card: Card;
  /** Face down (the hole card until it's turned). */
  down?: boolean;
  /** Fly in from the shoe on mount. */
  fly?: boolean;
  /** Fly to the discard tray (the round is being cleared). */
  sweep?: boolean;
  layout?: CardLayout;
  className?: string;
  style?: CSSProperties;
  /** Flight duration (defaults to the pace setting). */
  flightMs?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const speed = usePrefs((s) => s.speed);
  const ms = flightMs ?? paceMs(speed).flight;
  // Mounting face up from the shoe: it turns over on the way in.
  const [turn, setTurn] = useState<Turn>(() => (fly && !down && !prefersReducedMotion() && !departed.has(card) ? 'deal' : null));
  const wasDown = useRef(down);
  const swept = useRef(false);

  // Mount: fly in from the shoe, or slide from where the card just was (split).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !canAnimate(el)) return;
    const to = el.getBoundingClientRect();
    const b = center(to);
    const left = departed.get(card);
    departed.delete(card);
    if (left && performance.now() - left.at < DEPART_MS) {
      const a = center(left.rect);
      el.animate([{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px)` }, { transform: 'none' }], { duration: Math.round(ms * 0.8), easing: 'cubic-bezier(.2,.8,.2,1)' });
      return;
    }
    const from = anchorRect('shoe');
    if (!from || !fly) return;
    const a = center(from);
    const s = to.width > 0 ? Math.min(1, (from.width * 0.6) / to.width) : 0.7;
    el.animate(
      [
        { transform: `translate(${a.x - b.x}px, ${a.y - b.y}px) rotate(-28deg) scale(${s})`, opacity: 0.4 },
        { opacity: 1, offset: 0.12 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: ms, easing: 'cubic-bezier(.2,.85,.25,1)' },
    );
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unmount: remember where it was (unless it was swept away).
  useLayoutEffect(() => {
    const el = ref.current;
    return () => {
      if (el && !swept.current && el.isConnected) departed.set(card, { rect: el.getBoundingClientRect(), at: performance.now() });
    };
  }, [card]);

  // The hole card turned face up.
  useLayoutEffect(() => {
    if (wasDown.current && !down && canAnimate(ref.current)) setTurn('reveal');
    wasDown.current = down;
  }, [down]);

  // While turning: both faces in 3D, the inner element rotates, then back to flat.
  useLayoutEffect(() => {
    const inner = ref.current?.querySelector<HTMLElement>('.tcard-inner');
    if (!turn || !inner) return;
    const frames = turn === 'deal' ? [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(180deg)', offset: 0.35 }, { transform: 'rotateY(0deg)' }] : [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }];
    const a = inner.animate(frames, { duration: turn === 'deal' ? ms : 460, easing: 'cubic-bezier(.3,.7,.3,1.1)' });
    a.onfinish = () => setTurn(null);
    return () => a.cancel();
  }, [turn, ms]);

  // The sweep to the discard tray (no turning: just away).
  useEffect(() => {
    const el = ref.current;
    if (!sweep || !el) return;
    swept.current = true;
    const to = anchorRect('discard');
    if (!to || !canAnimate(el)) {
      el.style.opacity = '0';
      return;
    }
    const a = center(el.getBoundingClientRect());
    const b = center(to);
    const from = el.getBoundingClientRect();
    const s = from.width > 0 ? Math.min(1, (to.width * 0.55) / from.width) : 0.6;
    el.animate([{ transform: 'none' }, { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) rotate(${(Math.random() * 30 - 15).toFixed(1)}deg) scale(${s})`, opacity: 0 }], {
      duration: Math.round(ms * 0.85),
      easing: 'cubic-bezier(.55,0,.75,.25)',
      fill: 'forwards',
    });
  }, [sweep, ms]);

  const turning = turn !== null;
  return (
    <span ref={ref} className={`tcard${turning ? ' is-turning' : ''}${className ? ` ${className}` : ''}`} style={style} data-card={card}>
      <span className="tcard-inner">
        {(turning || !down) && (
          <span className="tcard-face card" aria-hidden={down}>
            <CardImg card={card} layout={layout} />
          </span>
        )}
        {(turning || down) && (
          <span className="tcard-back card" aria-hidden>
            <CardImg card={null} />
          </span>
        )}
      </span>
    </span>
  );
});
