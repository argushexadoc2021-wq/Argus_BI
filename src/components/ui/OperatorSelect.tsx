import { useEffect, useRef, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';

// Names added with "+" during this visit, shared by every operator dropdown on the page,
// so a new operator added on one line can be picked on the next line too.
const added = new Set<string>();
const listeners = new Set<() => void>();
const addName = (n: string) => { added.add(n); listeners.forEach((l) => l()); };
/** Add a new operator name to every operator dropdown on the page (used by a single "+" outside the rows). */
export const addOperatorName = (n: string) => { const t = n.trim().replace(/\s+/g, ' '); if (t) addName(t); return t; };

interface OperatorSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  className?: string;
  placeholder?: string;
  /** Hide the "+" beside the dropdown (when one "+" for all lines is shown elsewhere). */
  hideAdd?: boolean;
}

/** A normal dropdown of operators with a "+" button to add a new name. */
export function OperatorSelect({ value, onChange, options, className = '', placeholder = 'Operator', hideAdd = false }: OperatorSelectProps) {
  const [, force] = useState(0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  const seen = new Map<string, string>();
  for (const o of [...options, ...added, value]) {
    const t = String(o || '').trim();
    if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
  }
  const all = [...seen.values()].sort((a, b) => a.localeCompare(b));

  const confirm = () => {
    const n = draft.trim().replace(/\s+/g, ' ');
    if (n) {
      const existing = seen.get(n.toLowerCase());
      if (!existing) addName(n);
      onChange(existing || n);
    }
    setDraft('');
    setAdding(false);
  };
  const cancel = () => { setDraft(''); setAdding(false); };

  const btn = 'inline-flex h-full w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 cursor-pointer';

  if (adding) {
    return (
      <div className="flex min-w-0 items-stretch gap-1">
        <input
          ref={inputRef}
          className={`${className} min-w-0 flex-1`}
          value={draft}
          placeholder="New operator name"
          aria-label="New operator name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); confirm(); }
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          }}
        />
        <button type="button" onClick={confirm} title="Add" aria-label="Add operator" className={`${btn} !text-emerald-600 hover:!bg-emerald-50`}><Check size={15} /></button>
        <button type="button" onClick={cancel} title="Cancel" aria-label="Cancel" className={`${btn} hover:!text-red-600`}><X size={15} /></button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-stretch gap-1">
      <select
        className={`${className} min-w-0 flex-1`}
        value={value}
        aria-label="Operator"
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}…</option>
        {all.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {!hideAdd && <button type="button" onClick={() => setAdding(true)} title="Add a new operator" aria-label="Add a new operator" className={`${btn} hover:!text-indigo-600 hover:!border-indigo-300`}><Plus size={15} /></button>}
    </div>
  );
}
