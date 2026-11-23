// The table: padded rail, felt with its printed arcs, the shoe (top right,
// where the cards fly from) and the discard tray (top left, where they go).

import { memo, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { Rules } from '@/bj/rules';
import { decksLeft } from '@/bj/shoe';
import { prefersReducedMotion, setAnchor } from './anchors';

/** Layout positions of the card rows (`[data-flip]`) and their running glides. */
const lastPos = new WeakMap<Element, { x: number; y: number }>();
const glides = new WeakMap<Element, Animation>();

/**
 * FLIP for the card rows: after each update, any row whose place changed (a
 * hand re-centring as a card lands, hands moving over after a split) glides
 * from where it was instead of jumping.
 */
function useRowGlide(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const rows = [...root.querySelectorAll<HTMLElement>('[data-flip]')];
    const residual = new Map<Element, { x: number; y: number }>();
    for (const el of rows) {
      const a = glides.get(el);
      if (!a) continue;
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      residual.set(el, { x: m.m41, y: m.m42 });
      a.cancel();
      glides.delete(el);
    }
    const reduce = prefersReducedMotion();
    const now = rows.map((el) => [el, el.getBoundingClientRect()] as const);
    for (const [el, r] of now) {
      const prev = lastPos.get(el);
      lastPos.set(el, { x: r.left, y: r.top });
      if (!prev || reduce || !el.animate) continue;
      const res = residual.get(el) ?? { x: 0, y: 0 };
      const dx = prev.x + res.x - r.left;
      const dy = prev.y + res.y - r.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      const a = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' });
      glides.set(el, a);
      a.onfinish = () => glides.delete(el);
    }
  });
}

export function Felt({ rules, children, className, print = true }: { rules: Rules | null; children: ReactNode; className?: string; print?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useRowGlide(ref);
  return (
    <div className="felt-wrap">
      <div ref={ref} className={`felt${className ? ` ${className}` : ''}`}>
        <div className="felt-texture" aria-hidden />
        {print && rules && <FeltPrint rules={rules} />}
        {children}
      </div>
    </div>
  );
}

/** Gold printing on the felt: the payouts and the dealer's rule, on arcs. */
const FeltPrint = memo(function FeltPrint({ rules }: { rules: Rules }) {
  const bj = rules.bjPayout >= 1.5 ? 'BLACKJACK PAYS 3 TO 2' : 'BLACKJACK PAYS 6 TO 5';
  const dealer = rules.h17 ? 'Dealer must hit soft 17' : 'Dealer must stand on all 17s';
  return (
    <svg className="felt-print" viewBox="0 0 1000 340" preserveAspectRatio="xMidYMin meet" aria-hidden>
      <defs>
        <path id="arc-bj" d="M150 60 Q500 250 850 60" />
        <path id="arc-dealer" d="M230 112 Q500 280 770 112" />
        <path id="arc-ins-top" d="M110 150 Q500 400 890 150" />
        <path id="arc-ins-bot" d="M90 196 Q500 456 910 196" />
      </defs>
      <text className="print-bj">
        <textPath href="#arc-bj" startOffset="50%" textAnchor="middle">
          {bj}
        </textPath>
      </text>
      <text className="print-dealer">
        <textPath href="#arc-dealer" startOffset="50%" textAnchor="middle">
          {dealer}
        </textPath>
      </text>
      {rules.insurance && (
        <>
          <use href="#arc-ins-top" className="print-band" />
          <use href="#arc-ins-bot" className="print-band" />
          <text className="print-ins">
            <textPath href="#arc-ins-bot" startOffset="50%" textAnchor="middle" dy="-13">
              ✦ INSURANCE PAYS 2 TO 1 ✦
            </textPath>
          </text>
        </>
      )}
    </svg>
  );
});

/** The shoe: a stack of backs whose height shows what's left, the cut card, and the numbers. */
export function Shoe({ remaining, total, cut, showNumbers = true }: { remaining: number; total: number; cut: number; showNumbers?: boolean }) {
  const frac = total > 0 ? remaining / total : 0;
  const cutFrac = total > 0 ? (total - cut) / total : 0;
  const level = frac > 0.5 ? 'hi' : frac > 0.3 ? 'mid' : 'lo';
  return (
    <div className="shoe" aria-label={`${remaining} cards left in the shoe`}>
      <div className="shoe-box" ref={(el) => setAnchor('shoe', el)}>
        <div className="shoe-stack" style={{ '--fill': frac, '--cut': cutFrac } as CSSProperties}>
          <span className="shoe-cards" />
          <span className="shoe-cut" />
        </div>
        <span className="shoe-mouth" />
      </div>
      {showNumbers && (
        <div className="shoe-info">
          <b>{remaining}</b> cards · {decksLeft(remaining)} decks
          <span className={`shoe-bar shoe-${level}`}>
            <i style={{ width: `${frac * 100}%` }} />
          </span>
        </div>
      )}
    </div>
  );
}

/** The discard tray: its stack grows with the cards played. */
export function Discard({ count, total }: { count: number; total: number }) {
  const frac = total > 0 ? Math.min(1, count / total) : 0;
  return (
    <div className="discard" aria-label={`${count} cards in the discard tray`}>
      <div className="discard-box" ref={(el) => setAnchor('discard', el)}>
        <span className="discard-stack" style={{ '--fill': frac } as CSSProperties} />
      </div>
    </div>
  );
}
