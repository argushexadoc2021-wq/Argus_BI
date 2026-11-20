import { useEffect, useMemo, useState } from 'react';
import { Award, AlertTriangle, Users } from 'lucide-react';
import { fetchScheduledTasks, type ScheduledTask } from '@/lib/scheduledTasks';
import { useTimelineData, jobSpan, seqOfJob, dur, type PlanRow } from '@/pages/production/unified/ComparisonPage';

// Dashboard > Team Performance: everything Scheduling planned for a person (production operations and tasks) set
// against what they actually did, so the review shows who finishes on time and who runs late or misses work.
//   Operation: planned in Scheduling (cnc_operation_plans) vs the job card's actual start / end.
//   Task:      a planned task vs the "done" task with the same person, name and day (Actual timeline),
//              or the planned task itself marked Completed.

const LATE_MIN = 15; // minutes of slack before a finish counts as late

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

function outcomeOf(plannedStart: Date, plannedEnd: Date, actualEnd: Date | null, running: boolean, now: Date): { outcome: Outcome; delayMin: number | null } {
  if (actualEnd) {
    const delay = (actualEnd.getTime() - plannedEnd.getTime()) / 60000;
    return { outcome: delay > LATE_MIN ? 'Late' : 'On time', delayMin: delay };
  }
  if (running) return { outcome: plannedEnd < now ? 'Late' : 'In progress', delayMin: plannedEnd < now ? (now.getTime() - plannedEnd.getTime()) / 60000 : null };
  if (plannedEnd < now) return { outcome: 'Missed', delayMin: null };
  return { outcome: plannedStart <= now ? 'In progress' : 'Upcoming', delayMin: null };
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
      const r = outcomeOf(plannedStart, plannedEnd, actualEnd, running || (spans.length > 0 && !actualEnd), now);
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
    return { planned: shown.length, onTime, late, missed, pct: onTime + late + missed ? Math.round((onTime / (onTime + late + missed)) * 100) : null };
  }, [shown]);
  const rated = people.filter((p) => p.onTimePct != null && p.onTime + p.late + p.missed >= 1);
  const best = rated[0];
  const worst = rated.length > 1 ? [...rated].sort((a, b) => (a.onTimePct! - b.onTimePct!) || (b.late + b.missed) - (a.late + a.missed))[0] : undefined;
  const problems = useMemo(() => shown.filter((i) => i.outcome === 'Late' || i.outcome === 'Missed').sort((a, b) => b.plannedEnd.getTime() - a.plannedEnd.getTime()).slice(0, 8), [shown]);

  const loading = data.loading || tasks === null;
  const pctTone = (v: number | null) => (v == null ? 'text-slate-400' : v >= 85 ? 'text-emerald-700' : v >= 60 ? 'text-amber-700' : 'text-rose-700');
  const barTone = (v: number | null) => (v == null ? 'bg-slate-300' : v >= 85 ? 'bg-emerald-500' : v >= 60 ? 'bg-amber-500' : 'bg-rose-500');
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return (
    <section data-testid="team-performance" className="mb-4 rounded-xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow bg-violet-600"><Users size={18} /></span>
        <div>
          <h2 className="text-xs font-extrabold tracking-wider uppercase text-slate-800 leading-tight">Team Performance · Planned vs Actual</h2>
          <p className="text-[11px] text-slate-500 leading-tight">What Scheduling planned for each person against what they actually did · {from.split('-').reverse().join('/')} to {to.split('-').reverse().join('/')} · late = finished more than {LATE_MIN} min after the plan</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
            {[
              ['Planned', String(total.planned), 'text-slate-900'],
              ['On time', String(total.onTime), 'text-emerald-700'],
              ['Late', String(total.late), 'text-amber-700'],
              ['Missed', String(total.missed), 'text-rose-700'],
              ['On-time rate', total.pct == null ? '—' : `${total.pct}%`, pctTone(total.pct)],
            ].map(([k, v, tone]) => (
              <div key={k} className="rounded-lg border border-slate-200 bg-white px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k}</p><p className={`text-lg font-black tabular-nums ${tone}`}>{v}</p></div>
            ))}
          </div>

          {(best || worst) && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {best && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900">
                  <Award size={18} className="text-emerald-600 shrink-0" />
                  <span><b>Best on time: {best.name}</b> · {best.onTimePct}% on time ({best.onTime} of {best.onTime + best.late + best.missed} done on time)</span>
                </div>
              )}
              {worst && worst.name !== best?.name && (worst.late + worst.missed) > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-sm text-rose-900">
                  <AlertTriangle size={18} className="text-rose-600 shrink-0" />
                  <span><b>Needs attention: {worst.name}</b> · {worst.onTimePct}% on time ({worst.late} late, {worst.missed} missed)</span>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-5">
            <div className="lg:col-span-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2">#</th><th className="px-3 py-2">Person</th><th className="px-3 py-2 text-right">Planned</th><th className="px-3 py-2 text-right">On time</th>
                  <th className="px-3 py-2 text-right">Late</th><th className="px-3 py-2 text-right">Missed</th><th className="px-3 py-2 text-right">Avg delay</th><th className="px-3 py-2 w-40">On-time rate</th>
                </tr></thead>
                <tbody>
                  {people.map((p, i) => {
                    const d = avg(p.delays);
                    return (
                      <tr key={p.name} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-400 tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{p.name}{p.open ? <span className="ml-1.5 text-[10px] font-medium text-slate-400">{p.open} open</span> : null}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.assigned}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-bold">{p.onTime}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-700">{p.late || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-700">{p.missed || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{d == null ? '—' : dur(d)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${barTone(p.onTimePct)}`} style={{ width: `${p.onTimePct ?? 0}%` }} /></div>
                            <span className={`w-9 text-right text-xs font-bold tabular-nums ${pctTone(p.onTimePct)}`}>{p.onTimePct == null ? '—' : `${p.onTimePct}%`}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="lg:col-span-2 rounded-lg border border-slate-200 bg-white">
              <p className="px-3 py-2 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">Latest late or missed work</p>
              {!problems.length ? (
                <p className="px-3 py-4 text-sm text-emerald-700">Nothing late or missed in these dates.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {problems.map((i, n) => (
                    <li key={n} className="px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 truncate">{i.person}</span>
                        <span className={`shrink-0 font-bold ${i.outcome === 'Missed' ? 'text-rose-700' : 'text-amber-700'}`}>{i.outcome === 'Missed' ? 'Missed' : `Late ${dur(i.delayMin ?? 0)}`}</span>
                      </div>
                      <div className="text-slate-500 truncate">{i.kind === 'Task' ? 'Task' : 'Operation'}: {i.what} · {i.date.split('-').reverse().join('/')}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
