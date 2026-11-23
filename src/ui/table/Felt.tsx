// The table: padded rail, felt with its printed arcs, the shoe (top right,
// where the cards fly from) and the discard tray (top left, where they go).

import type { CSSProperties, ReactNode } from 'react';
import type { Rules } from '@/bj/rules';
import { decksLeft } from '@/bj/shoe';
import { setAnchor } from './anchors';

export function Felt({ rules, children, className, print = true }: { rules: Rules | null; children: ReactNode; className?: string; print?: boolean }) {
  return (
    <div className="felt-wrap">
      <div className={`felt${className ? ` ${className}` : ''}`}>
        <div className="felt-texture" aria-hidden />
        {print && rules && <FeltPrint rules={rules} />}
        {children}
      </div>
    </div>
  );
}

/** Gold printing on the felt: the payouts and the dealer's rule, on arcs. */
function FeltPrint({ rules }: { rules: Rules }) {
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
}

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
