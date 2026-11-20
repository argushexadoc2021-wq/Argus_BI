import { useEffect, useMemo, useState } from 'react';
import { Award, AlertTriangle, Users } from 'lucide-react';
import { DonutChart, GaugeChart, BarChart } from '@/components/ui/Charts';
import { fetchScheduledTasks, type ScheduledTask } from '@/lib/scheduledTasks';
import { useTimelineData, jobSpan, seqOfJob, dur, type PlanRow } from '@/pages/production/unified/ComparisonPage';

// Dashboard > Team Performance: everything Scheduling planned for a person (production operations and tasks) set
// against what they actually did, shown as a short picture report: who finishes on time and who runs late or misses work.
//   Operation: planned in Scheduling (cnc_operation_plans) vs the job card's actual start / end.
//   Task:      a planned task vs the "done" task with the same person, name and day (Actual timeline),
//              or the planned task itself marked Completed.

const LATE_MIN = 15; // minutes of slack before a finish counts as late
const C = { onTime: '#10b981', late: '#f59e0b', missed: '#ef4444', open: '#cbd5e1' };

type Outcome = 'On time' | 'Late' | 'Missed' | 'In progress' | 'Upcoming';
interface Item {
  person: string; kind: 'Operation' | 'Task'; what: string; date: string;
  plannedEnd: Date; actualEnd: Date | null; outcome: Outcome; delayMin: number | null;
}
interface PersonRow {
  name: string; assigned: number; onTime: number; late: number; missed: number; open: number;
  delays: number[]; onTimePct: number | null;
}

const at = (date: string, hhmm: string) => new Date(`${String(date).slice(0, 10)}T${String(hhmm || '00:00').slice(0, 5)}:00`);
const clean = (v: unknown) => { const s = String(v ?? '').trim(); return s === '—' || s === '-' ? '' : s; };
const keyOf = (s: string) => s.trim().toLowerCase();
const dmy = (d: string) => d.split('-').reverse().join('/');
const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

function outcomeOf(plannedStart: Date, plannedEnd: Date, actualEnd: Date | null, running: boolean, now: Date): { outcome: Outcome; delayMin: number | null } {
  if (actualEnd) {
    const delay = (actualEnd.getTime() - plannedEnd.getTime()) / 60000;
    return { outcome: delay > LATE_MIN ? 'Late' : 'On time', delayMin: delay };
  }
  if (running) return { outcome: plannedEnd < now ? 'Late' : 'In progress', delayMin: plannedEnd < now ? (now.getTime() - plannedEnd.getTime()) / 60000 : null };
  if (plannedEnd < now) return { outcome: 'Missed', delayMin: null };
  return { outcome: plannedStart <= now ? 'In progress' : 'Upcoming', delayMin: null };
}

/** A card with a small heading, used for each picture of the report. */
function Panel({ title, note, children, className = '' }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-3 ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{title}</p>
      {note && <p className="text-[11px] text-slate-400 leading-tight mb-2">{note}</p>}
      {children}
    </div>
  );
}

export function TeamPerformance({ from, to, onOpenScheduling }: { from: string; to: string; onOpenScheduling?: () => void }) {
  const data = useTimelineData();
  const [tasks, setTasks] = useState<ScheduledTask[] | null>(null);
  const [kind, setKind] = useState<'All' | 'Operation' | 'Task'>('All');
  useEffect(() => { let live = true; void fetchScheduledTasks({ from, to }).then((t) => { if (live) setTasks(t); }); return () => { live = false; }; }, [from, to]);

  const items = useMemo<Item[]>(() => {
    const now = new Date();
    const out: Item[] = [];
    // 1. production operations: the plan (by work order + operation) against its job cards
    type Group = { woNo: string; plans: PlanRow[]; jobs: any[] };
    const groups = new Map<string, Group>();
    for (const p of data.plans) {
      const wo = data.woById.get(String(p.work_order_id)); if (!wo) continue;
      const k = `${wo.wo_no}::${Number(p.operation_sequence) || 0}`;
      const g: Group = groups.get(k) ?? { woNo: String(wo.wo_no), plans: [], jobs: [] }; g.plans.push(p); groups.set(k, g);
    }
    for (const j of data.jobs) {
      const g = groups.get(`${j.work_order}::${seqOfJob(j)}`); if (g) g.jobs.push(j);
    }
    for (const g of groups.values()) {
      const person = clean(g.plans.find((p) => clean(p.operator))?.operator) || clean(g.jobs.find((j) => clean(j.operator))?.operator);
      if (!person) continue;
      const segs = g.plans.map((p) => ({ s: at(p.plan_date, p.start_time), e: at(p.plan_date, p.end_time) }));
      const plannedStart = new Date(Math.min(...segs.map((x) => x.s.getTime())));
      const plannedEnd = new Date(Math.max(...segs.map((x) => x.e.getTime())));
      const date = String(g.plans[0].plan_date).slice(0, 10);
      if (date < from || date > to) continue;
      const spans = g.jobs.map((j) => jobSpan(j, now)).filter(Boolean) as { start: Date; end: Date; running: boolean }[];
      const running = spans.some((x) => x.running);
      const actualEnd = spans.length && !running ? new Date(Math.max(...spans.map((x) => x.end.getTime()))) : null;
      const r = outcomeOf(plannedStart, plannedEnd, actualEnd, running, now);
      out.push({ person, kind: 'Operation', what: `${g.woNo} · ${g.plans[0].process_name || 'Operation'}`, date, plannedEnd, actualEnd, ...r });
    }
    // 2. tasks: a planned task against the done task of the same person, name and day
    const list = tasks ?? [];
    const done = list.filter((t) => t.mode === 'actual');
    const used = new Set<string>();
    for (const t of list.filter((x) => x.mode !== 'actual')) {
      const person = clean(t.member_name); if (!person) continue;
      const plannedStart = at(t.task_date, t.start_time), plannedEnd = at(t.task_date, t.end_time);
      const match = done.find((d) => !used.has(d.id) && d.task_date === t.task_date && keyOf(d.member_name) === keyOf(person) && keyOf(d.task_name) === keyOf(t.task_name));
      if (match) used.add(match.id);
      let r: { outcome: Outcome; delayMin: number | null };
      let actualEnd: Date | null = null;
      if (match) { actualEnd = at(match.task_date, match.end_time); r = outcomeOf(plannedStart, plannedEnd, actualEnd, false, now); }
      else if (t.status === 'Completed') r = { outcome: 'On time', delayMin: 0 };   // marked done, no times recorded
      else r = outcomeOf(plannedStart, plannedEnd, null, t.status === 'In Progress', now);
      out.push({ person, kind: 'Task', what: t.task_name, date: t.task_date, plannedEnd, actualEnd, ...r });
    }
    return out;
  }, [data.plans, data.jobs, data.woById, tasks, from, to]);

  const shown = useMemo(() => items.filter((i) => kind === 'All' || i.kind === kind), [items, kind]);

  const people = useMemo<PersonRow[]>(() => {
    const m = new Map<string, PersonRow>();
    for (const i of shown) {
      const k = keyOf(i.person);
      const p = m.get(k) ?? { name: i.person, assigned: 0, onTime: 0, late: 0, missed: 0, open: 0, delays: [], onTimePct: null };
      p.assigned++;
      if (i.outcome === 'On time') p.onTime++;
      else if (i.outcome === 'Late') p.late++;
      else if (i.outcome === 'Missed') p.missed++;
      else p.open++;
      if (i.delayMin != null && i.delayMin > LATE_MIN) p.delays.push(i.delayMin);
      m.set(k, p);
    }
    const rows = [...m.values()].map((p) => { const due = p.onTime + p.late + p.missed; return { ...p, onTimePct: due ? Math.round((p.onTime / due) * 100) : null }; });
    return rows.sort((a, b) => (b.onTimePct ?? -1) - (a.onTimePct ?? -1) || b.onTime - a.onTime || a.name.localeCompare(b.name));
  }, [shown]);

  const total = useMemo(() => {
    const onTime = shown.filter((i) => i.outcome === 'On time').length, late = shown.filter((i) => i.outcome === 'Late').length, missed = shown.filter((i) => i.outcome === 'Missed').length;
    const open = shown.length - onTime - late - missed;
    return { planned: shown.length, onTime, late, missed, open, pct: onTime + late + missed ? Math.round((onTime / (onTime + late + missed)) * 100) : null };
  }, [shown]);

  // day by day: the last 14 days that had work due
  const byDay = useMemo(() => {
    const m = new Map<string, { onTime: number; late: number; missed: number }>();
    for (const i of shown) {
      if (i.outcome !== 'On time' && i.outcome !== 'Late' && i.outcome !== 'Missed') continue;
      const e = m.get(i.date) ?? { onTime: 0, late: 0, missed: 0 };
      if (i.outcome === 'On time') e.onTime++; else if (i.outcome === 'Late') e.late++; else e.missed++;
      m.set(i.date, e);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([d, e]) => ({ label: shortDay(d), ...e }));
  }, [shown]);

  const rated = people.filter((p) => p.onTimePct != null);
  const best = rated[0];
  const worst = rated.length > 1 ? [...rated].sort((a, b) => (a.onTimePct! - b.onTimePct!) || (b.late + b.missed) - (a.late + a.missed))[0] : undefined;
  const problems = useMemo(() => shown.filter((i) => i.outcome === 'Late' || i.outcome === 'Missed').sort((a, b) => b.plannedEnd.getTime() - a.plannedEnd.getTime()).slice(0, 8), [shown]);

  const loading = data.loading || tasks === null;
  const pctColor = (v: number | null) => (v == null ? '#94a3b8' : v >= 85 ? C.onTime : v >= 60 ? C.late : C.missed);
  const grade = (v: number | null) => (v == null ? { t: 'Not due yet', c: 'bg-slate-100 text-slate-500' } : v >= 85 ? { t: 'Good', c: 'bg-emerald-100 text-emerald-700' } : v >= 60 ? { t: 'Fair', c: 'bg-amber-100 text-amber-700' } : { t: 'Poor', c: 'bg-rose-100 text-rose-700' });
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const n = (v: number, w: string) => `${v} ${w}${v === 1 ? '' : 's'}`;

  return (
    <section data-testid="team-performance" className="mb-4 rounded-xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow bg-violet-600"><Users size={18} /></span>
        <div>
          <h2 className="text-xs font-extrabold tracking-wider uppercase text-slate-800 leading-tight">Team Performance Report · Planned vs Actual</h2>
          <p className="text-[11px] text-slate-500 leading-tight">What Scheduling planned for each person against what they actually did · {dmy(from)} to {dmy(to)} · late = finished more than {LATE_MIN} min after the plan</p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          {(['All', 'Operation', 'Task'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${kind === k ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
              {k === 'All' ? 'All work' : k === 'Operation' ? 'Machine operations' : 'Tasks'}
            </button>
          ))}
          {onOpenScheduling && <button type="button" onClick={onOpenScheduling} className="ml-1 text-[11px] font-bold text-violet-700 hover:underline">Open Scheduling →</button>}
        </div>
      </div>

      {loading ? (
        <p className="p-4 text-sm text-slate-400">Reading the schedule…</p>
      ) : !people.length ? (
        <p className="p-4 text-sm text-slate-500">Nothing was planned for a person in these dates. Assign operators to operations and employees to tasks in Scheduling, and their planned vs actual will show here.</p>
      ) : (
        <div className="p-3 space-y-3">
          {/* 1. the whole team at a glance */}
          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title="What happened to the planned work" note={`${n(total.planned, 'piece')} of work planned`}>
              <DonutChart size={150} data={[
                { label: 'Done on time', value: total.onTime, color: C.onTime },
                { label: 'Done late', value: total.late, color: C.late },
                { label: 'Not done (missed)', value: total.missed, color: C.missed },
                { label: 'Not due yet', value: total.open, color: C.open },
              ]} />
            </Panel>
            <Panel title="Team on-time rate" note="Out of the work that was due, how much was done on time">
              <div className="flex flex-col items-center pt-1">
                <GaugeChart value={total.pct ?? 0} color={pctColor(total.pct)} size={170} />
                <span className={`-mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${grade(total.pct).c}`}>{grade(total.pct).t}</span>
              </div>
            </Panel>
            <Panel title="In short">
              <ul className="mt-1 space-y-2 text-sm text-slate-700">
                <li>📋 <b>{n(total.planned, 'piece')}</b> of work were planned for <b>{n(people.length, 'person')}</b>.</li>
                <li>✅ <b>{total.onTime}</b> done on time, ⏰ <b>{total.late}</b> done late, ❌ <b>{total.missed}</b> not done.</li>
                {best && <li className="flex gap-1.5"><Award size={16} className="text-emerald-600 shrink-0 mt-0.5" /><span>Best: <b>{best.name}</b> ({best.onTimePct}% on time)</span></li>}
                {worst && worst.name !== best?.name && worst.late + worst.missed > 0 && (
                  <li className="flex gap-1.5"><AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" /><span>Needs attention: <b>{worst.name}</b> ({worst.onTimePct}% on time, {worst.late} late, {worst.missed} missed)</span></li>
                )}
              </ul>
            </Panel>
          </div>

          {/* 2. person by person */}
          <Panel title="Person by person" note="Each bar is everything planned for that person. Green = on time, amber = late, red = missed, grey = not due yet.">
            <div className="space-y-2.5 mt-1">
              {people.map((p, i) => {
                const g = grade(p.onTimePct);
                const d = avg(p.delays);
                const seg = (v: number, color: string, label: string) => v > 0 && (
                  <div title={`${label}: ${v}`} className="h-full flex items-center justify-center text-[11px] font-bold text-white" style={{ width: `${(v / p.assigned) * 100}%`, background: color }}>{v}</div>
                );
                return (
                  <div key={p.name} className="grid grid-cols-[1.5rem_minmax(7rem,12rem)_1fr_auto] items-center gap-2.5">
                    <span className="text-xs font-bold text-slate-400 tabular-nums">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate" title={p.name}>{p.name}</p>
                      <p className="text-[11px] text-slate-400">{n(p.assigned, 'job')} planned{d != null ? ` · late by ${dur(d)} on average` : ''}</p>
                    </div>
                    <div className="h-6 rounded-md overflow-hidden flex bg-slate-100">
                      {seg(p.onTime, C.onTime, 'On time')}{seg(p.late, C.late, 'Late')}{seg(p.missed, C.missed, 'Missed')}
                      {p.open > 0 && <div title={`Not due yet: ${p.open}`} className="h-full flex items-center justify-center text-[11px] font-bold text-slate-500" style={{ width: `${(p.open / p.assigned) * 100}%`, background: C.open }}>{p.open}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 w-32 justify-end">
                      <span className="text-sm font-black tabular-nums" style={{ color: pctColor(p.onTimePct) }}>{p.onTimePct == null ? '—' : `${p.onTimePct}%`}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${g.c}`}>{g.t}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-slate-500">
              {[['On time', C.onTime], ['Late', C.late], ['Missed', C.missed], ['Not due yet', C.open]].map(([l, c]) => (
                <span key={l} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />{l}</span>
              ))}
            </div>
          </Panel>

          {/* 3. day by day + what went wrong */}
          <div className="grid gap-3 lg:grid-cols-5">
            <Panel className="lg:col-span-3" title="Day by day" note="Work that was due each day and how it went">
              {byDay.length ? (
                <BarChart height={210} data={byDay} series={[
                  { key: 'onTime', color: C.onTime, label: 'On time' },
                  { key: 'late', color: C.late, label: 'Late' },
                  { key: 'missed', color: C.missed, label: 'Missed' },
                ]} />
              ) : <p className="py-6 text-center text-sm text-slate-400">No work was due yet in these dates.</p>}
            </Panel>
            <Panel className="lg:col-span-2" title="Latest late or missed work">
              {!problems.length ? (
                <p className="py-4 text-sm text-emerald-700">Nothing late or missed in these dates. 🎉</p>
              ) : (
                <ul className="divide-y divide-slate-100 -mx-1">
                  {problems.map((i, k) => (
                    <li key={k} className="px-1 py-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 truncate">{i.person}</span>
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${i.outcome === 'Missed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{i.outcome === 'Missed' ? 'Missed' : `Late ${dur(i.delayMin ?? 0)}`}</span>
                      </div>
                      <div className="text-slate-500 truncate">{i.kind === 'Task' ? 'Task' : 'Operation'}: {i.what} · {dmy(i.date)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </section>
  );
}
