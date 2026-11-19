import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  Loader2,
  Pencil,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { runAction, type ActionCtx, type RunResult } from '@/lib/copilot/actions';
import type { DbActionBlock, DbActionType } from '@/lib/adviser/charts';

export interface DbActionUiState {
  status: 'pending' | 'saving' | 'saved' | 'cancelled' | 'error';
  message?: string;
  where?: { path: string; label: string };
}

const str = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const today = () => new Date().toISOString().split('T')[0];

const ACTION_BADGE: Record<DbActionType, { label: string; ta: string; tone: string }> = {
  add_enquiry: { label: 'New Enquiry', ta: 'புதிய என்குயரி', tone: 'bg-sky-100 text-sky-800 border-sky-200' },
  edit_enquiry: { label: 'Edit Enquiry', ta: 'என்குயரி திருத்தம்', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  delete_enquiry: { label: 'Delete Enquiry', ta: 'என்குயரி நீக்கம்', tone: 'bg-red-100 text-red-700 border-red-200' },
  add_company: { label: 'New Company', ta: 'புதிய கம்பெனி', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  add_quotation: { label: 'New Quotation', ta: 'புதிய கொட்டேஷன்', tone: 'bg-violet-100 text-violet-800 border-violet-200' },
  add_sales_order: { label: 'New Sales Order', ta: 'புதிய Sales Order', tone: 'bg-teal-100 text-teal-800 border-teal-200' },
  edit_sales_order: { label: 'Edit Sales Order', ta: 'Sales Order திருத்தம்', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  delete_sales_order: { label: 'Delete Sales Order', ta: 'Sales Order நீக்கம்', tone: 'bg-red-100 text-red-700 border-red-200' },
  move_stage: { label: 'Move Pipeline Stage', ta: 'நிலை மாற்றம்', tone: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  add_process: { label: 'New Process', ta: 'புதிய Process', tone: 'bg-orange-100 text-orange-800 border-orange-200' },
  add_supplier: { label: 'New Supplier', ta: 'புதிய Supplier', tone: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
};

/** Executes a confirmed Adviser DB action directly against Supabase and refreshes the live UI. */
export async function executeAdviserDbAction(
  block: DbActionBlock,
  ctx: ActionCtx,
): Promise<RunResult> {
  const p = block.params || {};
  let res: RunResult;

  if (
    block.action === 'add_enquiry' ||
    block.action === 'edit_enquiry' ||
    block.action === 'delete_enquiry' ||
    block.action === 'add_company' ||
    block.action === 'add_sales_order' ||
    block.action === 'edit_sales_order' ||
    block.action === 'delete_sales_order' ||
    block.action === 'move_stage'
  ) {
    res = await runAction(block.action, p, ctx);
  } else if (block.action === 'add_quotation') {
    const companyName = str(p.company || p.customer || p.name);
    if (!companyName) return { ok: false, message: 'Company name is required for a quotation.' };
    const rawItems = Array.isArray(p.products)
      ? p.products
      : p.part_name || p.product
        ? [{ name: str(p.part_name || p.product), qty: num(p.qty || p.quantity) || 1, price: num(p.price || p.unit_price), gst: num(p.gst) || 18 }]
        : [];
    const items = rawItems
      .map((it: any) => ({
        id: crypto.randomUUID(),
        partName: str(it?.name || it?.partName || it?.productName || 'Item'),
        partNumber: str(it?.partNumber || ''),
        quantity: String(num(it?.qty ?? it?.quantity) || 1),
        unitPrice: String(num(it?.price ?? it?.unitPrice) || 0),
        discount: '0',
        unitDiscount: '0',
        gst: String(it?.gst != null ? num(it.gst) : 18),
      }))
      .filter((it: any) => it.partName);
    if (!items.length) return { ok: false, message: 'At least one product is required.' };

    const qNo = `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalQty = items.reduce((sum: number, i: any) => sum + num(i.quantity), 0);
    const totalVal = items.reduce(
      (sum: number, i: any) => sum + num(i.quantity) * num(i.unitPrice) * (1 + num(i.gst) / 100),
      0,
    );
    const validDays = num(p.valid_days) || 15;
    const validTill = new Date(Date.now() + validDays * 86400_000).toISOString().split('T')[0];

    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      quote_no: qNo,
      customer: companyName,
      contact_person: str(p.contact_person),
      phone: str(p.phone),
      email: str(p.email),
      part_name: items.length > 1 ? `${items.map((i: any) => i.partName).join(', ')} (${items.length} Products)` : items[0].partName,
      part_number: '',
      description: JSON.stringify(items),
      unit_price: num(items[0].unitPrice),
      quantity: totalQty,
      total_value: Math.round(totalVal * 100) / 100,
      date: today(),
      valid_till: validTill,
      status: 'Draft',
      salesperson: '',
      discount_percent: 0,
      gst_percent: num(items[0].gst) || 18,
      payment_terms: str(p.payment_terms),
      delivery_terms: str(p.delivery_terms),
      remarks: str(p.remarks),
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_quotations').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save quotation: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Quotation ${qNo} created for ${companyName} (${items[0].partName} × ${totalQty}).`,
        where: { path: '/sales/in-house', label: 'Sales Pipeline' },
      };
    }
  } else if (block.action === 'add_process') {
    const processName = str(p.process_name || p.name);
    if (!processName) return { ok: false, message: 'Process name is required.' };
    const rawCat = str(p.process_category || p.category).toLowerCase();
    const category = rawCat.includes('outsource') || rawCat.includes('subcontract') || rawCat.includes('job')
      ? 'Outsource Process'
      : 'In-House';
    const costPerHour = num(p.cost_per_hour ?? p.rate ?? p.cost);
    const codePrefix = processName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'PROC';
    const processCode = str(p.process_code) || `${codePrefix}-${Math.floor(100 + Math.random() * 900)}`;

    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      process_code: processCode,
      process_name: processName,
      process_category: category,
      machine_type: str(p.machine_type) || null,
      description: str(p.description) || null,
      cost_per_hour: costPerHour,
      status: 'Active',
      notes: str(p.notes) || null,
      updated_at: new Date().toISOString(),
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_processes').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save process: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Process "${processName}" (${category}, ₹${costPerHour}/hr) saved to Process Master.`,
        where: { path: '/production/process-master', label: 'Process Master' },
      };
    }
  } else if (block.action === 'add_supplier') {
    const name = str(p.name || p.company);
    if (!name) return { ok: false, message: 'Supplier name is required.' };
    const payload: Record<string, any> = {
      id: `SUP-${Math.floor(1000 + Math.random() * 9000)}`,
      name,
      category: str(p.category) || 'Raw Material',
      phone: str(p.phone) || null,
      email: str(p.email) || null,
      city: str(p.city || p.address) || null,
      gst: str(p.gst) || null,
      status: 'Active',
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_suppliers').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save supplier: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Supplier "${name}" added successfully.`,
        where: { path: '/purchasing/orders', label: 'Suppliers' },
      };
    }
  } else {
    res = { ok: false, message: `Unsupported action: ${block.action}` };
  }

  if (res.ok && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('argus:data-changed'));
  }
  return res;
}

interface DbActionCardProps {
  block: DbActionBlock;
  lang: 'ta' | 'tanglish' | 'en';
  state: DbActionUiState;
  onConfirm: (editedBlock: DbActionBlock) => void;
  onCancel: () => void;
  onOpenRoute: (path: string) => void;
}

export function DbActionCard({
  block,
  lang,
  state,
  onConfirm,
  onCancel,
  onOpenRoute,
}: DbActionCardProps) {
  const ta = lang === 'ta';
  const [editing, setEditing] = useState(false);
  const [draftParams, setDraftParams] = useState<Record<string, any>>(() =>
    JSON.parse(JSON.stringify(block.params || {})),
  );

  const badge = ACTION_BADGE[block.action] ?? {
    label: block.title,
    ta: block.title,
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const setField = (key: string, val: any) =>
    setDraftParams((prev) => ({ ...prev, [key]: val }));

  const setProductField = (idx: number, key: string, val: any) =>
    setDraftParams((prev) => {
      const list = Array.isArray(prev.products) ? [...prev.products] : [{ name: '', qty: 1 }];
      list[idx] = { ...(list[idx] || {}), [key]: val };
      return { ...prev, products: list };
    });

  const isDestructive = block.action.startsWith('delete_');
  const isPending = state.status === 'pending' || state.status === 'error';

  const summaryRows = (): { label: string; value: string }[] => {
    const p = draftParams;
    const rows: { label: string; value: string }[] = [];
    if (p.company) rows.push({ label: ta ? 'கம்பெனி' : 'Company', value: str(p.company) });
    if (p.name && !p.company) rows.push({ label: ta ? 'பெயர்' : 'Name', value: str(p.name) });
    if (p.process_name) rows.push({ label: ta ? 'Process பெயர்' : 'Process Name', value: str(p.process_name) });
    if (p.process_category) rows.push({ label: ta ? 'வகை' : 'Category', value: str(p.process_category) });
    if (p.cost_per_hour != null && p.cost_per_hour !== '') rows.push({ label: ta ? 'மணி நேர விலை' : 'Cost / Hour', value: `₹${num(p.cost_per_hour)}` });
    if (p.identifier) rows.push({ label: ta ? 'பதிவு எண் / பெயர்' : 'Record', value: str(p.identifier) });
    if (p.target_stage) rows.push({ label: ta ? 'புதிய நிலை' : 'Move To', value: str(p.target_stage) });
    if (Array.isArray(p.products) && p.products.length > 0) {
      p.products.forEach((prod: any, i: number) => {
        const parts = [
          str(prod?.name || prod?.partName || '-'),
          prod?.qty != null && prod?.qty !== '' ? `Qty: ${prod.qty}` : '',
          prod?.price != null && Number(prod.price) > 0 ? `₹${prod.price}` : '',
        ].filter(Boolean);
        rows.push({
          label: p.products.length > 1 ? `${ta ? 'பொருள்' : 'Product'} ${i + 1}` : (ta ? 'பொருள்' : 'Product'),
          value: parts.join(' · '),
        });
      });
    }
    if (p.updates && typeof p.updates === 'object') {
      Object.entries(p.updates).forEach(([k, v]) => {
        if (v !== '' && v != null) rows.push({ label: k.replace(/_/g, ' '), value: String(v) });
      });
    }
    if (p.phone) rows.push({ label: ta ? 'போன்' : 'Phone', value: str(p.phone) });
    if (p.email) rows.push({ label: 'Email', value: str(p.email) });
    if (p.gst) rows.push({ label: 'GSTIN', value: str(p.gst) });
    if (p.address || p.city) rows.push({ label: ta ? 'முகவரி' : 'Address', value: str(p.address || p.city) });
    if (p.po_no) rows.push({ label: 'PO No', value: str(p.po_no) });
    if (p.delivery_date) rows.push({ label: ta ? 'டெலிவரி தேதி' : 'Delivery Date', value: str(p.delivery_date) });
    if (p.remarks) rows.push({ label: ta ? 'குறிப்பு' : 'Remarks', value: str(p.remarks) });
    return rows;
  };

  return (
    <div className="mt-2 overflow-hidden rounded-xl border-2 border-emerald-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Database size={14} className="shrink-0 text-emerald-600" />
          <span className="truncate text-[11.5px] font-extrabold text-slate-800">
            {ta ? 'விவரங்களைச் சரிபார்த்து உறுதிசெய்யவும்' : 'Check the details and confirm'}
          </span>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${badge.tone}`}>
          {ta ? badge.ta : badge.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5">
        {editing && isPending ? (
          <div className="space-y-2 text-[11.5px]">
            {(draftParams.company !== undefined ||
              block.action === 'add_enquiry' ||
              block.action === 'add_quotation' ||
              block.action === 'add_sales_order') && (
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500">
                  {ta ? 'கம்பெனி பெயர்' : 'Company Name'}
                </label>
                <input
                  value={str(draftParams.company)}
                  onChange={(e) => setField('company', e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-[12px] text-slate-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {(block.action === 'add_company' || block.action === 'add_supplier') && (
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500">
                  {ta ? 'பெயர்' : 'Name'}
                </label>
                <input
                  value={str(draftParams.name)}
                  onChange={(e) => setField('name', e.target.value)}
                  className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-[12px] text-slate-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            )}

            {block.action === 'add_process' && (
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500">Process Name</label>
                  <input
                    value={str(draftParams.process_name || draftParams.name)}
                    onChange={(e) => setField('process_name', e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-[12px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500">Cost / Hr (₹)</label>
                  <input
                    type="number"
                    value={draftParams.cost_per_hour ?? 0}
                    onChange={(e) => setField('cost_per_hour', Number(e.target.value))}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-[12px]"
                  />
                </div>
              </div>
            )}

            {Array.isArray(draftParams.products) &&
              draftParams.products.map((prod: any, idx: number) => (
                <div key={idx} className="grid grid-cols-3 gap-1.5">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-500">
                      {ta ? 'பொருள் பெயர்' : 'Product Name'}
                    </label>
                    <input
                      value={str(prod?.name)}
                      onChange={(e) => setProductField(idx, 'name', e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500">
                      {ta ? 'அளவு (Qty)' : 'Qty'}
                    </label>
                    <input
                      type="number"
                      value={prod?.qty ?? 1}
                      onChange={(e) => setProductField(idx, 'qty', Number(e.target.value))}
                      className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-[12px]"
                    />
                  </div>
                </div>
              ))}

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500">
                {ta ? 'குறிப்பு' : 'Remarks'}
              </label>
              <input
                value={str(draftParams.remarks)}
                onChange={(e) => setField('remarks', e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1 text-[12px]"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {summaryRows().map((r, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-[12px]">
                <span className="shrink-0 font-semibold text-slate-500">{r.label}:</span>
                <span className="text-right font-bold text-slate-900">{r.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Status messages */}
        {state.status === 'saved' && (
          <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11.5px] font-semibold text-emerald-800">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p>{state.message || (ta ? 'வெற்றிகரமாகச் சேமிக்கப்பட்டது!' : 'Saved successfully!')}</p>
              {state.where && (
                <button
                  type="button"
                  onClick={() => onOpenRoute(state.where!.path)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 underline hover:text-emerald-900"
                >
                  <ExternalLink size={11} />
                  {ta ? `${state.where.label}-ல் பார்` : `Open ${state.where.label}`}
                </button>
              )}
            </div>
          </div>
        )}

        {state.status === 'cancelled' && (
          <p className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500">
            {ta ? 'ரத்து செய்யப்பட்டது — எதுவும் சேமிக்கப்படவில்லை.' : 'Cancelled — nothing was saved.'}
          </p>
        )}

        {state.status === 'error' && state.message && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700">
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            <span>{state.message}</span>
          </div>
        )}

        {/* Confirm / Edit / Cancel controls */}
        {isPending && (
          <div className="mt-2.5 border-t border-slate-100 pt-2">
            <p className="mb-2 text-[11px] font-semibold text-slate-600">
              {ta
                ? 'இது சரியாக உள்ளதா? "சரி / Yes" சொல்லுங்கள் அல்லது கீழே கிளிக் செய்யுங்கள்:'
                : 'Is this correct? Say "Yes / Confirm" or click below:'}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  onConfirm({ ...block, params: draftParams });
                }}
                className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold text-white shadow-sm ${
                  isDestructive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <Check size={13} />
                {isDestructive
                  ? (ta ? 'உறுதி, நீக்கு' : 'Confirm Delete')
                  : (ta ? 'சரி, உறுதிசெய்' : 'Confirm')}
              </button>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
              >
                <Pencil size={11} />
                {editing ? (ta ? 'முடி' : 'Done') : (ta ? 'திருத்து' : 'Edit')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                <X size={12} />
                {ta ? 'ரத்து' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {state.status === 'saving' && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-700">
            <Loader2 size={13} className="animate-spin" />
            {ta ? 'சேமிக்கிறது…' : 'Saving…'}
          </div>
        )}
      </div>
    </div>
  );
}
