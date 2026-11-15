import { Children, isValidElement, useEffect, useRef, useState } from 'react';
import type { InputHTMLAttributes, ReactElement, ReactNode, RefObject, SelectHTMLAttributes } from 'react';
import { Filter, X } from 'lucide-react';
import { ColumnFilterMenu } from './ColumnFilterMenu';
import { headerSortDir, headerValues, pickByHeader, sortByHeader } from './TableAutoFilter';

/**
 * Column-heading filters in the Inventory style: a small white funnel beside the column title. Clicking it opens the
 * Excel-style column menu (search, the column's values, sort). Several values can be ticked. When a filter is on, the
 * funnel turns light blue and a chip with the chosen value (or "3 selected") and an × appears next to it.
 */

const fakeChange = (value: string) =>
  ({ target: { value }, currentTarget: { value }, stopPropagation() {}, preventDefault() {} }) as never;

const FUNNEL = 'relative inline-flex items-center justify-center w-5 h-5 rounded cursor-pointer transition-colors hover:bg-blue-500/30';

export function FilterChip({ text, title, onClear }: { text: string; title?: string; onClear?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold normal-case tracking-normal text-blue-700 bg-white border border-blue-200 px-1.5 py-0.5 rounded-full whitespace-nowrap"
      title={`Active filter: ${title ?? text}`}
    >
      <span className="max-w-[90px] truncate">{text}</span>
      {onClear && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="text-blue-500 hover:text-blue-800 rounded-full p-0.5"
          title="Clear filter"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

export function FunnelIcon({ active }: { active: boolean }) {
  return <Filter size={12} className={`shrink-0 ${active ? 'fill-sky-300' : ''}`} />;
}

/**
 * Several ticked values on a filter the page owns (which itself takes one value): with one value the page filters as
 * before; with two or more the page shows everything and the rows of the other values are hidden on screen.
 */
export function useMultiPick(btn: RefObject<HTMLElement>, pageActive: boolean) {
  const [many, setMany] = useState<string[] | null>(null);
  const th = useRef<Element | null>(null);
  useEffect(() => {
    if (many) { th.current = btn.current?.closest('th') ?? null; pickByHeader(th.current, many); }
    else if (th.current) { pickByHeader(th.current, null); th.current = null; }
  }, [many, btn]);
  // the page's own filter was set from elsewhere: drop the several-values filter
  useEffect(() => { if (pageActive) setMany(null); }, [pageActive]);
  useEffect(() => () => { if (th.current?.isConnected) pickByHeader(th.current, null); }, []);
  return { many, setMany };
}

/** Text of an <option> child (strings / numbers joined). */
const textOf = (n: ReactNode): string =>
  Children.toArray(n).map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : isValidElement(c) ? textOf((c.props as { children?: ReactNode }).children) : '')).join('');

/** The column's title, taken from the heading cell (falls back to the aria-label). */
const titleFor = (el: HTMLElement | null, fallback?: string) => {
  const th = el?.closest('th');
  const own = th ? Array.from(th.querySelectorAll('span, button')).map((x) => (x.closest('[data-colfilter]') ? '' : x.textContent?.trim() ?? '')).find(Boolean) : '';
  return own || (fallback ?? 'Filter').replace(/^Filter( by)?\s*/i, '') || 'Filter';
};

/** Can the ticked values be found in the column's cells? (a "This month" style filter cannot be multi-ticked) */
const valuesInColumn = (el: HTMLElement | null, labels: string[]) => {
  const cells = headerValues(el).map((v) => v.toLowerCase());
  return labels.some((l) => { const x = l.trim().toLowerCase(); return !!x && cells.some((c) => c === x || c.includes(x)); });
};

type Opt = ReactElement<{ value?: unknown; children?: ReactNode }>;

/** Drop-in replacement for a <select> inside a table heading: the same props and <option> children. */
export function HeaderSelect({ children, value, onChange, title, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  const btn = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const options = Children.toArray(children).flatMap((c) =>
    isValidElement(c) && c.type === 'optgroup' ? Children.toArray((c.props as { children?: ReactNode }).children) : [c],
  ).filter(isValidElement) as Opt[];
  const optValue = (o: Opt) => String(o.props.value ?? textOf(o.props.children));
  const allValue = options.length ? optValue(options[0]) : '';
  const current = value == null ? '' : String(value);
  const pageActive = current !== '' && current !== allValue;
  const { many, setMany } = useMultiPick(btn, pageActive);
  const active = pageActive || !!many;
  const label = (v: string) => { const o = options.find((x) => optValue(x) === v); return o ? textOf(o.props.children) || v : v; };
  const rest_ = options.slice(1);
  const byText = new Map(rest_.map((o) => [textOf(o.props.children) || optValue(o), optValue(o)]));
  const set = (v: string) => onChange?.(fakeChange(v));
  const clear = () => { setMany(null); if (pageActive) set(allValue); };
  const multi = !!rect && valuesInColumn(btn.current, Array.from(byText.keys()));

  return (
    <span data-colfilter className="inline-flex items-center gap-1 align-middle normal-case tracking-normal">
      <button
        ref={btn}
        type="button"
        className={FUNNEL}
        title={title ?? rest['aria-label'] ?? 'Filter'}
        disabled={rest.disabled}
        onClick={(e) => { e.stopPropagation(); setRect(e.currentTarget.getBoundingClientRect()); }}
      >
        <FunnelIcon active={active} />
      </button>
      {many ? <FilterChip text={`${many.length} selected`} title={many.join(', ')} onClear={clear} />
        : pageActive && <FilterChip text={label(current)} onClear={clear} />}
      {rect && (
        <ColumnFilterMenu
          anchor={rect}
          title={titleFor(btn.current, rest['aria-label'] ?? title)}
          values={Array.from(byText.keys())}
          selected={many ? new Set(many) : pageActive ? new Set([label(current)]) : null}
          multi={multi}
          allLabel={options.length ? textOf(options[0].props.children) || 'All' : 'All'}
          onChange={(next) => {
            const picked = next ? Array.from(next) : [];
            if (picked.length >= 2) { setMany(picked); if (pageActive) set(allValue); }
            else { setMany(null); set(picked.length ? byText.get(picked[0]) ?? allValue : allValue); }
          }}
          sortDir={headerSortDir(btn.current)}
          onSort={(d) => sortByHeader(btn.current, d)}
          onClose={() => setRect(null)}
        />
      )}
    </span>
  );
}

/** Drop-in replacement for a text <input> filter inside a table heading: the funnel opens the column menu with a search box. */
export function HeaderInput({ value, onChange, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const btn = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const current = value == null ? '' : String(value);
  const pageActive = current.trim() !== '';
  const { many, setMany } = useMultiPick(btn, pageActive);
  const set = (v: string) => onChange?.(fakeChange(v));
  const clear = () => { setMany(null); if (pageActive) set(''); };
  const colValues = rect ? headerValues(btn.current) : [];

  return (
    <span data-colfilter className="inline-flex items-center gap-1 align-middle normal-case tracking-normal">
      <button
        ref={btn}
        type="button"
        className={FUNNEL}
        title={rest['aria-label'] ?? 'Filter'}
        onClick={(e) => { e.stopPropagation(); setRect(e.currentTarget.getBoundingClientRect()); }}
      >
        <FunnelIcon active={pageActive || !!many} />
      </button>
      {many ? <FilterChip text={many.length === 1 ? many[0] : `${many.length} selected`} title={many.join(', ')} onClear={clear} />
        : pageActive && <FilterChip text={current} onClear={clear} />}
      {rect && (
        <ColumnFilterMenu
          anchor={rect}
          title={titleFor(btn.current, rest['aria-label'])}
          values={colValues}
          selected={many ? new Set(many) : null}
          search={many ? undefined : current}
          onSearch={many ? undefined : set}
          onChange={(next) => {
            // ticked values filter on screen (the page then shows every row, so more values can still be ticked)
            const picked = next ? Array.from(next) : [];
            setMany(picked.length ? picked : null);
            if (pageActive) set('');
          }}
          sortDir={headerSortDir(btn.current)}
          onSort={(d) => sortByHeader(btn.current, d)}
          onClose={() => setRect(null)}
        />
      )}
    </span>
  );
}
