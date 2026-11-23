// Cloud stats: Google sign-in and one Firestore document per user
// (`blackjack/{uid}`), so your training record follows you between phone and
// computer. Firebase loads lazily (on sign-in, or at start-up if you were
// signed in before).
//
// Offline first: everything is saved locally (statsStore). Each change is
// queued in localStorage and pushed when signed in and online — debounced
// after changes, and in full on sign-in, reconnect and start-up. A full sync
// pulls and merges the cloud copy first, then writes back what the cloud
// lacks and deletes what was trimmed or cleared.

import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { Spread } from '@/math/betSpread';
import {
  decodeDrill,
  decodeSession,
  encodeDrill,
  encodeSession,
  useStats,
  type Change,
  type PlayRecord,
  type SavedSpread,
  type Session,
  type StatsData,
} from '@/store/statsStore';
import type { Drill } from '@/math/analytics';
import { readJson, removeKey, writeJson } from '@/store/storage';
import { FIREBASE_CONFIG, STATS_COLLECTION } from './firebaseConfig';

export type CloudStatus = 'off' | 'loading' | 'signedOut' | 'signedIn';

interface CloudState {
  status: CloudStatus;
  user: { name: string; email: string; photo: string | null } | null;
  /** Changes made locally and not yet in the cloud. */
  pending: number;
  syncing: boolean;
  online: boolean;
  error: string | null;
}

const PENDING_KEY = 'pending';
const SIGNED_IN_KEY = 'signedIn';

const readPending = () => readJson<string[]>(PENDING_KEY, []);

export const useCloud = create<CloudState>(() => ({
  status: 'off',
  user: null,
  pending: readPending().length,
  syncing: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  error: null,
}));

function writePending(keys: string[]): void {
  writeJson(PENDING_KEY, keys);
  useCloud.setState({ pending: keys.length });
}

const changeKey = (c: Change) => (c.kind === 'drill' ? `d:${c.id}` : c.kind === 'session' ? `s:${c.id}` : c.kind);

type Fb = {
  auth: import('firebase/auth').Auth;
  db: import('firebase/firestore').Firestore;
  authMod: typeof import('firebase/auth');
  fsMod: typeof import('firebase/firestore');
};

let fb: Promise<Fb> | null = null;
let uid: string | null = null;

function loadFirebase(): Promise<Fb> {
  if (!fb) {
    fb = (async () => {
      const [{ initializeApp, getApps }, authMod, fsMod] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
      const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      authMod.onAuthStateChanged(auth, (user) => void onUser(user));
      return { auth, db, authMod, fsMod };
    })();
    fb.catch(() => {
      fb = null;
    });
  }
  return fb;
}

async function onUser(user: User | null): Promise<void> {
  uid = user?.uid ?? null;
  if (!user) {
    useCloud.setState({ status: 'signedOut', user: null });
    removeKey(SIGNED_IN_KEY);
    return;
  }
  writeJson(SIGNED_IN_KEY, 1);
  useCloud.setState({ status: 'signedIn', user: { name: user.displayName ?? 'Signed in', email: user.email ?? '', photo: user.photoURL }, error: null });
  await sync(true);
}

/** The cloud document, decoded. */
function decodeDoc(data: Record<string, unknown> | undefined): Partial<StatsData> & { drillIds: string[]; sessionIds: string[] } {
  const drills: Drill[] = [];
  const sessions: Record<string, Session> = {};
  const rawDrills = (data?.drills ?? {}) as Record<string, string>;
  const rawSessions = (data?.sessions ?? {}) as Record<string, string>;
  for (const [id, s] of Object.entries(rawDrills)) {
    const d = typeof s === 'string' ? decodeDrill(id, s) : null;
    if (d) drills.push(d);
  }
  for (const [id, s] of Object.entries(rawSessions)) {
    const x = typeof s === 'string' ? decodeSession(id, s) : null;
    if (x) sessions[id] = x;
  }
  const out: Partial<StatsData> & { drillIds: string[]; sessionIds: string[] } = { drills, sessions, drillIds: Object.keys(rawDrills), sessionIds: Object.keys(rawSessions) };
  if (data?.play && typeof (data.play as PlayRecord).at === 'number') out.play = data.play as PlayRecord;
  const sp = data?.spread as { units?: Record<string, number>; at?: number } | undefined;
  if (sp?.units && typeof sp.at === 'number') out.spread = { units: Object.fromEntries(Object.entries(sp.units).map(([k, v]) => [Number(k), v])) as Spread, at: sp.at } as SavedSpread;
  if (typeof data?.cleared === 'number') out.cleared = data.cleared;
  return out;
}

let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void sync(false);
  }, 1800);
}

/** Pull and merge (full), then push the queue (or everything, on a full sync). */
async function sync(full: boolean): Promise<void> {
  if (!uid || !navigator.onLine) return;
  if (useCloud.getState().syncing) {
    again = true;
    return;
  }
  useCloud.setState({ syncing: true });
  const queued = readPending();
  if (queued.includes('cleared')) full = true;
  try {
    const { db, fsMod } = await loadFirebase();
    const ref = fsMod.doc(db, STATS_COLLECTION, uid);
    const payload: Record<string, unknown> = { updated: fsMod.serverTimestamp() };
    const drills: Record<string, unknown> = {};
    const sessions: Record<string, unknown> = {};

    if (full) {
      const snap = await fsMod.getDoc(ref);
      const remote = decodeDoc(snap.data());
      useStats.getState().absorb(remote);
      const local = useStats.getState();
      const keepD = new Set(local.drills.map((d) => d.id));
      const keepS = new Set(Object.keys(local.sessions));
      for (const d of local.drills) drills[d.id] = encodeDrill(d);
      for (const s of Object.values(local.sessions)) sessions[s.id] = encodeSession(s);
      // Trimmed or cleared here: delete there too.
      for (const id of remote.drillIds) if (!keepD.has(id)) drills[id] = fsMod.deleteField();
      for (const id of remote.sessionIds) if (!keepS.has(id)) sessions[id] = fsMod.deleteField();
      payload.play = local.play;
      if (local.spread) payload.spread = local.spread;
      payload.cleared = local.cleared;
    } else {
      const local = useStats.getState();
      const byId = new Map(local.drills.map((d) => [d.id, d]));
      for (const key of queued) {
        if (key.startsWith('d:')) {
          const d = byId.get(key.slice(2));
          if (d) drills[d.id] = encodeDrill(d);
        } else if (key.startsWith('s:')) {
          const s = local.sessions[key.slice(2)];
          if (s) sessions[s.id] = encodeSession(s);
        } else if (key === 'play') payload.play = local.play;
        else if (key === 'spread' && local.spread) payload.spread = local.spread;
      }
    }
    if (Object.keys(drills).length) payload.drills = drills;
    if (Object.keys(sessions).length) payload.sessions = sessions;
    await fsMod.setDoc(ref, payload, { merge: true });
    const sent = new Set(queued);
    writePending(readPending().filter((k) => !sent.has(k)));
    useCloud.setState({ error: null });
  } catch (e) {
    useCloud.setState({ error: (e as Error).message });
  } finally {
    useCloud.setState({ syncing: false });
    if (again) {
      again = false;
      schedule();
    }
  }
}

/** Start-up: queue local changes, restore a previous sign-in, sync on reconnect. */
export function initCloud(): void {
  useStats.setState({
    onChange: (c) => {
      const key = changeKey(c);
      const keys = readPending();
      if (!keys.includes(key)) writePending([...keys, key]);
      if (c.kind === 'cleared') void sync(true);
      else schedule();
    },
  });
  window.addEventListener('online', () => {
    useCloud.setState({ online: true });
    void sync(true);
  });
  window.addEventListener('offline', () => useCloud.setState({ online: false }));
  if (readJson<number>(SIGNED_IN_KEY, 0) === 1) {
    useCloud.setState({ status: 'loading' });
    loadFirebase().catch(() => useCloud.setState({ status: 'signedOut' }));
  } else {
    useCloud.setState({ status: 'signedOut' });
  }
}

export async function signIn(): Promise<void> {
  useCloud.setState({ status: 'loading', error: null });
  try {
    const { auth, authMod } = await loadFirebase();
    await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider());
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    useCloud.setState({ status: uid ? 'signedIn' : 'signedOut', error: code === 'auth/popup-closed-by-user' ? null : friendly(code, (e as Error).message) });
  }
}

export async function signOut(): Promise<void> {
  const { auth, authMod } = await loadFirebase();
  await authMod.signOut(auth);
}

function friendly(code: string, message: string): string {
  if (code === 'auth/network-request-failed') return 'You seem to be offline — sign in once you are connected.';
  if (code === 'auth/unauthorized-domain') return 'This site is not yet authorised for sign-in in the Firebase console.';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is not enabled for this Firebase project yet.';
  if (code === 'auth/popup-blocked') return 'The sign-in window was blocked — allow pop-ups and try again.';
  return message;
}
