// Small shared controls: a switch, a segmented picker, a ◀ value ▶ cycler,
// a settings row, a modal shell, the page top bar, hotkeys and an animated
// number.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { back } from '../router';
import { Icon } from './Icon';

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" className="toggle" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />;
}

export function Segmented<T extends string | number | boolean>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode; disabled?: boolean }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <span className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

/** ◀ value ▶ — steps through `options` (wrapping unless `clamp`). */
export function Cycle<T>({ value, options, onChange, format = String, label, clamp = false }: { value: T; options: readonly T[]; onChange: (v: T) => void; format?: (v: T) => ReactNode; label: string; clamp?: boolean }) {
  const i = Math.max(0, options.indexOf(value));
  const [bump, setBump] = useState(0);
  const step = (d: number) => {
    let j = i + d;
    if (clamp) j = Math.max(0, Math.min(options.length - 1, j));
    else j = (j + options.length) % options.length;
    onChange(options[j]!);
    setBump((b) => b + 1);
  };
  return (
    <span className="cycle" role="group" aria-label={label}>
      <button type="button" className="cycle-btn" aria-label={`Previous ${label}`} disabled={clamp && i === 0} onClick={() => step(-1)}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 4L6 12l10 8z" />
        </svg>
      </button>
      <span key={bump} className={`cycle-value${bump ? ' bump' : ''}`} aria-live="polite">
        {format(value)}
      </span>
      <button type="button" className="cycle-btn" aria-label={`Next ${label}`} disabled={clamp && i === options.length - 1} onClick={() => step(1)}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 4l10 8-10 8z" />
        </svg>
      </button>
    </span>
  );
}

export function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="setting-row">
      <span className="setting-label">
        {label}
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children, wide, actions }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  useHotkeys({ Escape: onClose });
  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal panel${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <h2>
          {title}
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </h2>
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function TopBar({ title, sub, backTo, right, onBack }: { title: ReactNode; sub?: ReactNode; backTo: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <header className="topbar">
      <button type="button" className="icon-btn" onClick={() => (onBack ? onBack() : back(backTo))} aria-label="Back">
        <Icon name="back" />
      </button>
      <div className="topbar-title">
        {sub && <span className="topbar-sub">{sub}</span>}
        <span className="topbar-name">{title}</span>
      </div>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

type KeyMap = Record<string, ((e: KeyboardEvent) => void) | undefined>;

/**
 * Keyboard shortcuts, by `KeyboardEvent.key` (letters lower-case; "Enter",
 * "Escape", "ArrowLeft", " " …). The latest map wins without re-binding.
 * Ignored while typing in a field or with a modifier held.
 */
export function useHotkeys(map: KeyMap, enabled = true): void {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // A focused button keeps its own Enter / Space.
      if (tag === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const f = ref.current[k] ?? ref.current['*'];
      if (f) {
        e.preventDefault();
        f(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/** A number that eases toward its value (bankrolls, scores). */
export function useTween(value: number, ms = 600): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === value) return;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - (1 - t) ** 3;
      const x = a + (value - a) * e;
      from.current = x;
      setShown(x);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** "+3", "−2", "0". */
export function signed(n: number, digits = 0): string {
  const s = Math.abs(n).toFixed(digits);
  if (Number(s) === 0) return digits ? (0).toFixed(digits) : '0';
  return n > 0 ? `+${s}` : `−${s}`;
}
