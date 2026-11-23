// Small synthesized sounds (Web Audio, no files): a card snapping onto the
// felt, the hole card turned, chips, a win, a blackjack, a loss, right and
// wrong answers. Browsers only allow audio after a user gesture, so the
// context is created on the first pointer press or key.

import { usePrefs } from '@/store/prefsStore';

export type Sound = 'card' | 'flip' | 'chip' | 'chips' | 'win' | 'blackjack' | 'lose' | 'push' | 'right' | 'wrong' | 'tap' | 'shuffle';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => audio(), { once: true, capture: true });
  window.addEventListener('keydown', () => audio(), { once: true, capture: true });
}

function tone(a: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.07): void {
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** A short filtered noise burst. */
function noise(a: AudioContext, start: number, gain = 0.2, freq = 2200, len = 0.05, q = 0.8): void {
  const n = Math.floor(a.sampleRate * len);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(a.destination);
  src.start(start);
}

/** Two clay chips touching. */
function clink(a: AudioContext, t: number, gain = 0.05): void {
  tone(a, 2400 + Math.random() * 500, t, 0.06, 'triangle', gain);
  tone(a, 3900 + Math.random() * 600, t + 0.004, 0.05, 'sine', gain * 0.6);
  noise(a, t, 0.08, 5200, 0.02, 2);
}

export function playSound(kind: Sound): void {
  if (!usePrefs.getState().sound) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  const t = a.currentTime + 0.01;
  switch (kind) {
    case 'card':
      noise(a, t, 0.22, 2300);
      break;
    case 'flip':
      noise(a, t, 0.12, 3200, 0.035);
      noise(a, t + 0.05, 0.16, 1900);
      break;
    case 'tap':
      noise(a, t, 0.07, 3400);
      break;
    case 'chip':
      clink(a, t);
      break;
    case 'chips':
      for (let i = 0; i < 4; i++) clink(a, t + i * 0.045 + Math.random() * 0.02, 0.04);
      break;
    case 'shuffle':
      for (let i = 0; i < 14; i++) noise(a, t + i * 0.035, 0.08, 1800 + Math.random() * 1500, 0.03);
      break;
    case 'win':
      [659, 784, 988].forEach((f, i) => tone(a, f, t + i * 0.09, 0.26, 'triangle', 0.06));
      break;
    case 'blackjack':
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(a, f, t + i * 0.08, 0.36, 'triangle', 0.06));
      tone(a, 2093, t + 0.42, 0.5, 'sine', 0.025);
      break;
    case 'push':
      tone(a, 587, t, 0.16, 'triangle', 0.045);
      tone(a, 587, t + 0.14, 0.2, 'triangle', 0.035);
      break;
    case 'lose':
      tone(a, 330, t, 0.22, 'triangle', 0.05);
      tone(a, 247, t + 0.17, 0.38, 'triangle', 0.05);
      break;
    case 'right':
      tone(a, 880, t, 0.12, 'sine', 0.06);
      tone(a, 1320, t + 0.07, 0.2, 'sine', 0.05);
      break;
    case 'wrong':
      tone(a, 196, t, 0.18, 'square', 0.025);
      tone(a, 185, t + 0.12, 0.24, 'square', 0.022);
      break;
  }
}
