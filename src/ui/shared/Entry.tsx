// Number entry for the trainers (running / true count, bet in units): fields
// you type into with the keyboard (digits, −, Backspace, Tab, Enter) or the
// on-screen keypad.

import { useState, type ReactNode } from 'react';
import { useHotkeys } from './controls';
import { Icon } from './Icon';

export interface EntryField {
  key: string;
  label: string;
  signed: boolean;
  suffix?: string;
}

const parse = (s: string) => (s === '' || s === '-' ? null : Number(s));

export function Entry({ fields, onSubmit, title, submitLabel = 'Submit', extra }: { fields: EntryField[]; onSubmit: (v: Record<string, number>) => void; title?: ReactNode; submitLabel?: string; extra?: ReactNode }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, ''])));
  const [active, setActive] = useState(0);
  const f = fields[active]!;
  const ready = fields.every((x) => parse(values[x.key] ?? '') !== null);

  const edit = (fn: (s: string) => string) => setValues((v) => ({ ...v, [f.key]: fn(v[f.key] ?? '') }));
  const digit = (d: string) => edit((s) => (s === '0' ? d : s === '-0' ? `-${d}` : (s + d).slice(0, 4)));
  const sign = () => f.signed && edit((s) => (s.startsWith('-') ? s.slice(1) : `-${s}`));
  const del = () => edit((s) => s.slice(0, -1));
  const nextField = () => setActive((i) => (i + 1) % fields.length);
  const submit = () => {
    if (!ready) {
      const i = fields.findIndex((x) => parse(values[x.key] ?? '') === null);
      if (i >= 0) setActive(i);
      return;
    }
    onSubmit(Object.fromEntries(fields.map((x) => [x.key, parse(values[x.key]!)!])));
  };

  const keys: Record<string, () => void> = { Backspace: del, Tab: nextField, Enter: submit, '-': sign, _: sign, '+': () => f.signed && edit((s) => s.replace('-', '')) };
  for (let d = 0; d <= 9; d++) keys[String(d)] = () => digit(String(d));
  useHotkeys(keys);

  return (
    <div className="entry panel">
      {title && <div className="entry-title">{title}</div>}
      <div className="entry-fields">
        {fields.map((x, i) => {
          const v = values[x.key] ?? '';
          return (
            <button key={x.key} type="button" className={`entry-field${i === active ? ' is-active' : ''}`} onClick={() => setActive(i)}>
              <span className="entry-label">{x.label}</span>
              <span className="entry-value">
                {v === '' ? <span className="entry-caret">_</span> : v.replace('-', '−')}
                {x.suffix && v !== '' && <small>{x.suffix}</small>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="key" onClick={() => digit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className="key key-alt" onClick={sign} disabled={!f.signed}>
          ±
        </button>
        <button type="button" className="key" onClick={() => digit('0')}>
          0
        </button>
        <button type="button" className="key key-alt" onClick={del} aria-label="Delete">
          ⌫
        </button>
      </div>
      <div className="entry-actions">
        {fields.length > 1 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={nextField}>
            Next field <kbd>Tab</kbd>
          </button>
        )}
        {extra}
        <button type="button" className="btn" onClick={submit} disabled={!ready}>
          {submitLabel} <Icon name="arrow" size="sm" />
        </button>
      </div>
    </div>
  );
}
