import { ListTodo } from 'lucide-react';
import type { ScheduledTask } from '@/lib/scheduledTasks';

// Tasks (cleaning, tool preset, training ...) added with Add Task show in the list views as well as on the timelines.

export interface TaskFilter { search: string; from: string; to: string; machine: string; operator: string; product: string }

/** The tasks of one mode (planned / actual) that pass the list's filters. A product filter hides tasks (they have no product). */
export function filterTasks(tasks: ScheduledTask[], mode: 'planned' | 'actual', f: TaskFilter): ScheduledTask[] {
  const q = f.search.trim().toLowerCase();
  return tasks.filter((t) => {
    if ((t.mode ?? 'planned') !== mode) return false;
    if (f.product !== 'All') return false;
    if (f.from && t.task_date < f.from) return false;
    if (f.to && t.task_date > f.to) return false;
    if (f.machine !== 'All' && String(t.machine ?? '') !== f.machine) return false;
    if (f.operator !== 'All' && String(t.member_name ?? '').toLowerCase() !== f.operator.toLowerCase()) return false;
    if (q && !`${t.task_name} ${t.member_name ?? ''} ${t.machine ?? ''} task`.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => (a.task_date + a.start_time).localeCompare(b.task_date + b.start_time));
}

export const taskMinutes = (t: ScheduledTask) => {
  const m = (v: string) => { const [h, mm] = String(v || '0:0').split(':').map(Number); return (h || 0) * 60 + (mm || 0); };
  return Math.max(0, m(t.end_time) - m(t.start_time));
};

/** The task's name with a small Task tag, for the Product / Part column. */
export function TaskNameCell({ t }: { t: ScheduledTask }) {
  return (
    <>
      <div className="flex items-center gap-1.5 font-semibold text-slate-900 truncate max-w-[260px]" title={t.task_name}>
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700"><ListTodo size={10} />Task</span>
        <span className="truncate">{t.task_name}</span>
      </div>
      <div className="text-[11px] text-slate-500 truncate max-w-[260px]">{t.machine ? `Machine task` : t.member_name ? 'Team member task' : 'Task'}</div>
    </>
  );
}
