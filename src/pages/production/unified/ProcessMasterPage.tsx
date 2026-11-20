import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatINR } from '@/lib/format';
import { Badge, Button, statusToVariant } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal, FormField, FormSection, ConfirmDialog, inputClass } from '@/components/ui/Modal';
import { useHeaderKpis } from '@/contexts/HeaderKpiContext';
import { Plus, Pencil, Copy, Power, Trash2 } from 'lucide-react';

// Master record. Other production modules (Work Orders, Scheduling, Machine Log,
// Process Costing, Finished Goods) reference a process by its stable processCode
// (unique per company), never by duplicating the name inside transactions.
export interface ProcessMaster {
  id: string;
  processCode: string;
  processName: string;
  processCategory: string;
  machineType: string;
  description: string;
  costPerHour: number;  // Machine cost = Cost Per Hour × Hours run
  status: 'Active' | 'Inactive';
  notes: string;
  createdAt: string;
}

interface ProcessForm {
  processCode: string;
  processName: string;
  processCategory: string;
  machineType: string;
  description: string;
  costPerHour: string;  // Machine cost = Cost Per Hour × Hours run
  status: 'Active' | 'Inactive';
  notes: string;
}

const EMPTY_FORM: ProcessForm = {
  processCode: '',
  processName: '',
  processCategory: '',
  machineType: '',
  description: '',
  costPerHour: '',
  status: 'Active',
  notes: '',
};

function mapRow(r: any): ProcessMaster {
  return {
    id: r.id,
    processCode: r.process_code ?? '',
    processName: r.process_name ?? '',
    processCategory: r.process_category ?? '',
    machineType: r.machine_type ?? '',
    description: r.description ?? '',
    costPerHour: Number(r.cost_per_hour) || 0,
    status: r.status === 'Inactive' ? 'Inactive' : 'Active',
    notes: r.notes ?? '',
    createdAt: r.created_at ?? '',
  };
}

export function ProcessMasterPage() {
  const { setHeader, setHeaderCenter, setTabActions } = useHeaderKpis();
  const [processes, setProcesses] = useState<ProcessMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);


  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ProcessForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProcessMaster | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setTableMissing(false);
    try {
      const { data, error } = await supabase
        .from('cnc_processes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        // PGRST205 = table not in schema cache (migration not applied yet)
        if ((error as any).code === 'PGRST205') setTableMissing(true);
        else console.error('Failed to load processes:', error);
        setProcesses([]);
      } else {
        setProcesses((data ?? []).map(mapRow));
      }
    } catch (err) {
      console.error('Failed to load processes:', err);
      setProcesses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


  const openAdd = useCallback(() => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(true);
  }, []);

  useEffect(() => {
    setHeader({
      title: 'Process Master',
    });
    setHeaderCenter(null);
    setTabActions(null);   // "Add Process" sits in the table's toolbar, before Export
    return () => {
      setHeader(null);
      setHeaderCenter(null);
      setTabActions(null);
    };
  }, [openAdd, setHeader, setHeaderCenter, setTabActions]);

  const openEdit = (row: ProcessMaster) => {
    setEditId(row.id);
    setForm({
      processCode: row.processCode,
      processName: row.processName,
      processCategory: row.processCategory,
      machineType: row.machineType,
      description: row.description,
      costPerHour: String(row.costPerHour),
      status: row.status,
      notes: row.notes,
    });
    setErrors({});
    setShowForm(true);
  };

  const openDuplicate = (row: ProcessMaster) => {
    setEditId(null);
    setForm({
      processCode: `${row.processCode}-COPY`,
      processName: `${row.processName} (Copy)`,
      processCategory: row.processCategory,
      machineType: row.machineType,
      description: row.description,
      costPerHour: String(row.costPerHour),
      status: 'Active',
      notes: row.notes,
    });
    setErrors({});
    setShowForm(true);
  };

  const set = (key: keyof ProcessForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const parseCost = (value: string): number | null => {
    if (value.trim() === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return NaN as unknown as null;
    return n;
  };

  const generateProcessCode = (name: string, excludeId?: string | null): string => {
    const base = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 16) || 'PRC';
    let code = base;
    let counter = 1;
    while (processes.some((p) => p.processCode.toLowerCase() === code.toLowerCase() && p.id !== excludeId)) {
      counter++;
      code = `${base}-${counter}`;
    }
    return code;
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const name = form.processName.trim();

    if (!name) next.processName = 'Process Name is required.';

    const cph = parseCost(form.costPerHour);
    if (form.costPerHour.trim() === '') next.costPerHour = 'Cost Per Hour is required.';
    else if (cph === null || !Number.isFinite(cph as number)) next.costPerHour = 'Cost Per Hour must be a number.';
    else if ((cph as number) < 0) next.costPerHour = 'Cost Per Hour cannot be negative.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      const code = form.processCode.trim() || generateProcessCode(form.processName, editId);
      const payload = {
        process_code: code,
        process_name: form.processName.trim(),
        process_category: form.processCategory.trim() || null,
        machine_type: form.machineType.trim() || null,
        description: form.description.trim() || null,
        cost_per_hour: Number(form.costPerHour),  // Machine cost = Cost Per Hour × Hours run
        status: form.status,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editId) {
        const { error } = await supabase.from('cnc_processes').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cnc_processes').insert([{ id: crypto.randomUUID(), ...payload }]);
        if (error) throw error;
      }
      setShowForm(false);
      fetchData();
    } catch (err: any) {
      // Unique-violation backstop (in case of a race with another user)
      if (err?.code === '23505') {
        setErrors({ processCode: 'This Process Code already exists. Use a unique code.' });
      } else {
        alert('Failed to save process: ' + (err?.message ?? err));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (row: ProcessMaster) => {
    try {
      const next = row.status === 'Active' ? 'Inactive' : 'Active';
      const { error } = await supabase
        .from('cnc_processes')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Failed to update status: ' + (err?.message ?? err));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('cnc_processes').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert('Failed to delete process: ' + (err?.message ?? err));
    }
  };

  const columns: Column<ProcessMaster>[] = [
    {
      key: 'processName',
      label: 'Process Name',
      sortable: true,
      render: (r) => <span className="font-semibold text-slate-800">{r.processName}</span>,
    },
    {
      key: 'processCategory',
      label: 'Process Type',
      sortable: true,
      render: (r) =>
        r.processCategory === 'Outsource Process' ? (
          <Badge variant="warning">Outsource Process</Badge>
        ) : r.processCategory ? (
          <Badge variant="info">{r.processCategory}</Badge>
        ) : (
          <Badge variant="neutral">In-House</Badge>
        ),
    },
    {
      key: 'costPerHour',
      label: 'Cost / Hour',
      sortable: true,
      align: 'right',
      render: (r) => (
        <span className="font-semibold text-slate-800 whitespace-nowrap">
          {formatINR(r.costPerHour)}<span className="text-xs font-medium text-slate-400">/hour</span>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => (
        <Badge variant={statusToVariant(r.status)} dot>
          {r.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEdit(r)}
            title="Edit process"
            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => openDuplicate(r)}
            title="Duplicate process"
            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
          >
            <Copy size={15} />
          </button>
          <button
            onClick={() => handleToggleStatus(r)}
            title={r.status === 'Active' ? 'Deactivate process' : 'Activate process'}
            className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
          >
            <Power size={15} />
          </button>
          <button
            onClick={() => setDeleteTarget(r)}
            title="Delete process"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  const errText = (key: string) =>
    errors[key] ? <p className="text-xs font-medium text-red-600 mt-1">{errors[key]}</p> : null;

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-full">
      <div className="lg:hidden">
        <PageHeader
          title="Process Master"
          actions={
            <Button icon={<Plus size={15} />} onClick={openAdd}>
              Add Process
            </Button>
          }
        />
      </div>

      {tableMissing && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <span className="font-bold">Setup required: </span>
          the <span className="font-mono">cnc_processes</span> table does not exist yet. Apply{' '}
          <span className="font-mono">20260927000000_process_master.sql</span> to
          the database, then refresh this page.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-slate-200 border-t-brand-500 rounded-full animate-spin" style={{ borderWidth: '3px' }} />
            <p className="text-sm text-slate-400">Loading processes...</p>
          </div>
        </div>
      ) : (
        <DataTable<ProcessMaster>
          data={processes}
          columns={columns}
          title="Processes"
          onAdd={openAdd}
          addLabel="Add Process"
          inlineAdd
          searchKeys={['processCode', 'processName', 'processCategory', 'description']}
          emptyMessage={tableMissing ? 'Process table not provisioned yet' : 'No processes found'}
        />
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editId ? 'Edit Process' : 'Add Process'}
        subtitle={editId ? 'Update the process details and costing rates.' : 'Define a new manufacturing process and its costing rates.'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Process'}
            </Button>
          </>
        }
      >
        <FormSection title="Process Information">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <FormField label="Process Name" required>
                <input
                  value={form.processName}
                  onChange={(e) => set('processName', e.target.value)}
                  placeholder="e.g. 4 Axis Machining"
                  className={`${inputClass} ${errors.processName ? 'border-red-400' : ''}`}
                />
              </FormField>
              {errText('processName')}
            </div>
            <div>
              <FormField label="Process Type">
                <select
                  value={form.processCategory}
                  onChange={(e) => set('processCategory', e.target.value)}
                  className={inputClass}
                >
                  <option value="">In-House</option>
                  <option value="Outsource Process">Outsource Process</option>
                </select>
              </FormField>
            </div>
            <div>
              <FormField label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="What does this process / operation cover?"
                  rows={2}
                  className={inputClass}
                />
              </FormField>
            </div>
          </div>
        </FormSection>

        <FormSection title="Costing & Status">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FormField label="Cost Per Hour (₹)" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPerHour}
                  onChange={(e) => set('costPerHour', e.target.value)}
                  placeholder="e.g. 500"
                  className={`${inputClass} ${errors.costPerHour ? 'border-red-400' : ''}`}
                />
              </FormField>
              {errText('costPerHour')}
            </div>
            <FormField label="Status">
              <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </FormField>
          </div>
        </FormSection>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Process"
        message={`Delete process "${deleteTarget?.processName}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
