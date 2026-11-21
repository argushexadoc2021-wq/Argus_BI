// The Adviser works the app the way a person does: it opens the real page, clicks the real buttons, types into the
// real boxes of the real form (you see every letter), asks the person for anything the form still needs, and then
// presses the form's own Save button, so every rule, number series and check of that screen is applied.
//
// The AI writes a plan at the END of its answer:
//   [[UI {"title":"Move enquiry 1014 to Quotation","steps":[
//       {"go":"/sales/in-house"},
//       {"tick":"1014"},                                   tick the checkbox of the card / row showing this text
//       {"click":"Move to Next Stage"},                     a button, tab or link, by its visible text
//       {"fill":{"Unit Price":"450","Payment Terms":"30 days"}},   boxes by their label (or placeholder)
//       {"ask":true},                                       ask the person for every required box still empty
//       {"click":"Save"}                                    the form's own save button (also asks first, like "ask")
//   ]}]]

/* eslint-disable @typescript-eslint/no-explicit-any -- the AI's JSON is read loosely and checked step by step */

export type UiStep =
  | { go: string }
  | { click: string }
  | { tick: string }
  | { fill: Record<string, string> }
  | { ask: true }
  | { wait: number };

export interface UiPlan { title: string; steps: UiStep[] }

export interface UiHooks {
  navigate: (path: string) => void;
  /** Shows the question to the person and resolves with their answer (rejects / returns null when they cancel). */
  ask: (question: string, options?: string[]) => Promise<string | null>;
  status: (text: string) => void;
}

export interface UiResult { ok: boolean; message: string }

// ------------------------------------------------------------------ reading the plan
function matchBrace(s: string, i: number): number {
  let depth = 0, inStr = false;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (inStr) { if (c === '\\') k++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return k; }
  }
  return -1;
}

export function parseUiPlans(text: string): UiPlan[] {
  const out: UiPlan[] = [];
  const re = /\[\[\s*UI\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = text.indexOf('{', m.index + m[0].length - 1);
    if (start < 0) break;
    const end = matchBrace(text, start);
    if (end < 0) break;
    re.lastIndex = end + 1;
    try {
      const j = JSON.parse(text.slice(start, end + 1));
      const steps: UiStep[] = (Array.isArray(j.steps) ? j.steps : []).slice(0, 40).map((s: any): UiStep | null => {
        if (!s || typeof s !== 'object') return null;
        if (typeof s.go === 'string') return { go: s.go.startsWith('/') ? s.go : `/${s.go}` };
        if (typeof s.click === 'string') return { click: s.click };
        if (typeof s.tick === 'string' || typeof s.tick === 'number') return { tick: String(s.tick) };
        if (s.fill && typeof s.fill === 'object') return { fill: Object.fromEntries(Object.entries(s.fill).map(([k, v]) => [k, v == null ? '' : String(v)])) };
        if (s.ask) return { ask: true };
        if (typeof s.wait === 'number') return { wait: Math.min(5000, Math.max(0, s.wait)) };
        return null;
      }).filter(Boolean) as UiStep[];
      if (steps.length) out.push({ title: String(j.title || 'Do it on screen'), steps });
    } catch { /* a broken plan is skipped */ }
  }
  return out;
}

export function describeStep(s: UiStep): string {
  if ('go' in s) return `Open ${s.go}`;
  if ('click' in s) return `Click "${s.click}"`;
  if ('tick' in s) return `Select "${s.tick}"`;
  if ('fill' in s) return `Type ${Object.entries(s.fill).map(([k, v]) => `${k}: ${v}`).join(', ')}`;
  if ('ask' in s) return 'Ask you for any missing details';
  return 'Wait';
}

// ------------------------------------------------------------------ finding things on the screen
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const norm = (s: string) => String(s || '').replace(/\s+/g, ' ').replace(/[*•·:+]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const OWN = '[data-voice-ignore], .adviser-split, [data-live-guide-ignore]';

function visible(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement) || el.closest(OWN)) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const st = getComputedStyle(el);
  return st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05;
}

/** The form popup in front (the last open dialog that is not the Adviser), else the whole page. */
function scope(): ParentNode {
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].filter((d) => visible(d) && !d.closest(OWN));
  return dialogs.length ? dialogs[dialogs.length - 1] : document;
}

function textOf(el: HTMLElement): string {
  return norm(el.getAttribute('aria-label') || el.innerText || el.textContent || (el as HTMLInputElement).value || el.getAttribute('title') || '');
}

/** A button / link / tab by its visible text: exact first, then starts-with, then contains. */
function findClickable(label: string): HTMLElement | null {
  const want = norm(label);
  if (!want) return null;
  const roots: ParentNode[] = scope() === document ? [document] : [scope(), document];
  for (const root of roots) {
    const all = [...root.querySelectorAll<HTMLElement>('button, a, [role="button"], [role="tab"], [role="menuitem"], summary, input[type="submit"], input[type="button"]')].filter(visible);
    const exact = all.find((el) => textOf(el) === want);
    if (exact) return exact;
    const starts = all.find((el) => textOf(el).startsWith(want));
    if (starts) return starts;
    const has = all.filter((el) => textOf(el).includes(want)).sort((a, b) => textOf(a).length - textOf(b).length)[0];
    if (has) return has;
  }
  return null;
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const CONTROL = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), select, textarea';

/** The box for a label: the label's own control (same field wrapper), or an input whose placeholder / aria-label matches. */
function findField(label: string): Control | null {
  const want = norm(label);
  const root = scope();
  const labels = [...root.querySelectorAll<HTMLElement>('label, span, p, div, th')]
    .filter((el) => visible(el) && el.children.length <= 3 && norm(el.textContent || '').length <= 60);
  const pick = (ok: (t: string) => boolean) => labels.find((el) => ok(norm(el.textContent || '')));
  const lab = pick((t) => t === want) || pick((t) => t.startsWith(want)) || pick((t) => t.includes(want) && t.length <= want.length + 14);
  if (lab) {
    const forId = lab.getAttribute('for');
    const linked = forId ? document.getElementById(forId) : null;
    if (linked && visible(linked) && linked.matches(CONTROL)) return linked as Control;
    // the control inside the same field wrapper (walk up a few levels)
    let p: HTMLElement | null = lab;
    for (let i = 0; i < 4 && p; i++) {
      p = p.parentElement;
      const c = p?.querySelector<HTMLElement>(CONTROL);
      if (c && visible(c) && !lab.contains(c)) return c as Control;
    }
  }
  const byHint = [...root.querySelectorAll<HTMLElement>(CONTROL)].filter(visible)
    .find((el) => { const h = norm(el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.getAttribute('name') || ''); return !!h && (h === want || h.includes(want) || want.includes(h)); });
  return (byHint as Control) || null;
}

/** The label shown for a control (to ask about it by name). */
function labelFor(c: Control): string {
  const id = c.id && document.querySelector(`label[for="${CSS.escape(c.id)}"]`);
  if (id) return (id.textContent || '').replace(/\*/g, '').trim();
  let p: HTMLElement | null = c.parentElement;
  for (let i = 0; i < 4 && p; i++) {
    const l = [...p.querySelectorAll<HTMLElement>('label, span')].find((x) => !x.contains(c) && (x.textContent || '').trim().length > 1 && (x.textContent || '').trim().length < 50);
    if (l) return (l.textContent || '').replace(/\*/g, '').trim();
    p = p.parentElement;
  }
  return c.getAttribute('placeholder') || c.getAttribute('aria-label') || c.getAttribute('name') || 'this box';
}

/** Required boxes of the form in front that are still empty. */
function emptyRequired(): Control[] {
  const root = scope();
  if (root === document) return [];
  const controls = [...root.querySelectorAll<HTMLElement>(CONTROL)].filter(visible) as Control[];
  return controls.filter((c) => {
    if (c.disabled || (c as HTMLInputElement).readOnly) return false;
    if (String(c.value || '').trim()) return false;
    if (c.required || c.getAttribute('aria-required') === 'true') return true;
    // a FormField label ends with a red "*"
    let p: HTMLElement | null = c.parentElement;
    for (let i = 0; i < 3 && p; i++) {
      const star = [...p.querySelectorAll('label, span')].find((x) => !x.contains(c) && /\*\s*$/.test((x.textContent || '').trim()));
      if (star) return true;
      p = p.parentElement;
    }
    return false;
  });
}

// ------------------------------------------------------------------ acting like a person
let ring: HTMLDivElement | null = null;
function highlight(el: HTMLElement | null) {
  if (!ring) {
    ring = document.createElement('div');
    ring.setAttribute('data-live-guide-ignore', '');
    ring.style.cssText = 'position:fixed;z-index:2147483000;pointer-events:none;border:3px solid #a855f7;border-radius:10px;box-shadow:0 0 0 4px rgba(168,85,247,.25),0 0 24px rgba(168,85,247,.55);transition:all .25s ease';
    document.body.appendChild(ring);
  }
  if (!el) { ring.style.opacity = '0'; return; }
  const r = el.getBoundingClientRect();
  Object.assign(ring.style, { opacity: '1', left: `${r.left - 5}px`, top: `${r.top - 5}px`, width: `${r.width + 10}px`, height: `${r.height + 10}px` });
}
export function clearHighlight() { if (ring) { ring.remove(); ring = null; } }

async function waitFor<T>(find: () => T | null, ms = 6000): Promise<T | null> {
  const end = Date.now() + ms;
  for (;;) {
    const v = find();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(200);
  }
}

function setNative(el: Control, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Types the value the way a person would (letter by letter), or picks the matching option of a dropdown. */
async function typeInto(el: Control, value: string): Promise<boolean> {
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  highlight(el);
  await sleep(220);
  el.focus();
  if (el instanceof HTMLSelectElement) {
    const want = norm(value);
    const opts = [...el.options];
    const opt = opts.find((o) => norm(o.text) === want || norm(o.value) === want)
      || opts.find((o) => norm(o.text).startsWith(want))
      || opts.find((o) => want && norm(o.text).includes(want));
    if (!opt) return false;
    setNative(el, opt.value);
    await sleep(250);
    return true;
  }
  const type = (el as HTMLInputElement).type;
  if (['date', 'time', 'number', 'month', 'datetime-local'].includes(type)) {
    setNative(el, value);
  } else {
    setNative(el, '');
    const step = Math.max(1, Math.ceil(value.length / 24));
    for (let i = step; i < value.length + step; i += step) { setNative(el, value.slice(0, i)); await sleep(28); }
    setNative(el, value);
  }
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  await sleep(160);
  return true;
}

async function clickLike(el: HTMLElement) {
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  highlight(el);
  await sleep(380);
  el.click();
  await sleep(650);
}

/** Ticks the checkbox of the card / row that shows this text (for example a record number). */
async function tick(text: string): Promise<boolean> {
  const want = norm(text);
  const found = await waitFor(() => {
    const cells = [...document.querySelectorAll<HTMLElement>('div, li, tr, article')].filter((el) => visible(el) && norm(el.innerText || '').includes(want) && el.querySelector('input[type="checkbox"]'));
    // the smallest card that has both the text and a checkbox
    return cells.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0] ?? null;
  });
  const box = found?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!box) return false;
  if (!box.checked) await clickLike(box);
  return true;
}

const SAVE_WORDS = /^(save|create|submit|add|update|confirm|move|done|ok|generate|post|record|book|schedule)/i;

// ------------------------------------------------------------------ the runner
let running = false;
export const uiRunning = () => running;

export async function runUiPlan(plan: UiPlan, hooks: UiHooks): Promise<UiResult> {
  if (running) return { ok: false, message: 'Another task is still being done on the screen.' };
  running = true;
  // the forms' own warnings (window.alert) are caught and told to the person instead of blocking the screen
  const alerts: string[] = [];
  const realAlert = window.alert;
  window.alert = (msg?: unknown) => { alerts.push(String(msg ?? '')); };
  const notFound: string[] = [];
  try {
    for (const step of plan.steps) {
      hooks.status(describeStep(step));
      if ('go' in step) {
        hooks.navigate(step.go);
        await sleep(1100);
      } else if ('wait' in step) {
        await sleep(step.wait);
      } else if ('tick' in step) {
        if (!(await tick(step.tick))) return { ok: false, message: `I could not find "${step.tick}" on this screen to select it.` };
      } else if ('click' in step) {
        // pressing a save button: first make sure nothing required is still empty
        if (SAVE_WORDS.test(step.click.trim())) {
          const r = await askMissing(hooks);
          if (r) return r;
        }
        const el = await waitFor(() => findClickable(step.click));
        if (!el) return { ok: false, message: `I could not find the "${step.click}" button on this screen.${notFound.length ? ` (Also not found: ${notFound.join(', ')}.)` : ''}` };
        alerts.length = 0;
        await clickLike(el);
        if (alerts.length) {
          // the form refused (for example a missing value): tell the person and let them answer
          const answer = await hooks.ask(`The form says: "${alerts.join(' ')}". Tell me what to change, or say "cancel".`);
          if (answer == null) return { ok: false, message: 'Stopped. The form is left open for you.' };
          return { ok: false, message: `The form said: ${alerts.join(' ')}` };
        }
      } else if ('fill' in step) {
        for (const [label, value] of Object.entries(step.fill)) {
          if (!value) continue;
          const el = await waitFor(() => findField(label), 4000);
          if (!el) { notFound.push(label); continue; }
          const ok = await typeInto(el, value);
          if (!ok && el instanceof HTMLSelectElement) {
            const options = [...el.options].map((o) => o.text.trim()).filter(Boolean).slice(0, 12);
            const answer = await hooks.ask(`"${value}" is not in the ${label} list. Which one? (${options.join(', ')})`, options);
            if (answer == null) return { ok: false, message: 'Stopped. The form is left open for you.' };
            await typeInto(el, answer);
          }
        }
      } else if ('ask' in step) {
        const r = await askMissing(hooks);
        if (r) return r;
      }
    }
    highlight(null);
    return { ok: true, message: `Done on screen: ${plan.title}.${notFound.length ? ` (These boxes were not on the form: ${notFound.join(', ')}.)` : ''}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  } finally {
    window.alert = realAlert;
    running = false;
    setTimeout(clearHighlight, 1200);
  }
}

/** Asks for every required box that is still empty, one by one, and types the answers. Returns a result only when stopped. */
async function askMissing(hooks: UiHooks): Promise<UiResult | null> {
  for (let round = 0; round < 12; round++) {
    const empty = emptyRequired();
    if (!empty.length) return null;
    const c = empty[0];
    c.scrollIntoView({ block: 'center', behavior: 'smooth' });
    highlight(c);
    const name = labelFor(c);
    const options = c instanceof HTMLSelectElement ? [...c.options].map((o) => o.text.trim()).filter((t) => t && !/^(--|select|choose)/i.test(t)).slice(0, 15) : undefined;
    const answer = await hooks.ask(options?.length ? `${name}? (${options.join(', ')})` : `${name}?`, options);
    if (answer == null) return { ok: false, message: 'Stopped. The form is left open for you to finish.' };
    const ok = await typeInto(c, answer);
    if (!ok) await hooks.ask(`"${answer}" is not one of the choices for ${name}. Please say one of: ${(options ?? []).join(', ')}`, options).then((a) => (a ? typeInto(c, a) : null));
  }
  return null;
}
