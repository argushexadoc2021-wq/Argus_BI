import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  Loader2,
  Pencil,
  Sparkles,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { financeApi } from '@/lib/finance';
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

export const ACTION_BADGE: Record<string, { label: string; ta: string; tone: string }> = {
  add_enquiry: { label: 'New Enquiry', ta: 'புதிய என்குயரி', tone: 'bg-sky-100 text-sky-800 border-sky-200' },
  edit_enquiry: { label: 'Edit Enquiry', ta: 'என்குயரி திருத்தம்', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  delete_enquiry: { label: 'Delete Enquiry', ta: 'என்குயரி நீக்கம்', tone: 'bg-red-100 text-red-700 border-red-200' },
  add_company: { label: 'New Company', ta: 'புதிய கம்பெனி', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  edit_company: { label: 'Edit Company', ta: 'கம்பெனி திருத்தம்', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  delete_company: { label: 'Delete Company', ta: 'கம்பெனி நீக்கம்', tone: 'bg-red-100 text-red-700 border-red-200' },
  add_quotation: { label: 'New Quotation', ta: 'புதிய கொட்டேஷன்', tone: 'bg-violet-100 text-violet-800 border-violet-200' },
  edit_quotation: { label: 'Edit Quotation', ta: 'கொட்டேஷன் திருத்தம்', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  add_sales_order: { label: 'New Sales Order', ta: 'புதிய Sales Order', tone: 'bg-teal-100 text-teal-800 border-teal-200' },
  edit_sales_order: { label: 'Edit Sales Order', ta: 'Sales Order திருத்தம்', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  delete_sales_order: { label: 'Delete Sales Order', ta: 'Sales Order நீக்கம்', tone: 'bg-red-100 text-red-700 border-red-200' },
  move_stage: { label: 'Move Pipeline Stage', ta: 'நிலை மாற்றம்', tone: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  add_task: { label: 'New Employee Task', ta: 'புதிய ஊழியர் பணி', tone: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  add_scheduled_job: { label: 'Schedule Job', ta: 'பணி திட்டமிடல்', tone: 'bg-purple-100 text-purple-800 border-purple-200' },
  add_work_order: { label: 'New Work Order', ta: 'புதிய Work Order', tone: 'bg-blue-100 text-blue-800 border-blue-200' },
  add_machine: { label: 'New Machine', ta: 'புதிய மெஷின்', tone: 'bg-blue-100 text-blue-800 border-blue-200' },
  add_process: { label: 'New Process', ta: 'புதிய Process', tone: 'bg-orange-100 text-orange-800 border-orange-200' },
  add_supplier: { label: 'New Supplier', ta: 'புதிய Supplier', tone: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  add_purchase_order: { label: 'New Purchase Order', ta: 'புதிய PO', tone: 'bg-teal-100 text-teal-800 border-teal-200' },
  add_inward: { label: 'New Inward', ta: 'புதிய Inward', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  add_delivery_challan: { label: 'New Delivery Challan', ta: 'புதிய DC', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  add_dc: { label: 'New Delivery Challan', ta: 'புதிய DC', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  add_invoice: { label: 'New Invoice', ta: 'புதிய இன்வாய்ஸ்', tone: 'bg-violet-100 text-violet-800 border-violet-200' },
  add_inventory_item: { label: 'New Stock Item', ta: 'புதிய ஸ்டாக் பொருள்', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  adjust_stock: { label: 'Stock Adjustment', ta: 'ஸ்டாக் சரிசெய்தல்', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  add_bank_entry: { label: 'Bank Entry', ta: 'வங்கி வரவு/செலவு', tone: 'bg-sky-100 text-sky-800 border-sky-200' },
  add_petty_cash: { label: 'Petty Cash', ta: 'சில்லறை செலவு', tone: 'bg-rose-100 text-rose-800 border-rose-200' },
  add_payment_received: { label: 'Payment Received', ta: 'கட்டணம் வரவு', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  punch_attendance: { label: 'Attendance Punch', ta: 'வருகை பதிவு', tone: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  apply_leave: { label: 'Apply Leave', ta: 'விடுப்பு விண்ணப்பம்', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  add_employee: { label: 'New Team Member', ta: 'புதிய ஊழியர்', tone: 'bg-blue-100 text-blue-800 border-blue-200' },
  db_insert: { label: 'Direct Database Insert', ta: 'டேட்டாபேஸ் பதிவு', tone: 'bg-purple-100 text-purple-800 border-purple-200' },
  db_update: { label: 'Direct Database Update', ta: 'டேட்டாபேஸ் திருத்தம்', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  db_delete: { label: 'Direct Database Delete', ta: 'டேட்டாபேஸ் நீக்கம்', tone: 'bg-red-100 text-red-700 border-red-200' },
};

export function defaultWhereForAction(action: string): { path: string; label: string } {
  switch (action) {
    case 'add_enquiry':
    case 'edit_enquiry':
    case 'delete_enquiry':
    case 'add_company':
    case 'edit_company':
    case 'delete_company':
    case 'add_quotation':
    case 'edit_quotation':
    case 'add_sales_order':
    case 'edit_sales_order':
    case 'delete_sales_order':
    case 'move_stage':
    case 'add_inward':
    case 'add_delivery_challan':
    case 'add_dc':
      return { path: '/sales/pipeline', label: 'Sales Pipeline' };

    case 'add_task':
    case 'add_job_card':
    case 'add_scheduled_job':
      return { path: '/production/scheduling', label: 'Production Scheduling' };

    case 'add_work_order':
    case 'edit_work_order':
      return { path: '/production/work-orders', label: 'Work Orders' };

    case 'add_machine':
      return { path: '/production/machines', label: 'Shop Floor & Machines' };

    case 'add_process':
      return { path: '/production/process-master', label: 'Process Master' };

    case 'add_supplier':
    case 'add_purchase_order':
      return { path: '/purchasing/orders', label: 'Purchase Orders & Suppliers' };

    case 'add_inventory_item':
    case 'adjust_stock':
      return { path: '/inventory/stock', label: 'Inventory & Stock' };

    case 'add_invoice':
    case 'add_payment_received':
      return { path: '/finance/invoices', label: 'Invoices & Receivables' };

    case 'add_bank_entry':
      return { path: '/finance/bank-entry', label: 'Bank Entry' };

    case 'add_petty_cash':
      return { path: '/finance/petty-cash', label: 'Petty Cash' };

    case 'punch_attendance':
      return { path: '/attendance/dashboard', label: 'AI Attendance Dashboard' };

    case 'apply_leave':
      return { path: '/attendance/leaves', label: 'Leave Applications' };

    case 'add_employee':
      return { path: '/admin/users', label: 'User & Team Management' };

    default:
      return { path: '/dashboard', label: 'Command Center' };
  }
}

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
    res = await runAction(block.action as any, p, ctx);
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
        where: { path: '/sales/pipeline', label: 'Sales Pipeline' },
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
  } else if (block.action === 'add_task') {
    const taskName = str(p.task_name || p.name || 'Shop Task');
    const memberName = str(p.member_name || p.who || p.employee || '');
    const taskDate = str(p.task_date || p.date || today());
    const startTime = str(p.start_time || '09:00').slice(0, 5);
    const endTime = str(p.end_time || '10:00').slice(0, 5);
    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      task_name: taskName,
      member_name: memberName,
      task_date: taskDate,
      start_time: startTime,
      end_time: endTime,
      mode: 'planned',
      status: 'Planned',
      machine: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_scheduled_tasks').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save task: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Task "${taskName}" assigned to ${memberName || 'team'} for ${taskDate} (${startTime}–${endTime}).`,
        where: { path: '/production/scheduling', label: 'Production Scheduling' },
      };
    }
  } else if (block.action === 'add_machine') {
    const code = str(p.code || p.machine_code || `CNC-${Math.floor(10 + Math.random() * 90)}`);
    const name = str(p.name || p.machine_name || code);
    const type = str(p.type || p.machine_type || 'VMC');
    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      code,
      name,
      type,
      status: str(p.status || 'Idle'),
      hourly_rate: num(p.hourly_rate ?? p.rate ?? 500),
      location: str(p.location || 'Shop Floor A'),
      utilization: 0,
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_machines').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save machine: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Machine ${code} — ${name} (${type}) added to Shop Floor.`,
        where: { path: '/production/machines', label: 'Shop Floor & Machines' },
      };
    }
  } else if (block.action === 'add_work_order') {
    const woNo = str(p.wo_no || `WO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    const customer = str(p.customer || p.company || 'Direct Customer');
    const partName = str(p.part_name || p.product || 'Machined Part');
    const qty = num(p.qty || p.quantity || 1);
    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      wo_no: woNo,
      customer,
      part_name: partName,
      qty_ordered: qty,
      qty_completed: 0,
      status: 'New',
      priority: str(p.priority || 'Normal'),
      order_date: today(),
      due_date: str(p.due_date || p.delivery_date || today()),
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_work_orders').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save work order: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Work Order ${woNo} created for ${customer} (${partName} × ${qty}).`,
        where: { path: '/production/work-orders', label: 'Work Orders' },
      };
    }
  } else if (block.action === 'punch_attendance') {
    const empName = str(p.employee_name || p.name || p.employee || 'Staff Member');
    const punchType = str(p.punch_type || 'Check-in');
    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      user_name: empName,
      punch_type: punchType,
      punch_time: new Date().toISOString(),
      verification_type: 'AI_AGENT',
      location: str(p.location || 'CNC Works Factory Site'),
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('attendance_logs').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not log attendance: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Attendance ${punchType} punched for ${empName} via AI Agent.`,
        where: { path: '/attendance/dashboard', label: 'AI Attendance Dashboard' },
      };
    }
  } else if (block.action === 'add_bank_entry') {
    const party = str(p.party_name || p.party || p.customer || p.supplier || 'General');
    const amt = num(p.amount || p.value || 0);
    const type = str(p.type || (amt >= 0 ? 'Receipt' : 'Payment'));
    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      party_name: party,
      amount: amt,
      type,
      transaction_date: str(p.date || today()),
      description: str(p.description || p.remarks || `AI Entry for ${party}`),
      status: 'Categorized',
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_bank_transactions').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save bank entry: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Bank entry ${type} of ₹${amt.toLocaleString('en-IN')} for ${party} recorded.`,
        where: { path: '/finance/bank-entry', label: 'Bank Entry' },
      };
    }
  } else if (block.action === 'add_petty_cash') {
    const item = str(p.item || p.description || p.remarks || 'Shop expense');
    const amt = num(p.amount || p.price || 0);
    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      inward_no: `PC-${Date.now().toString().slice(-6)}`,
      party_name: str(p.paid_to || p.vendor || 'Petty Cash Voucher'),
      part_name: item,
      quantity: 1,
      price: amt,
      petty_amount: amt,
      total_amount: amt,
      petty_cash: true,
      paid_by: str(p.paid_by || 'Cash in Hand'),
      inward_date: today(),
      status: 'Processed',
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_inwards').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save petty cash: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Petty cash voucher of ₹${amt.toLocaleString('en-IN')} for "${item}" logged.`,
        where: { path: '/finance/petty-cash', label: 'Petty Cash' },
      };
    }
  } else if (block.action === 'add_inward') {
    const party = str(p.party || p.supplier || p.customer || p.company);
    const part = str(p.part_name || p.product || 'Raw Material');
    const qty = num(p.qty || p.quantity || 1);
    const inwNo = str(p.inward_no || `INW-${Math.floor(1000 + Math.random() * 9000)}`);
    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      inward_no: inwNo,
      party_name: party,
      part_name: part,
      quantity: qty,
      price: num(p.price || 0),
      party_dc_no: str(p.party_dc_no || p.dc_no || ''),
      inward_date: today(),
      status: 'Pending',
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_inwards').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save inward: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Inward ${inwNo} recorded for ${party} (${part} × ${qty}).`,
        where: { path: '/sales/pipeline', label: 'Sales Pipeline (Inwards)' },
      };
    }
  } else if (block.action === 'add_delivery_challan' || block.action === 'add_dc') {
    const customer = str(p.customer || p.company || p.customer_name);
    const part = str(p.part_name || p.product || 'Finished Goods');
    const qty = num(p.qty || p.quantity || 1);
    const dcNo = str(p.dc_no || `DC-${Math.floor(1000 + Math.random() * 9000)}`);
    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      delivery_no: dcNo,
      customer_name: customer,
      part_name: part,
      quantity: qty,
      delivery_date: today(),
      status: 'Dispatched',
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_deliveries').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save DC: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Delivery Challan ${dcNo} created for ${customer} (${part} × ${qty}).`,
        where: { path: '/sales/pipeline', label: 'Delivery Challans' },
      };
    }
  } else if (block.action === 'add_invoice') {
    const customer = str(p.customer || p.company || p.customer_name);
    const part = str(p.part_name || p.product || 'Machined Components');
    const qty = num(p.qty || p.quantity || 1);
    const rate = num(p.rate || p.price || 100);
    const invNo = str(p.invoice_no || `INV-${Math.floor(1000 + Math.random() * 9000)}`);
    const gst = num(p.gst || 18);
    const basic = qty * rate;
    const total = Math.round(basic * (1 + gst / 100));
    try {
      // 1. Try official ERP saveInvoice RPC (calculates taxes, items, and ledger)
      const resInv = await financeApi.saveInvoice({
        invoice_no: invNo,
        invoice_type: 'Sales Invoice',
        invoice_date: today(),
        customer_name: customer,
        part_name: part,
        quantity: qty,
      }, [{
        description: part,
        quantity: qty,
        rate: rate,
        gst_rate: gst,
        discount_pct: 0
      }]);
      res = {
        ok: true,
        message: `Tax Invoice ${resInv?.invoice_no || invNo} for ₹${total.toLocaleString('en-IN')} created for ${customer}.`,
        where: { path: '/finance/invoices', label: 'Invoices' },
      };
    } catch (rpcErr) {
      // Fallback: direct insert with exact PostgreSQL schema column names (customer_name, amount, basic_value)
      const payload: Record<string, any> = {
        id: crypto.randomUUID(),
        invoice_no: invNo,
        invoice_type: 'Sales Invoice',
        customer_name: customer,
        part_name: part,
        quantity: qty,
        basic_value: basic,
        taxable_value: basic,
        amount: total,
        status: 'Pending',
        invoice_date: today(),
      };
      if (ctx.companyId) payload.company_id = ctx.companyId;
      const { error } = await supabase.from('cnc_invoices').insert([payload]);
      if (error) {
        res = { ok: false, message: `Could not save invoice: ${error.message}` };
      } else {
        res = {
          ok: true,
          message: `Tax Invoice ${invNo} for ₹${total.toLocaleString('en-IN')} created for ${customer}.`,
          where: { path: '/finance/invoices', label: 'Invoices' },
        };
      }
    }
  } else if (block.action === 'add_purchase_order') {
    const supplier = str(p.supplier || p.vendor || p.name);
    const item = str(p.item || p.material || p.product || 'Raw Material');
    const qty = num(p.qty || p.quantity || 1);
    const rate = num(p.price || p.rate || 0);
    const poNo = str(p.po_no || `PO-${Math.floor(1000 + Math.random() * 9000)}`);
    let supplierId: string | null = null;
    try {
      const { data: sRow } = await supabase.from('cnc_suppliers').select('id').ilike('name', supplier).limit(1).maybeSingle();
      if (sRow?.id) supplierId = sRow.id;
    } catch {}

    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      po_number: poNo,
      supplier_id: supplierId,
      order_date: today(),
      status: 'Draft',
      subtotal: qty * rate,
      grand_total: qty * rate,
      notes: `${item} × ${qty}`,
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_purchase_orders').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save purchase order: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Purchase Order ${poNo} created for ${supplier} (${item} × ${qty}).`,
        where: { path: '/purchasing/orders', label: 'Purchase Orders' },
      };
    }
  } else if (block.action === 'add_inventory_item') {
    const name = str(p.name || p.part_name || p.item);
    const qty = num(p.qty || p.stock || p.quantity || 0);
    const payload: Record<string, any> = {
      id: crypto.randomUUID(),
      item_code: str(p.code || `ITEM-${Math.floor(100 + Math.random() * 900)}`),
      item_name: name,
      category: str(p.category || 'Raw Material'),
      quantity: qty,
      unit: str(p.unit || 'Nos'),
      unit_price: num(p.price || p.rate || 0),
      min_stock: num(p.min_stock || 10),
    };
    if (ctx.companyId) payload.company_id = ctx.companyId;
    const { error } = await supabase.from('cnc_inventory').insert([payload]);
    if (error) {
      res = { ok: false, message: `Could not save inventory item: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Stock item "${name}" (${qty} ${payload.unit}) saved to Inventory.`,
        where: { path: '/inventory/stock', label: 'Inventory & Stock' },
      };
    }
  } else if (block.action === 'db_insert') {
    const table = str(block.table || p.table);
    if (!table) return { ok: false, message: 'Table name is required for database insert.' };
    const row = (p.data && typeof p.data === 'object') ? { ...p.data } : { ...p };
    delete row.table;
    if (!row.id) row.id = crypto.randomUUID();
    if (ctx.companyId && !row.company_id) row.company_id = ctx.companyId;
    const { error } = await supabase.from(table as never).insert([row] as never);
    if (error) {
      res = { ok: false, message: `Database insert failed into ${table}: ${error.message}` };
    } else {
      res = {
        ok: true,
        message: `Record successfully inserted into ${table}.`,
        where: block.where || { path: '/dashboard', label: 'Dashboard' },
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

  const isPending = state.status === 'pending';
  const isDestructive =
    block.action === 'delete_enquiry' ||
    block.action === 'delete_sales_order' ||
    block.action === 'delete_company';

  const summaryRows = () => {
    const p = isPending ? draftParams : block.params || {};
    const rows: Array<{ label: string; value: string }> = [];

    if (p.company || p.customer) rows.push({ label: ta ? 'கம்பெனி' : 'Company', value: str(p.company || p.customer) });
    if (p.name) rows.push({ label: ta ? 'பெயர்' : 'Name', value: str(p.name) });
    if (p.task_name) rows.push({ label: 'Task', value: str(p.task_name) });
    if (p.member_name || p.who || p.employee) rows.push({ label: ta ? 'ஊழியர்' : 'Employee', value: str(p.member_name || p.who || p.employee) });
    if (p.task_date) rows.push({ label: ta ? 'தேதி' : 'Date', value: str(p.task_date) });
    if (p.code || p.machine_code) rows.push({ label: 'Code', value: str(p.code || p.machine_code) });
    if (p.process_name) rows.push({ label: 'Process', value: str(p.process_name) });
    if (p.item || p.item_name || p.part_name || p.product) rows.push({ label: ta ? 'பொருள்' : 'Item', value: str(p.item || p.item_name || p.part_name || p.product) });
    if (p.qty || p.quantity) rows.push({ label: ta ? 'அளவு' : 'Qty', value: String(p.qty || p.quantity) });
    if (p.amount || p.price || p.rate || p.hourly_rate || p.cost_per_hour) {
      const v = p.amount || p.price || p.rate || p.hourly_rate || p.cost_per_hour;
      rows.push({ label: ta ? 'தொகை / விலை' : 'Amount / Rate', value: `₹${Number(v).toLocaleString('en-IN')}` });
    }

    if (Array.isArray(p.products)) {
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
    if (p.phone) rows.push({ label: ta ? 'போன்' : 'Phone', value: str(p.phone) });
    if (p.po_no) rows.push({ label: 'PO No', value: str(p.po_no) });
    if (p.delivery_date) rows.push({ label: ta ? 'டெலிவரி' : 'Delivery', value: str(p.delivery_date) });
    if (p.remarks) rows.push({ label: ta ? 'குறிப்பு' : 'Remarks', value: str(p.remarks) });
    return rows;
  };

  const targetWhere = block.where || defaultWhereForAction(block.action);

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-indigo-200/90 bg-white shadow-md shadow-indigo-500/5 hover:shadow-lg hover:shadow-indigo-500/10 transition-all ring-1 ring-black/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-indigo-100/80 bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-white px-3.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xs">
            <Database size={11} />
          </span>
          <span className="truncate text-[11.5px] font-black text-slate-900">
            {ta ? 'சரிபார்த்து உறுதிசெய் (Auto-Action)' : 'AI Database Automation'}
          </span>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.tone}`}>
          {ta ? badge.ta : badge.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {editing && isPending ? (
          <div className="space-y-2 text-[11.5px]">
            {Object.keys(draftParams).slice(0, 8).map((k) => {
              if (k === 'products') return null;
              return (
                <div key={k}>
                  <label className="block text-[10px] font-bold uppercase text-slate-500">
                    {k.replace(/_/g, ' ')}
                  </label>
                  <input
                    value={str(draftParams[k])}
                    onChange={(e) => setField(k, e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-[11.5px] text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1 py-0.5 text-[11px] leading-tight">
            {summaryRows().map((r, i) => (
              <span key={i} className="min-w-0">
                <span className="font-semibold text-slate-500">{r.label}: </span>
                <span className="font-bold text-slate-900">{r.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Saved confirmation with direct navigation link */}
        {state.status === 'saved' && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200">
            <div className="flex items-center gap-1.5 min-w-0">
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span className="truncate">{state.message || (ta ? 'சேமிக்கப்பட்டது!' : 'Saved successfully!')}</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenRoute(targetWhere.path)}
              className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 underline hover:text-emerald-900"
            >
              <span>{targetWhere.label}</span>
              <ExternalLink size={10} />
            </button>
          </div>
        )}

        {state.status === 'cancelled' && (
          <p className="mt-2 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
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
          <div className="mt-2 border-t border-slate-100 pt-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  onConfirm({ ...block, params: draftParams });
                }}
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-extrabold text-white shadow-sm transition-all hover:scale-[1.02] ${
                  isDestructive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 hover:brightness-110 shadow-md shadow-indigo-500/30'
                }`}
              >
                <Sparkles size={12} className="text-amber-300" />
                {isDestructive
                  ? (ta ? 'உறுதி, நீக்கு' : 'Confirm Delete')
                  : (ta ? 'தானாக டைப் செய்து சேமி (Auto-Run)' : 'Auto-Type & Save')}
              </button>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
              >
                <Pencil size={11} />
                {editing ? (ta ? 'முடி' : 'Done') : (ta ? 'திருத்து' : 'Edit')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-red-50 hover:text-red-600"
              >
                <X size={12} />
                {ta ? 'ரத்து' : 'Cancel'}
              </button>
              <span className="ml-auto text-[10px] text-slate-400">{ta ? 'அல்லது "சரி" சொல்லுங்கள்' : 'or say "Yes"'}</span>
            </div>
          </div>
        )}

        {state.status === 'saving' && (
          <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-indigo-700">
            <Loader2 size={13} className="animate-spin text-indigo-600" />
            {ta ? 'தானாக செயல்படுத்துகிறது…' : 'AI Automating…'}
          </div>
        )}
      </div>
    </div>
  );
}
