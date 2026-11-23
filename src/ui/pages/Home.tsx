// Home: the title over a dealt blackjack, your numbers, and every mode.

import { useState, type CSSProperties } from 'react';
import { summarize } from '@/math/analytics';
import { useCloud } from '@/net/cloud';
import { sessionsOf, useStats } from '@/store/statsStore';
import { CardView } from '../cards/CardView';
import { chipSrc, formatMoney, type Denom } from '../chips/chipArt';
import { go, paths, type Mode } from '../router';
import { Icon, type IconName } from '../shared/Icon';
import { SettingsModal } from '../shared/Settings';
import { MODE_INFO } from './modes';

interface Tile {
  key: string;
  name: string;
  blurb: string;
  icon: IconName;
  tone: string;
  stat?: string;
  to: string;
}

export function Home() {
  const cloud = useCloud();
  const drills = useStats((s) => s.drills);
  const sessions = useStats((s) => s.sessions);
  const play = useStats((s) => s.play);
  const [settings, setSettings] = useState(false);
  const all = summarize(drills);
  const strat = summarize(drills.filter((d) => d.mode === 'strategy'));
  const counting = sessionsOf(sessions, 'counting');
  const polls = counting.reduce((n, s) => n + (s.n.polls ?? 0), 0);
  const exact = counting.reduce((n, s) => n + (s.n.exact ?? 0), 0);
  const last = (m: 'bet' | 'smart') => sessionsOf(sessions, m).slice(-1)[0];

  const modeTile = (m: Mode, stat?: string): Tile => ({ key: m, ...MODE_INFO[m], to: paths.setup(m), stat });
  const pct = (c: number, n: number) => (n ? `${Math.round((c / n) * 100)}%` : '');
  const bet = last('bet');
  const smart = last('smart');
  const groups: { title: string; tiles: Tile[] }[] = [
    { title: 'Play', tiles: [modeTile('play', play.hands ? `${formatMoney(play.bankroll)} bankroll · ${play.hands} hands` : undefined)] },
    {
      title: 'Train',
      tiles: [
        modeTile('strategy', strat.total ? `${Math.round(strat.pct)}% right · ${strat.total} hands` : undefined),
        modeTile('counting', polls ? `${pct(exact, polls)} exact · ${polls} checks` : undefined),
        modeTile('bet', bet ? `Last: bets ${pct(bet.n.betsOk ?? 0, bet.n.bets ?? 0)} right` : undefined),
        modeTile('smart', smart ? `Last: play ${pct(smart.n.playsOk ?? 0, smart.n.plays ?? 0)} · bets ${pct(smart.n.betsOk ?? 0, smart.n.bets ?? 0)}` : undefined),
      ],
    },
    {
      title: 'Study',
      tiles: [
        { key: 'charts', name: 'Strategy Charts', blurb: 'Hard, soft and pair charts for any rules, plus the Illustrious 18 and Fab 4.', icon: 'grid', tone: 'tone-green', to: paths.charts() },
        { key: 'spread', name: 'Bet Spread Analyzer', blurb: 'Model a spread: EV and SD per hour, risk of ruin, N0 — live as you edit.', icon: 'chart', tone: 'tone-blue', to: paths.spread },
        { key: 'stats', name: 'Stats & Analytics', blurb: 'Accuracy, an error heatmap over the chart, trends, and your sessions.', icon: 'list', tone: 'tone-purple', to: paths.stats(), stat: all.total ? `${all.total} decisions logged` : undefined },
      ],
    },
  ];

  let k = 0;
  const chips: Denom[] = [25, 100, 500];
  return (
    <div className="home">
      <div className="home-top">
        <span className={`sync-dot${cloud.status === 'signedIn' ? ' is-on' : ''}${cloud.online ? '' : ' is-offline'}`} title={cloud.online ? (cloud.status === 'signedIn' ? 'Synced' : 'Saved on this device') : 'Offline'}>
          <Icon name={cloud.online ? 'cloud' : 'cloudOff'} size="sm" />
          {!cloud.online ? 'Offline' : cloud.status === 'signedIn' ? (cloud.pending ? 'Syncing' : 'Synced') : 'Local'}
        </span>
        <button type="button" className="icon-btn" onClick={() => setSettings(true)} aria-label="Settings and account">
          {cloud.user?.photo ? <img className="home-avatar" src={cloud.user.photo} alt="" referrerPolicy="no-referrer" /> : <Icon name="gear" />}
        </button>
      </div>

      <section className="hero">
        <div className="hero-sky" aria-hidden>
          {['♠', '♥', '♦', '♣', '♠', '♥', '♦', '♣'].map((s, i) => (
            <span key={i} className={`hero-suit suit-${'SHDC'[i % 4]}`} style={{ '--x': `${(i * 13 + 7) % 92}%`, '--y': `${(i * 29 + 11) % 80}%`, '--n': i } as CSSProperties}>
              {s}
            </span>
          ))}
        </div>
        <div className="hero-stage" aria-hidden>
          <span className="hero-21">21</span>
          <span className="hero-chips left">
            {[5, 25].map((d, i) => (
              <span key={d} className="hero-chip" style={{ '--k': i } as CSSProperties}>
                <img src={chipSrc(d as Denom)} alt="" />
              </span>
            ))}
          </span>
          {(['AS', 'KH'] as const).map((c, i) => (
            <span key={c} className="hero-card" style={{ '--k': i, '--x': i ? '34px' : '-38px', '--r': i ? '9deg' : '-13deg' } as CSSProperties}>
              <CardView card={c} />
            </span>
          ))}
          <span className="hero-chips">
            {chips.map((d, i) => (
              <span key={d} className="hero-chip" style={{ '--k': i + 2 } as CSSProperties}>
                <img src={chipSrc(d)} alt="" />
              </span>
            ))}
          </span>
        </div>
        <h1 className="hero-title">Blackjack</h1>
        <span className="hero-title-sub">Trainer</span>
        <p className="hero-tag">Basic strategy, Hi-Lo counting and bet sizing — drilled until they’re automatic, then put together at a full table.</p>
        <div className="hero-stats">
          {strat.total > 0 && (
            <span className="chip chip-gold">
              <Icon name="bolt" size="sm" /> Strategy {Math.round(strat.last50)}% <span className="faint">last 50</span>
            </span>
          )}
          {polls > 0 && (
            <span className="chip">
              <Icon name="eye" size="sm" /> Count {pct(exact, polls)} exact
            </span>
          )}
          <span className="chip">
            <Icon name="coins" size="sm" /> {formatMoney(play.bankroll)}
          </span>
        </div>
        <div className="hero-go">
          <button type="button" className="btn btn-lg btn-shine" onClick={() => go(paths.go('play'))}>
            <Icon name="play" size="sm" /> Deal me in
          </button>
          <button type="button" className="btn btn-lg btn-ghost" onClick={() => go(paths.go('strategy'))}>
            <Icon name="bolt" size="sm" /> Quick drill
          </button>
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.title}>
          <div className="home-section">{g.title}</div>
          <div className="modes">
            {g.tiles.map((t) => (
              <button key={t.key} type="button" className={`mode-card${g.tiles.length === 1 ? ' mode-card-wide' : ''}`} style={{ '--k': k++ } as CSSProperties} onClick={() => go(t.to)}>
                <span className={`mode-badge ${t.tone}`}>
                  <Icon name={t.icon} />
                </span>
                <span className="mode-body">
                  <span className="mode-name">{t.name}</span>
                  <span className="mode-blurb">{t.blurb}</span>
                  {t.stat && <span className="mode-stat">{t.stat}</span>}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <footer className="home-foot faint">
        Blackjack Trainer · by Kyle Lui · Hi-Lo count, multi-deck basic strategy with dealer peek, Illustrious 18 + Fab 4. Works offline; sign in (⚙) to sync your stats.
      </footer>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
    </div>
  );
}
