// Playing cards on screen. CardImg is the bare art; TableCard is a card dealt
// onto the felt: it flies in from the shoe on mount (turning face up on the
// way unless it's dealt face down), turns over when `down` flips, and flies
// to the discard tray when `sweep` is set.

import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { cardLabel, type Card } from '@/bj/cards';
import { paceMs, usePrefs } from '@/store/prefsStore';
import { anchorRect, prefersReducedMotion } from '../table/anchors';
import { cardSrc, type CardLayout } from './cardArt';

export function CardImg({ card, layout = 'full' }: { card: Card | null; layout?: CardLayout }) {
  const fourColor = usePrefs((s) => s.fourColor);
  return <img className="card-img" src={cardSrc(card, layout, fourColor ? 'four' : 'two')} alt={card ? cardLabel(card) : 'card back'} draggable={false} />;
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

export function TableCard({
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

  useLayoutEffect(() => {
    const el = ref.current;
    const from = anchorRect('shoe');
    if (!el || !from || !fly || prefersReducedMotion() || !el.animate) return;
    const to = el.getBoundingClientRect();
    const a = center(from);
    const b = center(to);
    const s = to.width > 0 ? Math.min(1, (from.width * 0.6) / to.width) : 0.7;
    el.animate(
      [
        { transform: `translate(${a.x - b.x}px, ${a.y - b.y}px) rotate(-28deg) scale(${s})`, opacity: 0.4 },
        { opacity: 1, offset: 0.12 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: ms, easing: 'cubic-bezier(.2,.85,.25,1)' },
    );
    const inner = el.querySelector<HTMLElement>('.tcard-inner');
    if (inner && !down) {
      inner.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(180deg)', offset: 0.35 }, { transform: 'rotateY(0deg)' }], { duration: ms, easing: 'cubic-bezier(.3,.7,.3,1)' });
    }
    // Mount only: a card flies in once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!sweep || !el) return;
    const to = anchorRect('discard');
    if (!to || prefersReducedMotion() || !el.animate) {
      el.style.opacity = '0';
      return;
    }
    const from = el.getBoundingClientRect();
    const a = center(from);
    const b = center(to);
    const s = from.width > 0 ? Math.min(1, (to.width * 0.55) / from.width) : 0.6;
    const dur = Math.round(ms * 0.85);
    el.animate([{ transform: 'none' }, { transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) rotate(${(Math.random() * 30 - 15).toFixed(1)}deg) scale(${s})`, opacity: 0.85 }], {
      duration: dur,
      easing: 'cubic-bezier(.55,0,.75,.25)',
      fill: 'forwards',
    });
    el.querySelector<HTMLElement>('.tcard-inner')?.animate([{ transform: down ? 'rotateY(180deg)' : 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }], { duration: dur, fill: 'forwards' });
  }, [sweep, down, ms]);

  return (
    <span ref={ref} className={`tcard${down ? ' is-down' : ''}${className ? ` ${className}` : ''}`} style={style} data-card={card}>
      <span className="tcard-inner">
        <span className="tcard-face card" aria-hidden={down}>
          <CardImg card={card} layout={layout} />
        </span>
        <span className="tcard-back card" aria-hidden>
          <CardImg card={null} />
        </span>
      </span>
    </span>
  );
}
