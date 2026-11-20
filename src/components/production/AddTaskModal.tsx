import { useEffect, useState } from 'react';
import { ChevronDown, Plus, Trash2, User, X } from 'lucide-react';
import { Modal, FormField, inputClass } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Card';
import { Time24 } from '@/components/ui/Time24';
import { ymd } from '@/lib/operationPlans';
import { createScheduledTask, updateScheduledTask, deleteScheduledTask, type ScheduledTask } from '@/lib/scheduledTasks';

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
  initialDate?: string;
  /** Planned page: a task for later. Actual page: a task that was done. */
  initialMode?: 'planned' | 'actual';
  initialTask?: ScheduledTask | null;
  machineOptions?: string[];
  memberOptions?: string[];
}

const QUICK = ['Machine cleaning (5S)', 'Tool preset & offsets', 'Material unloading', 'Gauge calibration', 'Preventive maintenance', 'Deburring & washing', 'Operator training'];

const toMin = (t: string) => { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const toHhmm = (m: number) => { const c = Math.max(0, Math.min(23 * 60 + 59, m)); return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`; };

interface Line { key: number; name: string; who: string; date: string; start: string; end: string }
let seq = 0;
const blank = (date: string): Line => ({ key: ++seq, name: '', who: '', date, start: '09:00', end: '10:00' });

/** A form: the task, the employee it is assigned to, the day and the time.
 *  When adding, + Add another task adds more lines, and all of them are saved together. */
export function AddTaskModal({ open, onClose, onSaved, initialDate, initialMode = 'planned', initialTask, memberOptions = [] }: AddTaskModalProps) {
  const [lines, setLines] = useState<Line[]>([blank(ymd(new Date()))]);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setActive(0);
    if (initialTask) {
      setLines([{
        key: ++seq,
        name: initialTask.task_name || '',
        who: initialTask.member_name || '',
        date: initialTask.task_date || ymd(new Date()),
        start: initialTask.start_time || '09:00',
        end: initialTask.end_time || '10:00',
      }]);
    } else {
      setLines([blank(initialDate || ymd(new Date()))]);
    }
  }, [open, initialTask, initialDate]);

  const patch = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  // a new line follows the last one: same employee and day, starting when the last one ends
  const addLine = () => {
    setLines((ls) => {
      const last = ls[ls.length - 1];
      const s = toMin(last.end);
      const next: Line = { ...blank(last.date), who: last.who, start: toHhmm(s), end: toHhmm(s + 60) };
      setActive(ls.length);
      return [...ls, next];
    });
  };
  const removeLine = (i: number) => {
    setLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls));
    setActive((a) => Math.max(0, a >= i ? a - 1 : a));
  };

  const save = async () => {
    setError('');
    const many = lines.length > 1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const where = many ? `Task ${i + 1}: ` : '';
      if (!l.name.trim()) { setActive(i); setError(`${where}enter the task name.`); return; }
      if (!l.date) { setActive(i); setError(`${where}choose the day.`); return; }
      if (toMin(l.end) <= toMin(l.start)) { setActive(i); setError(`${where}the end time must be after the start time.`); return; }
    }
    setSaving(true);
    let done = 0;
    try {
      let local = false;
      for (const l of lines) {
        const fields = {
          task_name: l.name.trim(),
          member_name: l.who.trim(),
          machine: '',
          task_date: l.date,
          start_time: l.start,
          end_time: l.end,
        };
        if (initialTask?.id) {
          const r = await updateScheduledTask(initialTask.id, fields);
          local = local || !!r?.local;
        } else {
          const r = await createScheduledTask({ ...fields, mode: initialMode, status: initialMode === 'actual' ? 'Completed' : 'Planned' });
          local = local || !!r.local;
        }
        done++;
      }
      if (local) window.alert('Saved on this computer only, because the tasks table has not been created in the database yet. Ask your administrator to run the SQL migration "20261031000000_jd_build_and_scheduled_tasks.sql".');
      onSaved?.();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (done > 0) {
        // the ones already saved stay saved: take them off the form so pressing Save again does not add them twice
        setLines((ls) => ls.slice(done));
        setActive(0);
        onSaved?.();
        setError(`${done} task${done === 1 ? '' : 's'} saved. The next one could not be saved: ${msg}`);
      } else setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initialTask?.id || !window.confirm(`Delete the task "${initialTask.task_name}"?`)) return;
    setSaving(true);
    try { await deleteScheduledTask(initialTask.id); onSaved?.(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const many = lines.length > 1;
  const lastWho = lines[lines.length - 1]?.who.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialTask ? 'Edit task' : initialMode === 'actual' ? 'Add task (done)' : 'Add task'}
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between">
          <div>{initialTask && <Button variant="secondary" className="!text-red-600 hover:!bg-red-50" onClick={() => void remove()} disabled={saving}><Trash2 size={15} /> Delete</Button>}</div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="primary" className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : initialTask ? 'Update' : many ? `Save ${lines.length} tasks` : 'Save task'}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        {lines.map((l, i) => (
          <div key={l.key} onFocusCapture={() => setActive(i)}
            className={many ? `space-y-2 rounded-lg border p-2.5 ${i === active ? 'border-indigo-300 bg-indigo-50/40' : 'border-slate-200'}` : 'space-y-2'}>
            {/* one line: task, employee, day, from, to */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_auto] lg:items-end">
              <FormField label={many ? `Task ${i + 1}` : 'Task name'} required>
                <div className="relative">
                <input type="text" aria-label="Task name" list={`add-task-name-${l.key}`} className={`${inputClass} pr-8`} placeholder="Choose or type a task"
                  value={l.name} onChange={(e) => patch(i, { name: e.target.value })} autoFocus={i === lines.length - 1} />
                <datalist id={`add-task-name-${l.key}`}>
                  {QUICK.map((q) => <option key={q} value={q} />)}
                </datalist>
                <ChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </FormField>
              <FormField label="Assign to employee">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <User size={15} />
                  </div>
                  <input
                    type="text"
                    aria-label="Assign to employee"
                    list={`add-task-who-${l.key}`}
                    className={`${inputClass} pl-9`}
                    placeholder="Choose or type name"
                    value={l.who}
                    onChange={(e) => patch(i, { who: e.target.value })}
                  />
                  <datalist id={`add-task-who-${l.key}`}>
                    {memberOptions.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </div>
              </FormField>
              <FormField label="Day" required>
                <input type="date" aria-label="Day" className={inputClass} value={l.date} onChange={(e) => patch(i, { date: e.target.value })} />
              </FormField>
              <FormField label="From" required>
                <div className="inline-flex h-[38px] w-full items-center rounded border border-slate-300 bg-white text-sm shadow-sm"><Time24 label="From" value={l.start} onChange={(v) => patch(i, { start: v })} /></div>
              </FormField>
              <FormField label="To" required>
                <div className="inline-flex h-[38px] w-full items-center rounded border border-slate-300 bg-white text-sm shadow-sm"><Time24 label="To" value={l.end} onChange={(v) => patch(i, { end: v })} /></div>
              </FormField>
              {many ? (
                <button type="button" onClick={() => removeLine(i)} title="Remove this task" aria-label={`Remove task ${i + 1}`}
                  className="h-[38px] w-9 flex items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button>
              ) : <span className="hidden lg:block w-0" />}
            </div>
          </div>
        ))}

        {!initialTask && (
          <button type="button" onClick={addLine}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-indigo-300 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">
            <Plus size={14} /> Add another task{lastWho ? ` (for ${lastWho})` : ''}
          </button>
        )}
        {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
      </form>
    </Modal>
  );
}
