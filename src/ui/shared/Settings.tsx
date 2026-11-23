// Settings and account, in one modal.

import { signIn, signOut, useCloud } from '@/net/cloud';
import { TC_METHOD_NAME, usePrefs, type Speed } from '@/store/prefsStore';
import type { TcMethod } from '@/bj/shoe';
import { Modal, Row, Segmented, Toggle } from './controls';
import { Icon } from './Icon';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const prefs = usePrefs();
  return (
    <Modal title="Settings" onClose={onClose}>
      <Row label="Sounds">
        <Toggle on={prefs.sound} onChange={(v) => prefs.set({ sound: v })} label="Sounds" />
      </Row>
      <Row label="Dealing pace" hint="Play, Strategy and Smart trainers">
        <Segmented<Speed>
          label="Dealing pace"
          value={prefs.speed}
          onChange={(speed) => prefs.set({ speed })}
          options={(['relaxed', 'normal', 'fast'] as Speed[]).map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))}
        />
      </Row>
      <Row label="Four-colour suits" hint="♦ orange and ♣ green">
        <Toggle on={prefs.fourColor} onChange={(v) => prefs.set({ fourColor: v })} label="Four-colour suits" />
      </Row>
      <Row label="Auto-deal" hint="Strategy trainer: next hand after 1.5 s">
        <Toggle on={prefs.autoAdvance} onChange={(v) => prefs.set({ autoAdvance: v })} label="Auto-deal" />
      </Row>
      <Row label="True count" hint="RC ÷ decks left (to the half deck), then…">
        <Segmented<TcMethod>
          label="True count rounding"
          value={prefs.tcMethod}
          onChange={(tcMethod) => prefs.set({ tcMethod })}
          options={(['round', 'floor', 'truncate'] as TcMethod[]).map((m) => ({ value: m, label: TC_METHOD_NAME[m] }))}
        />
      </Row>
      <Account />
      <p className="about faint">
        Blackjack Trainer by Kyle Lui. Hi-Lo count; basic strategy for multi-deck shoes with dealer peek; index plays from the Illustrious 18 and Fab 4. Cards and chips drawn in code.
      </p>
    </Modal>
  );
}

export function Account() {
  const { status, user, pending, syncing, online, error } = useCloud();
  return (
    <div className="account">
      <div className="section-h">Progress sync</div>
      {status === 'signedIn' && user ? (
        <div className="account-row">
          {user.photo ? <img className="account-photo" src={user.photo} alt="" referrerPolicy="no-referrer" /> : <Icon name="user" />}
          <span className="account-who">
            {user.name}
            <span className="setting-hint">{!online ? `Offline — ${pending} to sync when you reconnect` : syncing ? 'Syncing…' : pending > 0 ? `${pending} waiting to sync` : 'Stats synced across your devices'}</span>
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="account-row">
          <Icon name={online ? 'cloud' : 'cloudOff'} />
          <span className="account-who">
            Stats are saved on this device.
            <span className="setting-hint">Sign in to keep them in step between your phone and computer.</span>
          </span>
          <button type="button" className="btn btn-sm" disabled={status === 'loading' || !online} onClick={() => void signIn()}>
            {status === 'loading' ? 'Signing in…' : 'Sign in with Google'}
          </button>
        </div>
      )}
      {error && <p className="account-error">{error}</p>}
    </div>
  );
}
