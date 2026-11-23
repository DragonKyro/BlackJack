// Feedback cards for the count and the bet (Bet and Smart trainers).

import type { ReactNode } from 'react';
import type { BetGrade, CountGrade } from '@/store/countCheck';
import { signed } from '../shared/controls';
import { Icon } from '../shared/Icon';

function Check({ tone, title, detail }: { tone: 'ok' | 'close' | 'bad'; title: ReactNode; detail: ReactNode }) {
  return (
    <div className={`check ${tone}`}>
      <span className="check-mark">
        <Icon name={tone === 'bad' ? 'x' : 'check'} size="sm" />
      </span>
      <span className="check-body">
        <b>{title}</b>
        <small>{detail}</small>
      </span>
    </div>
  );
}

export function CountCheck({ g }: { g: CountGrade }) {
  const what = g.ask === 'rc' ? 'Running count' : 'True count';
  const tone = g.ok ? 'ok' : g.close ? 'close' : 'bad';
  const title = g.ok ? `${what} ${signed(g.actual)} — right` : `${what} is ${signed(g.actual)} — you said ${signed(g.guess)}`;
  const detail = `RC ${signed(g.rc)} ÷ ${g.decks} deck${g.decks === 1 ? '' : 's'} left = ${signed(g.exact, 2)} → TC ${signed(g.tc)}`;
  return <Check tone={tone} title={title} detail={detail} />;
}

export function BetCheck({ g, tc }: { g: BetGrade; tc: number }) {
  const u = (n: number) => (n === 0 ? 'sit out (0)' : `${n} unit${n === 1 ? '' : 's'}`);
  return <Check tone={g.ok ? 'ok' : 'bad'} title={g.ok ? `Bet ${u(g.bet)} — right` : `Bet ${u(g.right)} — you bet ${g.bet}`} detail={`The spread at TC ${signed(tc)}`} />;
}
