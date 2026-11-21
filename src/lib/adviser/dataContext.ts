// Complete live database + full Argus BI project architecture snapshot for the ChatGPT Adviser.
// Reads every major table the signed-in user has permission to view in parallel and caches for 2 minutes.

import { supabase } from '@/lib/supabase';
import { buildReport, reportToFacts } from './insights';
import { appMap, suiteFacts } from './moduleData';

type Row = Record<string, any>;

const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (v: unknown): string => (v == null ? '' : String(v).trim());
const money = (n: number): string => `₹${Math.round(n).toLocaleString('en-IN')}`;
const day = (v: unknown): string => str(v).slice(0, 10);
const first = (r: Row, keys: string[]): unknown => { for (const k of keys) if (r[k] != null && r[k] !== '') return r[k]; return undefined; };
const CLOSED = /cancel|closed|lost|reject|declin|dropped|void/i;

const PROJECT_ARCHITECTURE = `ARGUS BI COMPLETE PROJECT MAP (every module, screen & workflow):
1. Dashboard / Sales Pipeline (/sales/in-house, /sales/pipeline): End-to-end 8-stage Kanban, List & Calendar board: Enquiry -> Quotation -> Sales Order -> Inward -> Finished Goods -> Rejected -> Delivery Challan -> Invoice (+ Qty Tracking & Pipeline Report).
2. Quotation Suite (/quotation/create, /quotation/metal-calculator, /quotation/library): Metal Weight & Cost Calculator (13 profiles with live 3D isometric preview, benchmark rates), Product Workings (BOM + Process Costing dropdown from Process Master + Create Outsource Process + Other Expenses + Profit Margin), Multi-company/Sub-company Seller switcher, PDF Templates & Themes (with/without Workings), Live PDF View & Edit in Saved Quotation Library, and WhatsApp Modal with live PDF preview & auto-download.
3. Production & Shop Floor (/production/planning, /production/scheduling, /production/tracking, /production/process-master, /production/finished-goods): Work Orders, Machine Scheduling, Machine Log / Job Cards, Process Master (In-House & Outsource Process hourly rates), Finished Goods + Costing.
4. Inventory & Purchasing (/inventory/stock, /inventory/stock-adjustment, /purchasing/suppliers, /purchasing/requisitions, /purchasing/orders, /purchasing/goods-receipt, /engineering/cnc-vault, /quality/inspection-plans, /maintenance/machines): Raw Materials, Stock Movements, Suppliers, Purchase Requisitions, POs, GRN, Products & Drawings Vault, Quality Inspection/NCR, Machine Maintenance.
5. Finance & Accounts (/finance/invoices, /finance/bank-entry, /finance/petty-cash, /accounts/ledger, /accounts/trial-balance, /accounts/profit-loss, /accounts/balance-sheet, /accounts/opening-balances, /costing/job-costing, /costing/material): Commercial & Tax Invoices (digital signature required), Bank Entry, Petty Cash, Full Accounting Books, Product & Material Costing.
6. Reports & Overview (/dashboard, /reports/production, /mind-map, /bi-chat): Executive Report (CNC Factory Command Center), Production/Sales/Inventory/Quality/Cost Reports, Interactive 3D & 2D Project Mind Map, BI Chat.
7. Administration & Suites (/admin/users, /admin/access, /admin/companies, /admin/settings, /admin/audit-logs, /admin/email-integration, /admin/jd-build, /attendance/dashboard, /store/home, /support/technical, /support/onsite): Multi-company isolation, Role & Module Access Control, Connected Mail IDs per team member, JD Build, AI Face Recognition Attendance Suite (kiosk, face enrollment, leaves, payroll, geofence), Retail Online Store (3D Storefront, Digital Store, Retail Orders), Support Center.
   - AI ATTENDANCE (/attendance/dashboard): staff punch in/out at a kiosk by face (with a liveness check); Face Enrollment registers each employee's face; the Dashboard shows today's roster (present, late, half day, absent, in the building now); Reports, Manual Entry / override, Leave apply & approve, Monthly Payslip & Payment Entry (payroll from hours x rate), Live Map & Geofence (punch only inside the factory area), Settings (shift times, late grace, half/full day hours, face match strictness).
   - RETAIL STORE (/store/home): the company's online shop on the same products: 3D storefront & catalogue, categories, Digital Store (quotations & orders for customers, Razorpay payment links, payments received), invoices raised from quotations and e-mailed to the customer with the PDF and the payment link, retail roles and price tiers. Sales partners get their OWN BI company: Regional partners come under the main company, Channel partners under a Regional (or the main company), Referral partners under a Channel / Regional; one GST No. = one partner (no duplicates); a partner sees only its own and its team's orders, never the main company's data. Partner orders also show in BI under Sales > Partner Orders and Retail Orders.
   - PRODUCTION SCHEDULING (/production/scheduling): Planned Timeline (plan operations by machine & operator, and tasks for people), Actual Timeline (what really ran), Comparison (planned vs actual), Job Board (drag unscheduled jobs onto machines & operators), Actual / Planned list views. The Dashboard's Team Performance shows who finished on time, late or missed.
   - MIND MAPS (/mind-map): visual mind maps; the Adviser can draw one in the chat and save it here.
8. AI Suite (Adviser + Embedded Co-worker): Adviser acts as full ChatGPT analyst with live DB access, charts, PDF reports, Email/WhatsApp drafting, and embedded Co-worker for oral/text data entry across all pipeline stages.`;

async function load(table: string, order = 'created_at', lim = 2000): Promise<Row[] | null> {
  try {
    let q = supabase.from(table as never).select('*').limit(lim);
    if (order) q = (q as any).order(order, { ascending: false });
    const { data, error } = await q;
    if (!error) return (data ?? []) as Row[];
    // Fallback without order if column does not exist
    const fb = await supabase.from(table as never).select('*').limit(lim);
    return fb.error ? null : ((fb.data ?? []) as Row[]);
  } catch { return null; }
}

async function loadInvoices(): Promise<Row[] | null> {
  try {
    const { data, error } = await supabase.rpc('erp_invoices', { p_type: null, p_status: null, p_customer: null, p_search: null, p_from: null, p_to: null, p_page: 1, p_page_size: 1000 } as never);
    return error ? null : (((data as { rows?: Row[] } | null)?.rows ?? []) as Row[]);
  } catch { return null; }
}

/** Month keys: this month and last month as "YYYY-MM". */
function months() {
  const d = new Date();
  const ym = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
  const last = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return { cur: ym(d), prev: ym(last), curName: d.toLocaleString('en-IN', { month: 'long', year: 'numeric' }), prevName: last.toLocaleString('en-IN', { month: 'long', year: 'numeric' }) };
}

function countBy(rows: Row[], f: (r: Row) => string, top = 8): string {
  const m = new Map<string, number>();
  rows.forEach((r) => { const k = f(r) || 'not set'; m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, n]) => `${k} ${n}`).join(', ');
}
function sumBy(rows: Row[], f: (r: Row) => string, v: (r: Row) => number, top = 8): string {
  const m = new Map<string, number>();
  rows.forEach((r) => { const k = f(r) || 'Unnamed'; m.set(k, (m.get(k) ?? 0) + v(r)); });
  return [...m.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, n]) => `${k} ${money(n)}`).join('; ');
}
const inMonth = (rows: Row[], dateKeys: string[], ym: string) => rows.filter((r) => day(first(r, dateKeys)).startsWith(ym));

async function build(can: (m: string) => boolean): Promise<string> {
  const { cur, prev, curName, prevName } = months();
  const wantInv = can('invoices') || can('menu-invoices');
  const wantBank = can('bank-entry') || can('petty-cash') || can('ledger');
  const wantProd = can('production') || can('scheduling') || can('machine-log');
  // the whole app (menus + page guides) and the other suites (Retail Store, AI Attendance, tasks...) load alongside
  const extraP = Promise.all([appMap().catch(() => ''), suiteFacts(can).catch(() => [] as string[])]);

  const [
    enq, quo, so, inw, dc, inv,
    mat, wo, jc, proc, mach, parts,
    sup, po, grn, bank, cost, cust, users, report,
  ] = await Promise.all([
    can('enquiries') || can('sales-pipeline') ? load('cnc_enquiries') : Promise.resolve(null),
    can('quotations') || can('menu-quotations') || can('sales-pipeline') ? load('cnc_quotations') : Promise.resolve(null),
    can('sales-orders') || can('menu-sales-orders') || can('sales-pipeline') ? load('cnc_sales_orders') : Promise.resolve(null),
    can('inward') || can('sales-pipeline') ? load('cnc_inwards') : Promise.resolve(null),
    can('delivery') || can('menu-delivery') || can('sales-pipeline') ? load('cnc_deliveries') : Promise.resolve(null),
    wantInv ? loadInvoices() : Promise.resolve(null),
    can('inventory') ? load('cnc_raw_materials') : Promise.resolve(null),
    wantProd ? load('cnc_work_orders') : Promise.resolve(null),
    wantProd ? load('cnc_job_cards', 'created_at', 500) : Promise.resolve(null),
    can('process-master') || wantProd || can('quotations') ? load('cnc_processes', 'process_name', 500) : Promise.resolve(null),
    wantProd || can('maintenance') ? load('cnc_machines', 'name', 300) : Promise.resolve(null),
    can('engineering') || wantProd ? load('cnc_parts', 'created_at', 500) : Promise.resolve(null),
    can('suppliers') || can('purchase-orders') ? load('cnc_suppliers', 'name', 500) : Promise.resolve(null),
    can('purchase-orders') ? load('cnc_purchase_orders', 'created_at', 500) : Promise.resolve(null),
    can('grn') ? load('cnc_goods_receipts', 'created_at', 500) : Promise.resolve(null),
    wantBank ? load('cnc_bank_transactions', 'date', 1000) : Promise.resolve(null),
    can('project-costing') || can('product-costing') || can('finished-goods') ? load('cnc_costing_sheets', 'created_at', 500) : Promise.resolve(null),
    can('companies') || can('enquiries') || can('sales-pipeline') ? load('cnc_customers', 'name', 1000) : Promise.resolve(null),
    can('admin-users') || can('admin-access') ? load('company_users', 'created_at', 300) : Promise.resolve(null),
    buildReport(can).catch(() => null),
  ]);

  const [liveMap, suites] = await extraP;
  const out: string[] = [
    PROJECT_ARCHITECTURE,
    '',
    liveMap,
    '',
    `LIVE DATABASE SNAPSHOT — Today is ${new Date().toISOString().slice(0, 10)}. This month = ${curName}, last month = ${prevName}.`,
  ];

  if (enq) {
    const d = ['received_date', 'enquiry_date', 'created_at'];
    const c = (r: Row) => str(first(r, ['customer', 'customer_name', 'company_name']));
    out.push(`ENQUIRIES: ${enq.length} total; ${inMonth(enq, d, cur).length} this month, ${inMonth(enq, d, prev).length} last month. Stages: ${countBy(enq, (r) => str(first(r, ['pipeline_stage', 'status'])))}. Top customers: ${countBy(enq, c, 8)}.`
      + ` Latest: ${enq.slice(0, 12).map((r) => `${str(first(r, ['enquiry_no', 'lead_no']))} ${c(r)}${str(r.part_name) ? ` (${str(r.part_name)}, qty ${num(r.quantity) || 1})` : ''} ${day(first(r, d))} [${str(first(r, ['pipeline_stage', 'status']))}]`).join('; ')}.`);
  }
  if (quo) {
    const d = ['date', 'quote_date', 'created_at'];
    const v = (r: Row) => num(first(r, ['total_value', 'grand_total', 'total', 'amount']));
    const c = (r: Row) => str(first(r, ['customer', 'customer_name', 'company_name']));
    const live = quo.filter((r) => !CLOSED.test(str(r.status)));
    out.push(`QUOTATIONS: ${quo.length} total worth ${money(quo.reduce((a, r) => a + v(r), 0))}; this month ${inMonth(quo, d, cur).length} (${money(inMonth(quo, d, cur).reduce((a, r) => a + v(r), 0))}), last month ${inMonth(quo, d, prev).length} (${money(inMonth(quo, d, prev).reduce((a, r) => a + v(r), 0))}). Open: ${live.length}. Statuses: ${countBy(quo, (r) => str(r.status))}. Top customers: ${sumBy(quo, c, v, 8)}.`
      + ` Latest: ${quo.slice(0, 12).map((r) => `${str(r.quote_no)} ${c(r)} ${str(r.part_name)} ${money(v(r))} ${day(first(r, d))} [${str(r.status)}]`).join('; ')}.`);
  }
  if (so) {
    const d = ['order_date', 'created_at'];
    const v = (r: Row) => num(first(r, ['total_value', 'grand_total', 'total_amount', 'total', 'amount', 'order_value']));
    const c = (r: Row) => str(first(r, ['customer', 'customer_name', 'company_name']));
    const open = so.filter((r) => !CLOSED.test(str(r.status)) && !/complete|deliver|closed/i.test(str(r.status)));
    out.push(`SALES ORDERS: ${so.length} total worth ${money(so.reduce((a, r) => a + v(r), 0))}; this month ${inMonth(so, d, cur).length} (${money(inMonth(so, d, cur).reduce((a, r) => a + v(r), 0))}), last month ${inMonth(so, d, prev).length} (${money(inMonth(so, d, prev).reduce((a, r) => a + v(r), 0))}). Open: ${open.length}. Statuses: ${countBy(so, (r) => str(r.status))}. Top customers: ${sumBy(so, c, v, 8)}.`
      + ` Latest: ${so.slice(0, 12).map((r) => `${str(r.order_no)} ${c(r)} ${str(r.part_name)} ${num(r.quantity)} pcs ${money(v(r))} due ${day(r.delivery_date) || '-'} [${str(r.status)}]`).join('; ')}.`);
  }
  if (inw) {
    const d = ['inward_date', 'created_at'];
    const v = (r: Row) => num(first(r, ['total_value', 'total_amount', 'amount', 'price']));
    const c = (r: Row) => str(first(r, ['party_name', 'customer', 'supplier_name', 'vendor']));
    out.push(`INWARDS & PURCHASES: ${inw.length} rows worth ${money(inw.reduce((a, r) => a + v(r), 0))}; this month ${inMonth(inw, d, cur).length} (${money(inMonth(inw, d, cur).reduce((a, r) => a + v(r), 0))}). By category: ${countBy(inw, (r) => str(r.category), 8)}. Top parties: ${sumBy(inw, c, v, 6)}.`
      + ` Latest: ${inw.slice(0, 10).map((r) => `${str(first(r, ['inward_no', 'reference_no']))} ${str(r.category)} ${c(r)} ${str(first(r, ['part_name', 'product_name']))} qty ${num(r.quantity)} ${money(v(r))} ${day(first(r, d))}`).join('; ')}.`);
  }
  if (dc) {
    const d = ['delivery_date', 'created_at'];
    const c = (r: Row) => str(first(r, ['customer_name', 'customer', 'company_name']));
    out.push(`DELIVERY CHALLANS: ${dc.length} total; this month ${inMonth(dc, d, cur).length}, last month ${inMonth(dc, d, prev).length}. Statuses: ${countBy(dc, (r) => str(r.status))}. Top customers: ${countBy(dc, c, 8)}.`
      + ` Latest: ${dc.slice(0, 10).map((r) => `${str(r.delivery_no)} ${c(r)} ${day(first(r, d))} [${str(r.status)}]`).join('; ')}.`);
  }
  if (inv) {
    const live = inv.filter((r) => !r.cancelled && !/credit/i.test(str(r.invoice_type)));
    const d = ['invoice_date', 'created_at'];
    const c = (r: Row) => str(first(r, ['customer_name', 'customer']));
    const tot = (rows: Row[]) => rows.reduce((a, r) => a + num(r.total), 0);
    const open = live.filter((r) => num(r.balance) > 0.5);
    out.push(`INVOICES (sales billing): ${live.length} active invoices worth ${money(tot(live))}; received ${money(live.reduce((a, r) => a + num(r.received), 0))}; unpaid ${money(open.reduce((a, r) => a + num(r.balance), 0))} across ${open.length} invoices. Billed this month ${money(tot(inMonth(live, d, cur)))} (${inMonth(live, d, cur).length}), last month ${money(tot(inMonth(live, d, prev)))} (${inMonth(live, d, prev).length}). Top customers by billing: ${sumBy(live, c, (r) => num(r.total), 10)}. Unpaid by customer: ${sumBy(open, c, (r) => num(r.balance), 10)}.`
      + ` Latest: ${live.slice(0, 12).map((r) => `${str(r.invoice_no)} ${c(r)} ${money(num(r.total))} ${day(first(r, d))}${num(r.balance) > 0.5 ? ` unpaid ${money(num(r.balance))}` : ' paid'}`).join('; ')}.`);
  }
  if (bank) {
    const d = ['date', 'transaction_date', 'created_at'];
    const isCredit = (r: Row) => /credit|receipt|deposit|inflow|in\b/i.test(str(first(r, ['type', 'tx_type', 'entry_type', 'direction'])));
    const amt = (r: Row) => Math.abs(num(first(r, ['amount', 'credit', 'debit', 'total'])));
    const credits = bank.filter(isCredit);
    const debits = bank.filter((r) => !isCredit(r));
    const petty = bank.filter((r) => /petty|cash/i.test(str(first(r, ['account', 'bank_name', 'mode', 'payment_mode', 'source']))));
    out.push(`BANK & PETTY CASH TRANSACTIONS: ${bank.length} entries; total inflow/credits ${money(credits.reduce((a, r) => a + amt(r), 0))}, total outflow/debits ${money(debits.reduce((a, r) => a + amt(r), 0))}, petty cash/cash entries ${petty.length}. This month: ${inMonth(bank, d, cur).length} txns.`
      + ` Latest: ${bank.slice(0, 10).map((r) => `${day(first(r, d))} ${str(first(r, ['type', 'entry_type']))} ${str(first(r, ['party', 'party_name', 'description', 'narration']))} ${money(amt(r))}`).join('; ')}.`);
  }
  if (wo) {
    const open = wo.filter((w) => !/complete|closed|cancel/i.test(str(w.status)));
    const made = wo.reduce((a, w) => a + num(w.completed), 0);
    const bad = wo.reduce((a, w) => a + num(w.rejected), 0);
    out.push(`PRODUCTION (work orders): ${wo.length} total, ${open.length} open. Completed ${made} pcs, rejected ${bad} pcs${made + bad ? ` (${((bad / (made + bad)) * 100).toFixed(1)}% rejection)` : ''}. Statuses: ${countBy(wo, (w) => str(w.status))}.`
      + ` Latest: ${wo.slice(0, 10).map((w) => `${str(w.wo_no)} ${str(w.part_name)} qty ${num(w.quantity)} done ${num(w.completed)} rej ${num(w.rejected)} [${str(w.status)}]`).join('; ')}.`);
  }
  if (jc && jc.length) {
    out.push(`JOB CARDS: ${jc.length} records. Statuses: ${countBy(jc, (r) => str(r.status))}. Machines used: ${countBy(jc, (r) => str(first(r, ['machine', 'machine_name'])), 8)}.`);
  }
  if (proc && proc.length) {
    const outsource = proc.filter((p) => /outsource/i.test(str(p.process_category)));
    out.push(`PROCESS MASTER (${proc.length} processes, ${outsource.length} Outsource Process): ${proc.slice(0, 50).map((p) => `${str(p.process_name)} (${str(p.process_code)})${p.process_category ? ` [${str(p.process_category)}]` : ''} ₹${num(p.cost_per_hour)}/hr ${str(p.status)}`).join('; ')}.`);
  }
  if (mach && mach.length) {
    out.push(`MACHINES (${mach.length}): ${mach.slice(0, 40).map((m) => `${str(first(m, ['name', 'machine_name', 'code']))} (${str(first(m, ['type', 'machine_type', 'category'])) || 'CNC'}) [${str(m.status) || 'Active'}]`).join('; ')}.`);
  }
  if (parts && parts.length) {
    out.push(`PRODUCTS & DRAWINGS VAULT (${parts.length} parts): ${parts.slice(0, 30).map((p) => `${str(first(p, ['part_name', 'name']))}${str(first(p, ['part_no', 'part_number', 'code'])) ? ` (${str(first(p, ['part_no', 'part_number', 'code']))})` : ''}`).join('; ')}.`);
  }
  if (cost && cost.length) {
    out.push(`COSTING SHEETS (${cost.length}): ${cost.slice(0, 12).map((c) => `${str(first(c, ['part_name', 'product_name', 'title']))} ${money(num(first(c, ['total_cost', 'unit_cost', 'grand_total'])))}`).join('; ')}.`);
  }
  if (mat) {
    const low = mat.filter((m) => num(m.min_stock) > 0 && num(m.stock_qty) <= num(m.min_stock));
    const value = mat.reduce((a, m) => a + num(m.stock_qty) * num(first(m, ['unit_cost', 'rate', 'unit_price', 'cost'])), 0);
    out.push(`INVENTORY / RAW MATERIALS: ${mat.length} items${value > 0 ? `, est. value ${money(value)}` : ''}; ${low.length} at/below min, ${mat.filter((m) => num(m.stock_qty) <= 0).length} at zero. Low stock: ${low.slice(0, 12).map((m) => `${str(first(m, ['name', 'material_code']))} ${num(m.stock_qty)} ${str(m.uom)} (min ${num(m.min_stock)})`).join('; ') || 'none'}.`);
  }
  if (sup && sup.length) {
    out.push(`SUPPLIERS (${sup.length}): ${sup.slice(0, 25).map((s) => `${str(s.name)}${str(s.city) ? ` (${str(s.city)})` : ''}`).join('; ')}.`);
  }
  if (po && po.length) {
    const v = (r: Row) => num(first(r, ['total_amount', 'total_value', 'total', 'amount']));
    out.push(`PURCHASE ORDERS (${po.length} worth ${money(po.reduce((a, r) => a + v(r), 0))}): Statuses: ${countBy(po, (r) => str(r.status))}. Latest: ${po.slice(0, 8).map((r) => `${str(first(r, ['po_no', 'order_no']))} ${str(first(r, ['supplier_name', 'supplier', 'vendor']))} ${money(v(r))} [${str(r.status)}]`).join('; ')}.`);
  }
  if (grn && grn.length) {
    out.push(`GOODS RECEIPTS / GRN: ${grn.length} receipts. Statuses: ${countBy(grn, (r) => str(r.status))}.`);
  }
  if (users && users.length) {
    out.push(`TEAM USERS (${users.length}): Roles: ${countBy(users, (u) => str(u.role))}. Active: ${users.filter((u) => str(u.status) !== 'Inactive').length}.`);
    // Each person, so "who are they?" can be answered with names and details (name — e-mail — role — status — mobile — last login).
    out.push(`TEAM USER LIST (name — e-mail — role — status — mobile — last login): ${users.slice(0, 150).map((u) => [
      str(first(u, ['full_name', 'name'])) || '(no name)',
      str(u.email) || '-',
      str(u.role) || '-',
      str(u.status) || '-',
      str(first(u, ['mobile', 'phone'])) || '-',
      day(u.last_login_at) || 'never',
    ].join(' — ')).join('; ')}.`);
  }
  out.push(...suites);
  if (cust) {
    const reach = cust.filter((c) => /@/.test(str(c.email)) || /\d{6}/.test(str(c.phone).replace(/\D/g, '')));
    out.push(`CUSTOMERS (${cust.length} total, ${reach.length} with email/phone): ${reach.slice(0, 200).map((c) => `${str(c.name)} — ${str(first(c, ['contact', 'contact_person'])) || '-'} — ${str(c.email) || '-'} — ${str(c.phone) || '-'}`).join('; ')}`);
  }

  // Month by month for the last 6 months (for graphs and trend analysis)
  const last6 = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return { ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, name: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }) }; });
  const monthly = (label: string, rows: Row[] | null, dateKeys: string[], value?: (r: Row) => number) => rows
    ? `${label}: ${last6.map((m) => { const r = inMonth(rows, dateKeys, m.ym); return `${m.name} ${value ? money(r.reduce((a, x) => a + value(x), 0)) : r.length}`; }).join(', ')}`
    : '';
  const liveInv = inv ? inv.filter((r) => !r.cancelled && !/credit/i.test(str(r.invoice_type))) : null;
  const trend = [
    monthly('Enquiries received (count)', enq, ['received_date', 'enquiry_date', 'created_at']),
    monthly('Quotations (value)', quo, ['date', 'quote_date', 'created_at'], (r) => num(first(r, ['total_value', 'grand_total', 'total', 'amount']))),
    monthly('Sales orders (value)', so, ['order_date', 'created_at'], (r) => num(first(r, ['total_value', 'grand_total', 'total_amount', 'total', 'amount', 'order_value']))),
    monthly('Delivery challans (count)', dc, ['delivery_date', 'created_at']),
    monthly('Invoiced / billed (value)', liveInv, ['invoice_date', 'created_at'], (r) => num(r.total)),
    monthly('Payments received (value)', liveInv, ['invoice_date', 'created_at'], (r) => num(r.received)),
  ].filter(Boolean);
  if (trend.length) out.push(`MONTH BY MONTH (last 6 months, oldest first):\n${trend.join('\n')}`);
  if (report) out.push(`PROBLEMS AND HIGHLIGHTS FOUND:\n${reportToFacts(report)}`);
  // the AI server takes up to 90,000 characters in all; the instructions use about 14,000 of them
  return out.join('\n').slice(0, 74000);
}

let cache: { at: number; key: string; text: Promise<string> } | null = null;

/** The figures as text for the AI (cached for two minutes per company). */
export function businessData(can: (m: string) => boolean, companyKey = ''): Promise<string> {
  if (cache && cache.key === companyKey && Date.now() - cache.at < 120_000) return cache.text;
  const text = build(can).catch(() => '');
  cache = { at: Date.now(), key: companyKey, text };
  return text;
}

/** Forget the cached figures (after records change). */
export function dropBusinessData() { cache = null; }
