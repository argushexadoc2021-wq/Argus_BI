// AI Robotic Process Automation (RPA) engine for Argus BI:
// When the user tells the AI to create/insert/record data ("insert enquiry for ABC Corp 500 pcs",
// "add machine VMC-4", "add task for Janani tomorrow 10am", "punch attendance for Ramesh", etc.):
// 1. It navigates the browser to the exact destination page.
// 2. An automation HUD appears on screen, showing the AI robot auto-typing each field into the form.
// 3. It commits the data to the database with company tenant isolation.
// 4. It highlights the completed entry, plays a confirmation, and speaks aloud.

import { supabase } from '@/lib/supabase';
import type { DbActionBlock } from './charts';
import type { ActionCtx, RunResult } from '@/lib/copilot/actions';

export interface AutomationField {
  key: string;
  label: string;
  value: string;
}

export interface AutomationState {
  active: boolean;
  action: DbActionBlock | null;
  targetPath: string;
  targetLabel: string;
  step: 'idle' | 'navigating' | 'typing' | 'saving' | 'completed' | 'error';
  fields: AutomationField[];
  currentFieldIndex: number;
  typedValue: string;
  message?: string;
}

const AUTO_EXEC_KEY = 'argus.ai.auto_execute';

/** ON unless the person switched it off (the ⚡ button in the Adviser's title bar). Deletes always ask first anyway. */
export function isAutoExecuteEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_EXEC_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** A delete never runs by itself: the person confirms it on the card first. */
export function isDestructiveAction(action: string): boolean {
  return /^delete_|^db_delete$/.test(String(action || ''));
}

export function setAutoExecuteEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_EXEC_KEY, enabled ? 'true' : 'false');
    notifyListeners();
  } catch {
    // storage restricted
  }
}

let currentState: AutomationState = {
  active: false,
  action: null,
  targetPath: '',
  targetLabel: '',
  step: 'idle',
  fields: [],
  currentFieldIndex: 0,
  typedValue: '',
};

const listeners = new Set<(state: AutomationState) => void>();

function notifyListeners() {
  const copy = { ...currentState };
  listeners.forEach((l) => l(copy));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('argus:ai-automation-state', { detail: copy }));
  }
}

export function subscribeAutomation(cb: (state: AutomationState) => void): () => void {
  listeners.add(cb);
  cb({ ...currentState });
  return () => {
    listeners.delete(cb);
  };
}

export function getAutomationState(): AutomationState {
  return { ...currentState };
}

export function dismissAutomation(): void {
  currentState = {
    ...currentState,
    active: false,
    step: 'idle',
  };
  notifyListeners();
}

/** Extracts readable field labels and values from any DB action block for the typing animation */
export function extractFieldsForDisplay(block: DbActionBlock): AutomationField[] {
  const p = block.params || {};
  const out: AutomationField[] = [];

  const add = (key: string, label: string, val: unknown) => {
    const s = String(val ?? '').trim();
    if (s && s !== 'undefined' && s !== 'null') {
      out.push({ key, label, value: s });
    }
  };

  switch (block.action) {
    case 'add_enquiry':
      add('company', 'Company / Client', p.company || p.customer);
      if (Array.isArray(p.products) && p.products.length) {
        const p0 = p.products[0];
        add('product', 'Product Name', p0.name);
        add('qty', 'Quantity', p0.qty);
      } else {
        add('product', 'Product Name', p.product || p.part_name);
        add('qty', 'Quantity', p.qty || p.quantity);
      }
      add('remarks', 'Remarks', p.remarks);
      break;

    case 'add_quotation':
      add('company', 'Client', p.company || p.customer);
      if (Array.isArray(p.products) && p.products.length) {
        const p0 = p.products[0];
        add('product', 'Product', p0.name);
        add('qty', 'Quantity', p0.qty);
        add('price', 'Unit Price', p0.price ? `₹${p0.price}` : '');
      }
      add('validity', 'Validity', p.valid_days ? `${p.valid_days} Days` : '15 Days');
      add('payment_terms', 'Payment Terms', p.payment_terms);
      break;

    case 'add_sales_order':
      add('company', 'Customer', p.company || p.customer);
      if (Array.isArray(p.products) && p.products.length) {
        const p0 = p.products[0];
        add('product', 'Product', p0.name);
        add('qty', 'Quantity', p0.qty);
        add('price', 'Price', p0.price ? `₹${p0.price}` : '');
      }
      add('po_no', 'PO Number', p.po_no);
      add('delivery_date', 'Delivery Date', p.delivery_date);
      break;

    case 'add_task':
      add('task_name', 'Task Name', p.task_name || p.name);
      add('member_name', 'Assign to Employee', p.member_name || p.who || p.employee);
      add('task_date', 'Scheduled Day', p.task_date || p.date);
      add('time_range', 'Time Slot', `${p.start_time || '09:00'} – ${p.end_time || '10:00'}`);
      break;

    case 'add_machine':
      add('code', 'Machine Code', p.code || p.machine_code);
      add('name', 'Machine Name', p.name || p.machine_name);
      add('type', 'Machine Type', p.type || p.machine_type);
      add('hourly_rate', 'Hourly Rate', p.hourly_rate ? `₹${p.hourly_rate}/hr` : '');
      break;

    case 'add_process':
      add('process_name', 'Process Name', p.process_name || p.name);
      add('process_category', 'Category', p.process_category || p.category);
      add('cost_per_hour', 'Cost / Hour', p.cost_per_hour ? `₹${p.cost_per_hour}/hr` : '');
      break;

    case 'add_supplier':
      add('name', 'Supplier Name', p.name || p.company);
      add('category', 'Category', p.category);
      add('phone', 'Phone', p.phone);
      add('city', 'City', p.city || p.address);
      break;

    case 'add_work_order':
      add('wo_no', 'Work Order No', p.wo_no);
      add('customer', 'Customer', p.customer);
      add('part_name', 'Part Name', p.part_name);
      add('qty', 'Planned Qty', p.qty || p.quantity);
      break;

    case 'add_invoice':
      add('company', 'Customer / Company', p.company || p.customer || p.customer_name);
      add('product', 'Part / Product Name', p.part_name || p.product);
      add('qty', 'Quantity', p.qty || p.quantity);
      add('rate', 'Unit Rate', (p.rate || p.price) ? `₹${p.rate || p.price}` : '');
      add('invoice_no', 'Invoice Number', p.invoice_no);
      break;

    case 'add_delivery_challan':
    case 'add_dc':
      add('company', 'Customer / Company', p.company || p.customer || p.customer_name);
      add('product', 'Part Name', p.part_name || p.product);
      add('qty', 'Dispatch Quantity', p.qty || p.quantity);
      add('dc_no', 'DC Number', p.dc_no);
      break;

    case 'add_purchase_order':
      add('supplier', 'Supplier / Vendor', p.supplier || p.vendor || p.name);
      add('item', 'Item / Material', p.item || p.material || p.product);
      add('qty', 'Order Quantity', p.qty || p.quantity);
      add('price', 'Unit Price', (p.price || p.rate) ? `₹${p.price || p.rate}` : '');
      add('po_no', 'PO Number', p.po_no);
      break;

    case 'punch_attendance':
      add('employee', 'Employee Name', p.employee_name || p.name || p.employee);
      add('punch_type', 'Punch Type', p.punch_type || 'Check-in');
      add('time', 'Timestamp', p.time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
      add('location', 'Geofence Location', p.location || 'CNC Works Factory Site');
      break;

    case 'add_bank_entry':
      add('party', 'Party / Counterparty', p.party_name || p.party);
      add('amount', 'Amount', p.amount ? `₹${Number(p.amount).toLocaleString('en-IN')}` : '');
      add('type', 'Entry Type', p.type || 'Receipt');
      add('date', 'Date', p.date || new Date().toISOString().split('T')[0]);
      break;

    case 'add_petty_cash':
      add('item', 'Item / Expense', p.item || p.description || p.remarks);
      add('amount', 'Amount', p.amount ? `₹${Number(p.amount).toLocaleString('en-IN')}` : '');
      add('paid_by', 'Paid By', p.paid_by || 'Cash In Hand');
      break;

    default:
      // Generic parameters
      for (const [k, v] of Object.entries(p)) {
        if (typeof v === 'string' || typeof v === 'number') {
          add(k, k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), v);
        }
      }
      break;
  }

  return out;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the live RPA automation:
 * 1. Navigates to target screen.
 * 2. Simulates auto-typing of fields on screen with visual typewriter effect.
 * 3. Commits to the database.
 * 4. Dispatches live data-change event.
 */
export async function runAiAutomation(
  block: DbActionBlock,
  targetWhere: { path: string; label: string },
  executor: () => Promise<RunResult>,
  navigate: (path: string) => void,
): Promise<RunResult> {
  const fields = extractFieldsForDisplay(block);

  currentState = {
    active: true,
    action: block,
    targetPath: targetWhere.path,
    targetLabel: targetWhere.label,
    step: 'navigating',
    fields,
    currentFieldIndex: 0,
    typedValue: '',
    message: `Navigating to ${targetWhere.label}...`,
  };
  notifyListeners();

  // Step 1: Navigate to the destination screen
  try {
    navigate(targetWhere.path.startsWith('/') ? targetWhere.path : `/${targetWhere.path}`);
  } catch (err) {
    console.warn('Navigation error in automation:', err);
  }

  await sleep(450);

  // Step 2: Visual auto-typing simulation across fields
  currentState = {
    ...currentState,
    step: 'typing',
    message: 'Auto-filling form fields...',
  };
  notifyListeners();

  for (let fIdx = 0; fIdx < fields.length; fIdx++) {
    const f = fields[fIdx];
    currentState.currentFieldIndex = fIdx;
    currentState.typedValue = '';
    notifyListeners();

    // Type character by character (smooth speed)
    const text = f.value;
    const stepLen = Math.max(1, Math.floor(text.length / 8));
    for (let c = 0; c <= text.length; c += stepLen) {
      currentState.typedValue = text.slice(0, c);
      notifyListeners();
      await sleep(35);
    }
    currentState.typedValue = text;
    notifyListeners();
    await sleep(90);
  }

  // Step 3: Saving to database
  currentState = {
    ...currentState,
    step: 'saving',
    message: 'Committing to database with tenant isolation...',
  };
  notifyListeners();

  await sleep(250);

  let result: RunResult;
  try {
    result = await executor();
  } catch (err) {
    result = { ok: false, message: err instanceof Error ? err.message : String(err) };
  }

  // Step 4: Completion or Error
  if (result.ok) {
    currentState = {
      ...currentState,
      step: 'completed',
      message: result.message || `Saved to ${targetWhere.label} successfully!`,
    };
    notifyListeners();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('argus:data-changed'));
    }

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      if (currentState.step === 'completed') {
        dismissAutomation();
      }
    }, 4000);
  } else {
    currentState = {
      ...currentState,
      step: 'error',
      message: result.message || 'Automation failed to save.',
    };
    notifyListeners();
  }

  return result;
}
