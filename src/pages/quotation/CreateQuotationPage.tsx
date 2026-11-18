import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Calculator, Plus, UserCheck, Trash2, Package, Palette, MessageCircle, Mail, FileDown, Upload, Library, Search, X, Edit2, Check, Bookmark, BookmarkPlus, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { desktopToast } from '@/lib/desktop/toast';
import { formatINR, todayISO } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { QUOTE_UNITS, calcLine, calcTotals, emptyLine, validateQuote, type QuoteLine } from '@/lib/quotationCalc';
import { loadProducts, saveProducts, newId, validateDraft, type LibraryProduct } from '@/lib/productLibrary';
import { defaultTermsText, loadTerms, type TermsTemplate } from '@/lib/termsLibrary';
import { loadProfileStore, resolveSeller, syncProfileStore, saveProfileStore, saveProfileRemote, emptyProfile, normaliseStore, type ProfileStore, type SubCompany } from '@/lib/companyProfile';
import { newIdent, takeReuse, upsertQuote, type QuoteIdent } from '@/lib/quotationStore';
import { clientsDiffer, fillClientDetails } from '@/lib/quoteClients';
import { HsnDatalist } from '@/components/HsnDatalist';
import { HSN_LIST_ID } from '@/lib/hsnMaster';
import { ProductWorkingsPage } from './ProductWorkingsPage';
import { hasWorkings, type Workings } from '@/lib/quotationWorkings';
import { PDF_THEMES, PDF_TEMPLATES, downloadQuotePdf, exportQuoteCsv, quoteSummaryText, type PdfThemeId, type QuoteClient, type QuoteDoc } from '@/lib/quotationDocument';
import { PdfTemplateSelectorModal } from './PdfTemplateSelectorModal';

const cell = 'w-full h-8 px-2 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';
const numeric = (v: string) => v.replace(/[^0-9.,]/g, '');

let rowSeq = 0;
const newLine = () => emptyLine(`l${++rowSeq}`);

// Library units are upper-case; the quotation's unit list is title-case.
const toQuoteUnit = (u: string) => QUOTE_UNITS.find(q => q.toLowerCase() === u.toLowerCase()) ?? 'Nos';

const str = (v: unknown) => (v == null ? '' : String(v).trim());
function toClient(row: Record<string, unknown>): QuoteClient {
  const addr = str(row.address) || [row.city, row.state, row.pincode].map(str).filter(Boolean).join(', ');
  return {
    key: str(row.id) || str(row.name),
    name: str(row.name) || str(row.company_name) || str(row.company),
    email: str(row.email),
    phone: str(row.phone) || str(row.mobile),
    address: addr,
    gstin: str(row.gstin) || str(row.gst) || str(row.gst_number),
  };
}

/** Used when the page is shown as a popup (Sales Pipeline create & edit). */
export interface QuotationEmbed {
  /** Prefill from an enquiry or existing quotation. */
  client?: Partial<QuoteClient> & { name: string };
  clients?: QuoteClient[];
  lines?: Partial<QuoteLine>[];
  date?: string;
  tax?: { cgst: string; sgst: string; igst: string };
  terms?: string;
  notes?: string;
  quoteId?: string;
  quoteNo?: string;
  sellerRef?: string;
  isEdit?: boolean;
  /** Called after every successful save/export with the document, so the host can record it (e.g. as a pipeline quotation). */
  onRecord?: (doc: QuoteDoc, total: number, quoteNo: string) => Promise<void> | void;
  /** Called after a successful save to close the popup. */
  onClose?: () => void;
}

export function CreateQuotationPage({ embed }: { embed?: QuotationEmbed } = {}) {
  const { company, companies = [], email: authEmail } = useAuth();
  const [date, setDate] = useState(() => embed?.date || todayISO());
  const safeCompanies = useMemo(() => (Array.isArray(companies) ? companies.filter(Boolean) : []), [companies]);
  const [clients, setClients] = useState<QuoteClient[]>(() => {
    if (Array.isArray(embed?.clients) && embed.clients.length > 0) return embed.clients;
    if (!embed?.client) return [];
    const clientName = typeof embed.client.name === 'string' ? embed.client.name : '';
    const clientKey = embed.client.key || (clientName ? clientName.toLowerCase() : '') || 'client_1';
    return [{
      key: clientKey,
      name: clientName,
      email: embed.client.email || '',
      phone: embed.client.phone || '',
      address: embed.client.address || '',
      gstin: embed.client.gstin || '',
      ...embed.client,
    }];
  });
  const [lines, setLines] = useState<QuoteLine[]>(() => {
    const raw = embed?.lines;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.filter(Boolean).map(l => ({
        ...newLine(),
        ...l,
        hsn: String(l?.hsn ?? ''),
        description: String(l?.description ?? ''),
        qty: String(l?.qty ?? '1'),
        unit: l?.unit ? toQuoteUnit(String(l.unit)) : 'Nos',
        unitPrice: String(l?.unitPrice ?? ''),
        discount: String(l?.discount ?? '0'),
        workings: l?.workings,
      }));
    }
    return [newLine()];
  });
  const [workingsFor, setWorkingsFor] = useState<string | null>(null);
  const [tax, setTax] = useState(() => embed?.tax ?? { cgst: '9', sgst: '9', igst: '' });
  const [terms, setTerms] = useState(() => (embed?.terms !== undefined ? embed.terms : defaultTermsText(company?.id)));
  const [notes, setNotes] = useState(() => embed?.notes ?? '');
  const [theme, setTheme] = useState<PdfThemeId>(() => {
    try { return (localStorage.getItem('metal-pdf-color') as PdfThemeId) || 'orange'; } catch { return 'orange'; }
  });
  const [templateId, setTemplateId] = useState<string>(() => {
    try { return localStorage.getItem('metal-pdf-template') || 'template-1'; } catch { return 'template-1'; }
  });
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  // a message is shown at the top of the quotation: bring it into view (after the workings sheet the page is still scrolled down)
  const msgRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (msg) msgRef.current?.scrollIntoView({ block: 'nearest' }); }, [msg]);
  const [showIssues, setShowIssues] = useState(false);
  const [busy, setBusy] = useState(false);

  // Read again whenever the company changes (it can arrive after this page opens), so the phone, address and bank details of the right company are printed.
  const profileDefaults = useMemo(() => ({ orgName: company?.company_name ?? '', email: authEmail ?? '' }), [company?.company_name, authEmail]);
  const [profileStore, setProfileStore] = useState<ProfileStore>(() => loadProfileStore(company?.id, profileDefaults));
  useEffect(() => {
    let off = false;
    setProfileStore(loadProfileStore(company?.id, profileDefaults));
    void syncProfileStore(company?.id, profileDefaults).then(s => { if (!off) setProfileStore(s); }); // the company's shared profile
    return () => { off = true; };
  }, [company?.id, profileDefaults]);

  // Seller reference: empty string = primary organisation profile, or sub-company ID, or "comp_<id>"
  const [sellerRef, setSellerRef] = useState(() => embed?.sellerRef ?? '');

  // Sub-company management modal state
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subForm, setSubForm] = useState({
    id: '',
    name: '',
    gstin: '',
    address: '',
    phone: '',
    email: '',
  });
  const [subFormError, setSubFormError] = useState<string | null>(null);

  // Identity (id + number) of the quotation being worked on; assigned the first time it is saved/exported.
  const ident = useRef<QuoteIdent | null>(
    embed?.quoteNo ? { id: embed.quoteId || embed.quoteNo, seq: 0, quoteNo: embed.quoteNo } : null
  );
  const [termsMenu, setTermsMenu] = useState<TermsTemplate[] | null>(null);
  const [prodOpen, setProdOpen] = useState(false);
  const [prodList, setProdList] = useState<LibraryProduct[]>([]);

  const [pickOpen, setPickOpen] = useState(false);
  const [library, setLibrary] = useState<QuoteClient[]>([]);
  const [libState, setLibState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [search, setSearch] = useState('');

  const totals = useMemo(() => calcTotals(lines, tax), [lines, tax]);
  const rowResults = useMemo(() => lines.map(calcLine), [lines]);
  const issues = useMemo(() => validateQuote(clients.length, lines), [clients, lines]);

  // Loads the client list the first time the picker opens (and again on Retry).
  const [libTry, setLibTry] = useState(0);
  useEffect(() => {
    if (!pickOpen) return;
    let live = true;
    setLibState('loading');
    const fetchAll = async () => {
      try {
        let custQ = supabase.from('cnc_customers').select('*');
        let enqQ = supabase.from('cnc_enquiries').select('*');
        if (company?.id) { custQ = custQ.eq('company_id', company.id); enqQ = enqQ.eq('company_id', company.id); }
        let [cust, enq] = await Promise.all([custQ, enqQ]);

        // Independent fallbacks: if a company-filtered table returned error or 0 rows (e.g. shared/unscoped customers), load all accessible rows
        if (company?.id) {
          const [custFb, enqFb] = await Promise.all([
            (cust.error || (cust.data?.length ?? 0) === 0) ? supabase.from('cnc_customers').select('*') : Promise.resolve(null),
            (enq.error || (enq.data?.length ?? 0) === 0) ? supabase.from('cnc_enquiries').select('*') : Promise.resolve(null),
          ]);
          if (custFb) cust = custFb;
          if (enqFb) enq = enqFb;
        }

        if (!live) return;
        if (cust.error && enq.error) {
          console.error('Quotation: client fetch failed', cust.error, enq.error);
          setLibState('error');
          return;
        }
        const map = new Map<string, QuoteClient>();
        const add = (cl: QuoteClient) => {
          const k = cl.name.toLowerCase();
          const prev = map.get(k);
          map.set(k, prev ? { ...prev, email: prev.email || cl.email, phone: prev.phone || cl.phone, address: prev.address || cl.address, gstin: prev.gstin || cl.gstin } : { ...cl, key: k });
        };
        (cust.data ?? []).map(toClient).filter(cl => cl.name).forEach(add);
        (enq.data ?? []).map(r => toClient({ ...r, name: r.customer || r.company || r.name })).filter(cl => cl.name).forEach(add);
        setLibrary([...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
        setLibState('ready');
      } catch (err) {
        console.error('Quotation: client fetch exception', err);
        if (live) setLibState('error');
      }
    };
    void fetchAll();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickOpen, libTry, company?.id]);

  const addFromLibrary = (p: LibraryProduct) => {
    setLines(ls => [...ls, { ...newLine(), hsn: p.hsn, description: p.description ? `${p.name} - ${p.description}` : p.name, qty: p.qty, unit: toQuoteUnit(p.unit), unitPrice: p.price }]);
    setProdOpen(false);
  };
  const saveRowToLibrary = (l: QuoteLine) => {
    const name = l.description.trim();
    if (!name) { setMsg({ kind: 'err', text: 'Type a description before saving the product to the library.' }); return; }
    const list = loadProducts(company?.id);
    const draftP = { name, hsn: l.hsn.trim(), unit: l.unit.toUpperCase(), price: l.unitPrice, qty: l.qty || '1', description: '' };
    const err = validateDraft(draftP, list);
    if (err.name) { setMsg({ kind: 'err', text: err.name.startsWith('A product') ? 'This product is already in the library.' : err.name }); return; }
    const ok = saveProducts(company?.id, [{ id: newId(), createdAt: new Date().toISOString(), ...draftP, qty: err.qty ? '1' : draftP.qty }, ...list]);
    setMsg(ok ? { kind: 'ok', text: `“${name}” saved to the Product Library` } : { kind: 'err', text: 'Could not save: browser storage is unavailable or full.' });
  };

  const safeProfile = useMemo(() => profileStore?.profile || emptyProfile(company?.company_name ?? '', authEmail ?? ''), [profileStore?.profile, company?.company_name, authEmail]);
  const safeSubs = useMemo(() => (Array.isArray(profileStore?.subs) ? profileStore.subs.filter(Boolean) : []), [profileStore?.subs]);

  // Seller resolution: handles sub-company reference or company selection from ERP
  const seller = useMemo(() => {
    const currentStore = profileStore || normaliseStore(null, profileDefaults);
    if (sellerRef.startsWith('comp_')) {
      const compId = sellerRef.replace('comp_', '');
      const c = safeCompanies.find(x => x?.id === compId);
      if (c) {
        return {
          ...resolveSeller(currentStore, undefined),
          name: c.company_name || (c as any).name || 'ARGUS CNC',
        };
      }
    }
    return resolveSeller(currentStore, sellerRef);
  }, [profileStore, sellerRef, safeCompanies, profileDefaults]);

  const sellerName = seller?.name || safeProfile?.orgName || company?.company_name || 'ARGUS CNC';

  // Sub-company save handler
  const handleSaveSubCompany = async () => {
    const name = subForm.name.trim();
    if (!name) {
      setSubFormError('Sub-company name is required');
      return;
    }
    setSubFormError(null);
    const subId = subForm.id || `sub_${Date.now()}`;
    const newSub: SubCompany = {
      id: subId,
      name,
      gstin: subForm.gstin.trim().toUpperCase(),
      address: subForm.address.trim(),
      phone: subForm.phone.trim(),
      email: subForm.email.trim(),
    };
    const currentSubs = Array.isArray(profileStore?.subs) ? profileStore.subs : [];
    const existingIdx = currentSubs.findIndex(s => s.id === subId);
    let updatedSubs: SubCompany[];
    if (existingIdx >= 0) {
      updatedSubs = [...currentSubs];
      updatedSubs[existingIdx] = newSub;
    } else {
      updatedSubs = [...currentSubs, newSub];
    }
    const updatedStore: ProfileStore = {
      ...profileStore,
      subs: updatedSubs,
    };
    setProfileStore(updatedStore);
    saveProfileStore(company?.id, updatedStore);
    void saveProfileRemote(updatedStore);
    setSellerRef(subId);
    setSubModalOpen(false);
    setSubForm({ id: '', name: '', gstin: '', address: '', phone: '', email: '' });
    setMsg({ kind: 'ok', text: `Sub-company "${name}" saved and active for this quotation.` });
  };

  const handleDeleteSubCompany = (subId: string, subName: string) => {
    if (!window.confirm(`Delete sub-company profile "${subName}"?`)) return;
    const updatedSubs = (profileStore?.subs || []).filter(s => s.id !== subId);
    const updatedStore: ProfileStore = {
      ...profileStore,
      subs: updatedSubs,
    };
    setProfileStore(updatedStore);
    saveProfileStore(company?.id, updatedStore);
    void saveProfileRemote(updatedStore);
    if (sellerRef === subId) setSellerRef('');
    setMsg({ kind: 'ok', text: `Sub-company "${subName}" removed.` });
  };

  // A client that arrived without its address / GSTIN (pipeline card, older saved quotation) gets them from the company master.
  useEffect(() => {
    if (!clients.some(c => c.name && (!c.address || !c.gstin || !c.phone || !c.email))) return;
    let off = false;
    void fillClientDetails(clients, company?.id).then(next => { if (!off && clientsDiffer(clients, next)) setClients(next); });
    return () => { off = true; };
  }, [clients, company?.id]);

  const buildDoc = (): QuoteDoc => ({ quoteNo: ident.current?.quoteNo ?? '', date, sellerName, sellerRef, clients, lines, tax, terms, notes });

  // "Reuse" from the Quotation Library: load the saved quotation and keep editing the same record.
  useEffect(() => {
    if (embed) return;
    const q = takeReuse(company?.id);
    if (!q) return;
    ident.current = { id: q.id, seq: q.seq, quoteNo: q.quoteNo };
    setSellerRef(q.sellerRef && (profileStore?.subs || []).some(s => s.id === q.sellerRef) ? q.sellerRef : '');
    setDate(q.date); setClients(q.clients); setLines(q.lines.map(l => ({ ...l, id: `l${++rowSeq}` })));
    setTax(q.tax); setTerms(q.terms); setNotes(q.notes);
    setMsg({ kind: 'ok', text: `Loaded quotation #${q.seq} (${q.quoteNo}). Saving updates the same record.` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guard = (): boolean => {
    if (issues.length) { setShowIssues(true); setMsg({ kind: 'err', text: issues[0].message }); return false; }
    setShowIssues(false); return true;
  };
  const run = async (label: string, fn: () => void | Promise<void>, closeAfterSave = false) => {
    if (!guard()) return;
    setBusy(true);
    try {
      if (!ident.current) ident.current = newIdent(company?.id, date);
      await fn();
      const saved = upsertQuote(company?.id, buildDoc(), ident.current);
      if (embed?.onRecord) await embed.onRecord(buildDoc(), totals.total, ident.current.quoteNo);
      if (closeAfterSave && embed?.onClose) {
        desktopToast('success', `Quotation ${ident.current.quoteNo} saved`, undefined, 2000);
        embed.onClose();
      } else {
        setMsg(saved ? { kind: 'ok', text: `${label} · saved to Quotation Library as #${ident.current.seq}` } : { kind: 'ok', text: `${label} (could not save to the library: browser storage unavailable)` });
      }
    }
    catch (e) { console.error(e); setMsg({ kind: 'err', text: `Could not complete: ${(e as Error).message}` }); }
    finally { setBusy(false); }
  };

  const setLine = (id: string, patch: Partial<QuoteLine>) => setLines(ls => ls.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const togglePick = (c: QuoteClient) => setClients(cs => (cs.some(x => x.key === c.key) ? cs.filter(x => x.key !== c.key) : [...cs, c]));

  const shown = library.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()));
  const errAt = (i: number, k: 'qty' | 'unitPrice' | 'discount') => (showIssues ? rowResults[i].issues[k] : undefined);

  // Product Workings replaces the quotation view until you go back (the quotation state is kept as it is).
  const wl = workingsFor ? lines.find(x => x.id === workingsFor) : undefined;
  if (wl) {
    return (
      <div className={embed ? '' : 'p-4 lg:p-6 bg-grid min-h-full'}>
        <ProductWorkingsPage key={wl.id} title={wl.description} initial={wl.workings} onBack={() => setWorkingsFor(null)}
          onSave={(w: Workings, price: number, leave: boolean) => {
            const roundedPrice = (Math.round(price * 100) / 100).toFixed(2);
            setLine(wl.id, { workings: w, unitPrice: roundedPrice });
            if (leave) {
              setWorkingsFor(null);
              setMsg({ kind: 'ok', text: `Calculations saved: unit price ${formatINR(price, { decimals: 'always' })} applied to ${wl.description.trim() ? `“${wl.description.trim()}”` : 'the quotation line'}.` });
            }
          }} />
      </div>
    );
  }

  return (
    <div className={embed ? '' : 'p-2 lg:p-3 bg-grid min-h-full'}>
      <div className={embed ? 'space-y-2' : 'bg-white border border-slate-200 rounded-2xl p-2.5 space-y-2'}>
        {msg && (
          <div ref={msgRef} role="status" className={`flex items-start justify-between gap-3 text-sm rounded-lg px-3 py-2 border ${msg.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <span>{msg.text}</span><button aria-label="Dismiss" onClick={() => setMsg(null)}><X size={14} /></button>
          </div>
        )}

        {/* Client & Issuer Company Header */}
        <section className="rounded-xl border border-slate-200 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-800"><Building2 size={16} className="text-orange-500" /> Add Client / Company</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg px-2 h-8">Date:
                <input type="date" aria-label="Quotation date" value={date} onChange={e => setDate(e.target.value)} className="text-sm bg-transparent focus:outline-none cursor-pointer" />
              </label>

              {/* Company / Seller Switcher - Always Visible */}
              <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 h-8 bg-white shadow-xs">
                <Building2 size={14} className="text-orange-500 shrink-0" />
                <span className="text-xs font-semibold text-slate-600 shrink-0">Quote from:</span>
                <select
                  aria-label="Quote from company"
                  value={sellerRef}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '__add_sub__') {
                      setSubForm({ id: '', name: '', gstin: '', address: '', phone: '', email: '' });
                      setSubModalOpen(true);
                    } else {
                      setSellerRef(val);
                    }
                  }}
                  className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer max-w-[190px] truncate"
                >
                  <option value="">{safeProfile.orgName || company?.company_name || 'Primary Organisation'} (Primary)</option>
                  {safeSubs.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.gstin ? `[GST: ${s.gstin}]` : '(Sub-Company)'}
                    </option>
                  ))}
                  {safeCompanies.filter(c => c && c.company_name && c.company_name !== (safeProfile.orgName || company?.company_name)).map(c => (
                    <option key={c.id} value={`comp_${c.id}`}>
                      {c.company_name} (Company)
                    </option>
                  ))}
                  <option value="__add_sub__">+ Add / Manage Sub-Company...</option>
                </select>
                <button
                  type="button"
                  title="Add or manage sub-companies"
                  onClick={() => {
                    setSubForm({ id: '', name: '', gstin: '', address: '', phone: '', email: '' });
                    setSubModalOpen(true);
                  }}
                  className="text-slate-400 hover:text-orange-600 p-0.5 rounded transition-colors"
                >
                  <Plus size={13} />
                </button>
              </div>

              <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 h-8 flex items-center">{clients.length} {clients.length === 1 ? 'Client' : 'Clients'} Selected</span>
              <button type="button" onClick={() => { setSearch(''); setPickOpen(true); }} className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"><UserCheck size={15} /> Select Client</button>
            </div>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr>
                {['Client / Company Name', 'Email', 'Phone Number', 'Address', 'GSTIN Number', 'Act'].map(h => <th key={h} className="text-left font-semibold px-3 py-1.5">{h}</th>)}
              </tr></thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.key} className="border-t border-slate-100">
                    <td className="px-3 py-1 font-medium text-slate-800">{c.name}</td><td className="px-3 py-1">{c.email || '—'}</td><td className="px-3 py-1">{c.phone || '—'}</td>
                    <td className="px-3 py-1">{c.address || '—'}</td><td className="px-3 py-1">{c.gstin || '—'}</td>
                    <td className="px-3 py-1"><button aria-label={`Remove ${c.name}`} onClick={() => togglePick(c)} className="text-slate-400 hover:text-red-600"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clients.length === 0 && (
              <div className="flex flex-col items-center py-3 text-center">
                <Building2 size={20} className="text-slate-300 mb-1" />
                <p className="text-sm font-semibold text-slate-700">No client company attached to this quotation.</p>
                <p className="text-xs text-slate-500 mt-1">Click <button type="button" onClick={() => { setSearch(''); setPickOpen(true); }} className="font-bold text-blue-600 hover:underline cursor-pointer">Select Client</button> to choose from all companies under your account.</p>
              </div>
            )}
          </div>
        </section>

        <HsnDatalist />
        {/* Line Items Table */}
        <section className="rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[920px]">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr>
                {['Sl.No', 'HSN/SAC Code', 'Description', 'Qty', 'Unit', 'Unit Price', 'Discount %', 'Discounted Unit Price', 'Amount', 'Act'].map(h => <th key={h} className="text-left font-semibold px-2 py-1.5">{h}</th>)}
              </tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.id} className="border-t border-slate-100 align-top">
                    <td className="px-2 py-1 text-slate-500">{i + 1}</td>
                    <td className="px-2 py-1 w-28"><input className={cell} aria-label={`Row ${i + 1} HSN`} list={HSN_LIST_ID} placeholder="Select HSN" value={l.hsn} onChange={e => setLine(l.id, { hsn: e.target.value })} /></td>
                    <td className="px-2 py-1 min-w-[300px]"><div className="flex items-center gap-2"><input className={cell} aria-label={`Row ${i + 1} description`} placeholder="Type or select product…" list="saved-products" value={l.description} onChange={e => setLine(l.id, { description: e.target.value })} />
                      <button type="button" data-testid={`workings-${i}`} aria-label={`Row ${i + 1} workings`} onClick={() => setWorkingsFor(l.id)}
                        className={`shrink-0 h-8 px-2.5 text-xs font-semibold rounded-md border flex items-center gap-1 ${hasWorkings(l.workings) ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}><Calculator size={13} /> Workings</button></div></td>
                    <td className="px-2 py-1 w-24"><input className={`${cell} ${errAt(i, 'qty') ? 'border-red-400' : ''}`} inputMode="decimal" aria-label={`Row ${i + 1} quantity`} value={l.qty} onChange={e => setLine(l.id, { qty: numeric(e.target.value) })} /></td>
                    <td className="px-2 py-1 w-24"><select className={cell} aria-label={`Row ${i + 1} unit`} value={l.unit} onChange={e => setLine(l.id, { unit: e.target.value })}>{QUOTE_UNITS.map(u => <option key={u}>{u}</option>)}</select></td>
                    {/* Unit Price: rounded to 2 decimals on blur */}
                    <td className="px-2 py-1 w-32">
                      <input
                        className={`${cell} ${errAt(i, 'unitPrice') ? 'border-red-400' : ''}`}
                        inputMode="decimal"
                        aria-label={`Row ${i + 1} unit price`}
                        placeholder="0.00"
                        value={l.unitPrice}
                        onChange={e => setLine(l.id, { unitPrice: numeric(e.target.value) })}
                        onBlur={e => {
                          const val = Number(e.target.value.replace(/,/g, ''));
                          if (!Number.isNaN(val) && val > 0) {
                            setLine(l.id, { unitPrice: (Math.round(val * 100) / 100).toFixed(2) });
                          } else if (e.target.value.trim() !== '') {
                            setLine(l.id, { unitPrice: '0.00' });
                          }
                        }}
                      />
                    </td>
                    <td className="px-2 py-1 w-24">
                      <input
                        className={`${cell} ${errAt(i, 'discount') ? 'border-red-400' : ''}`}
                        inputMode="decimal"
                        aria-label={`Row ${i + 1} discount`}
                        placeholder="0"
                        value={l.discount}
                        onChange={e => setLine(l.id, { discount: numeric(e.target.value) })}
                        onBlur={e => {
                          const val = Number(e.target.value.replace(/,/g, ''));
                          if (!Number.isNaN(val) && val > 0) {
                            setLine(l.id, { discount: String(Math.min(100, Math.max(0, Math.round(val * 100) / 100))) });
                          }
                        }}
                      />
                    </td>
                    <td className="px-2 py-1 w-32 pt-2 font-mono text-slate-700" data-testid={`disc-unit-${i}`}>{rowResults[i].active && !Object.keys(rowResults[i].issues).length ? formatINR(rowResults[i].discountedUnit, { decimals: 'always' }) : (rowResults[i].active ? '—' : formatINR(0, { decimals: 'always' }))}</td>
                    <td className="px-2 py-1 w-32 pt-2 font-mono font-semibold text-slate-900" data-testid={`amount-${i}`}>{rowResults[i].active && !Object.keys(rowResults[i].issues).length ? formatINR(rowResults[i].amount, { decimals: 'always' }) : (rowResults[i].active ? '—' : formatINR(0, { decimals: 'always' }))}</td>
                    <td className="px-2 py-1 pt-2 whitespace-nowrap"><button aria-label={`Save row ${i + 1} to product library`} title="Save to Product Library" onClick={() => saveRowToLibrary(l)} className="text-slate-400 hover:text-orange-600 mr-2"><BookmarkPlus size={15} /></button><button aria-label={`Delete row ${i + 1}`} onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))} className="text-slate-400 hover:text-red-600"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lines.length === 0 && (
              <div className="flex flex-col items-center py-4 text-center">
                <Package size={28} className="text-orange-400 mb-1" />
                <p className="text-sm font-semibold text-slate-700">Quotation Sheet is Empty</p>
                <p className="text-xs text-slate-500 mt-1">Click <b className="text-blue-600">+ Add Product</b> below to add and type product details directly in the table.</p>
              </div>
            )}
          </div>
        </section>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setLines(ls => [...ls, newLine()])} className="flex items-center gap-2 h-8 px-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"><Plus size={16} /> Add Product</button>
          <button onClick={() => { setProdList(loadProducts(company?.id)); setProdOpen(true); }} className="flex items-center gap-2 h-8 px-3 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50"><Library size={16} /> From Product Library</button>
        </div>

        {/* Terms + totals */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-2 items-start">
          <div className="space-y-2">
            <section className="rounded-xl border border-slate-200 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <div><h2 className="text-sm font-bold uppercase text-slate-800">Terms &amp; Conditions</h2><p className="text-xs text-slate-500">Commercial terms, payment stages, and validity printed on PDF</p></div>
                <div className="relative">
                  <button onClick={() => setTermsMenu(m => (m ? null : loadTerms(company?.id).templates))} className="flex items-center gap-1 text-xs font-semibold text-orange-600 border border-orange-200 bg-orange-50 rounded-lg px-3 h-8"><Download size={13} /> Import T&amp;C</button>
                  {termsMenu && (
                    <div className="absolute right-0 top-9 z-10 w-64 bg-white border border-slate-200 rounded-lg shadow-lg p-1 max-h-64 overflow-y-auto">
                      {termsMenu.length === 0 && <p className="text-xs text-slate-500 p-3">No templates yet. Create some in Terms Library.</p>}
                      {termsMenu.map(t => <button key={t.id} onClick={() => { setTerms(t.body); setTermsMenu(null); }} className="block w-full text-left text-sm px-3 py-1.5 rounded hover:bg-slate-50">{t.title}</button>)}
                    </div>
                  )}
                </div>
              </div>
              <textarea aria-label="Terms and conditions" rows={3} value={terms} onChange={e => setTerms(e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-brand-500" />
            </section>
            <section className="rounded-xl border border-slate-200 p-2.5">
              <h2 className="text-sm font-bold uppercase text-slate-800">Additional Notes <span className="ml-2 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Included in PDF</span></h2>
              <p className="text-xs text-slate-500 mb-1">Dispatch instructions, special handling, or custom remarks printed on PDF</p>
              <textarea aria-label="Additional notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Delivery lead time: 7-10 working days from PO confirmation. Material test certificates (MTC) will be provided upon dispatch." className="w-full text-sm border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-brand-500" />
            </section>
          </div>

          <section className="rounded-xl border border-slate-200 p-2.5 text-sm space-y-1.5">
            <Row label="TOTAL AMOUNT BEFORE TAX :" value={totals.subtotal} testid="subtotal" />
            {([['cgst', 'CGST'], ['sgst', 'SGST'], ['igst', 'IGST']] as const).map(([k, n]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">Add: {n}</span>
                <span className="flex items-center gap-1 text-slate-500"><input aria-label={`${n} percent`} inputMode="decimal" className="w-12 h-7 text-center border border-slate-200 rounded-md" value={tax[k]} onChange={e => setTax(t => ({ ...t, [k]: numeric(e.target.value) }))} /> % :</span>
                <span className="font-mono ml-auto" data-testid={k}>{formatINR(totals[k], { decimals: 'always' })}</span>
              </div>
            ))}
            <Row label="Round Off :" value={totals.roundOff} testid="roundoff" plus />
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-900">TOTAL AMOUNT</span>
              <span className="font-mono text-xl font-bold text-orange-600" data-testid="grand-total">{formatINR(totals.total, { decimals: 'always' })}</span>
            </div>
          </section>
        </div>

        {showIssues && issues.length > 0 && (
          <ul className="text-xs text-red-600 space-y-0.5">{issues.map(i => <li key={i.message}>{i.message}</li>)}</ul>
        )}

        {/* Action Toolbar - aligned in single clean row with horizontal scroll on small screens */}
        <div className="w-full overflow-x-auto pb-1 border-t border-slate-100 pt-2">
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 min-w-max ml-auto">
            <button
              type="button"
              onClick={() => setTemplateModalOpen(true)}
              className="flex items-center gap-1.5 h-9 px-3 text-xs font-bold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-all shadow-xs cursor-pointer"
            >
              <Palette size={14} className="text-orange-500" />
              Select PDF Template & Theme · {(PDF_TEMPLATES.find(t => t.id === templateId)?.name || 'Template 1')} ({PDF_THEMES[theme]?.label || 'Orange'})
            </button>
            <ActionBtn cls="bg-[#25D366] hover:bg-[#20ba59] text-white" icon={<MessageCircle size={14} />} disabled={busy}
              onClick={() => run('Opened WhatsApp with the quotation summary', () => { const d = buildDoc(); window.open(`https://wa.me/?text=${encodeURIComponent(quoteSummaryText(d))}`, '_blank', 'noopener'); })}>Send to Whatsapp</ActionBtn>
            <ActionBtn cls="bg-blue-600 hover:bg-blue-700 text-white" icon={<Mail size={14} />} disabled={busy}
              onClick={() => run('Opened your mail app', () => { const d = buildDoc(); window.location.href = `mailto:${clients.map(c => c.email).filter(Boolean).join(',')}?subject=${encodeURIComponent(`Quotation ${d.quoteNo} from ${sellerName}`)}&body=${encodeURIComponent(quoteSummaryText(d))}`; })}>Send to Client</ActionBtn>
            <ActionBtn cls="bg-orange-500 hover:bg-orange-600 text-white" icon={<FileDown size={14} />} disabled={busy} onClick={() => run('PDF downloaded', () => downloadQuotePdf(buildDoc(), false, theme, seller, templateId))}>PDF without Workings</ActionBtn>
            <ActionBtn cls="bg-slate-700 hover:bg-slate-800 text-white" icon={<FileDown size={14} />} disabled={busy} onClick={() => run('PDF with workings downloaded', () => downloadQuotePdf(buildDoc(), true, theme, seller, templateId))}>PDF with Workings</ActionBtn>
            <ActionBtn cls="bg-emerald-600 hover:bg-emerald-700 text-white" icon={<Upload size={14} />} disabled={busy} onClick={() => run('CSV exported', () => exportQuoteCsv(buildDoc()))}>Export CSV</ActionBtn>
            <ActionBtn cls="border border-slate-200 text-slate-700 bg-white hover:bg-slate-50" icon={<Bookmark size={14} />} disabled={busy}
              onClick={() => run(embed?.isEdit ? 'Quotation updated' : 'Quotation saved', () => undefined, true)}>{embed?.isEdit ? 'Save Changes' : 'Save Quote'}</ActionBtn>
          </div>
        </div>
      </div>

      {/* Select Client Modal */}
      <Modal open={pickOpen} onClose={() => setPickOpen(false)} title="Select Client" subtitle="Choose one or more recipient companies" size="md" zIndex={90} footer={<div className="flex justify-end"><button type="button" onClick={() => setPickOpen(false)} className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold cursor-pointer">Done ({clients.length} selected)</button></div>}>
        <div className="relative mb-3"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Search clients" className={`${cell} pl-9 h-10`} placeholder="Search company" value={search} onChange={e => setSearch(e.target.value)} /></div>
        {libState === 'loading' && <p className="text-sm text-slate-500 py-6 text-center">Loading clients…</p>}
        {libState === 'error' && <p className="text-sm text-red-600 py-6 text-center">Could not load clients. <button className="underline" onClick={() => setLibTry(n => n + 1)}>Retry</button></p>}
        {libState === 'ready' && shown.length === 0 && <p className="text-sm text-slate-500 py-6 text-center">{library.length ? 'No client matches your search.' : 'No companies found under your account yet. Add them in All Companies.'}</p>}
        {libState === 'ready' && shown.length > 0 && (
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-500">{shown.length} {shown.length === 1 ? 'company' : 'companies'}{search.trim() ? ' match' : ' under your account'}</span>
            <span className="flex gap-3 font-semibold">
              <button onClick={() => setClients(cs => [...cs, ...shown.filter(c => !cs.some(x => x.key === c.key))])} className="text-blue-600 hover:underline">Select all</button>
              <button onClick={() => setClients(cs => cs.filter(x => !shown.some(c => c.key === x.key)))} className="text-slate-500 hover:underline">Clear</button>
            </span>
          </div>
        )}
        <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {shown.map(c => (
            <li key={c.key}><label className="flex items-center gap-3 px-2 py-2 cursor-pointer hover:bg-slate-50 rounded">
              <input type="checkbox" checked={clients.some(x => x.key === c.key)} onChange={() => togglePick(c)} className="rounded text-orange-500 focus:ring-orange-400" />
              <span className="text-sm"><span className="font-medium text-slate-800">{c.name}</span>{c.gstin && <span className="text-xs text-slate-500 ml-2 font-mono">{c.gstin}</span>}</span>
            </label></li>
          ))}
        </ul>
      </Modal>

      {/* Product Library Modal */}
      <Modal open={prodOpen} onClose={() => setProdOpen(false)} title="Product Library" subtitle="Click a product to add it to the quotation" size="md" zIndex={90}>
        {prodList.length === 0 ? <p className="text-sm text-slate-500 py-6 text-center">No products saved yet. Add some in Product Library, or use the bookmark icon on a row.</p> : (
          <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {prodList.map(p => (
              <li key={p.id}><button onClick={() => addFromLibrary(p)} className="w-full flex justify-between gap-3 text-left px-2 py-2 hover:bg-slate-50 rounded">
                <span className="text-sm font-medium text-slate-800">{p.name}</span>
                <span className="text-xs text-slate-500 whitespace-nowrap">{p.price.trim() ? formatINR(Number(p.price.replace(/,/g, '')) || 0, { decimals: 'always' }) : 'No rate'} / {p.unit}</span>
              </button></li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Sub-Companies & Issuer Profiles Modal */}
      <Modal open={subModalOpen} onClose={() => setSubModalOpen(false)} title="Company Profiles & Sub-Companies" subtitle="Switch or configure branches and subsidiary seller entities for quotations" size="md" zIndex={90}>
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Existing Sub-companies */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Registered Profiles</h4>
            <div className="space-y-2">
              {/* Primary */}
              <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${sellerRef === '' ? 'bg-orange-50/60 border-orange-300' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-800">{safeProfile.orgName || company?.company_name || 'Primary Organisation'}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">Primary</span>
                    {safeProfile.gstin && <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-orange-100 text-orange-700">GST: {safeProfile.gstin}</span>}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate max-w-sm">{safeProfile.address || 'Primary organization address'}</p>
                </div>
                {sellerRef === '' ? (
                  <span className="text-xs font-bold text-orange-600 flex items-center gap-1"><Check size={14} /> Active</span>
                ) : (
                  <button type="button" onClick={() => { setSellerRef(''); setSubModalOpen(false); }} className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-100">Select</button>
                )}
              </div>

              {/* Sub-companies */}
              {profileStore.subs.map(s => (
                <div key={s.id} className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${sellerRef === s.id ? 'bg-orange-50/60 border-orange-300' : 'bg-white border-slate-200'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-800">{s.name}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-100">Sub-Company</span>
                      {s.gstin && <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">GST: {s.gstin}</span>}
                    </div>
                    {s.address && <p className="text-[11px] text-slate-500 truncate">{s.address}</p>}
                    {(s.phone || s.email) && <p className="text-[10px] text-slate-400">{[s.phone, s.email].filter(Boolean).join(' · ')}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {sellerRef === s.id ? (
                      <span className="text-xs font-bold text-orange-600 flex items-center gap-1 mr-1"><Check size={14} /> Active</span>
                    ) : (
                      <button type="button" onClick={() => { setSellerRef(s.id); setSubModalOpen(false); }} className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 mr-1">Select</button>
                    )}
                    <button
                      type="button"
                      title="Edit Sub-Company"
                      onClick={() => setSubForm({ id: s.id, name: s.name, gstin: s.gstin, address: s.address, phone: s.phone, email: s.email })}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      title="Delete Sub-Company"
                      onClick={() => handleDeleteSubCompany(s.id, s.name)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add / Edit Sub-Company Form */}
          <div className="border-t border-slate-200 pt-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">{subForm.id ? 'Edit Sub-Company Profile' : '+ Add New Sub-Company Profile'}</h4>
            {subFormError && <p className="text-xs text-red-600 mb-2">{subFormError}</p>}
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Sub-Company / Branch Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Argus Technologies (Unit 2)"
                  value={subForm.name}
                  onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-brand-500 font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">GSTIN Number</label>
                  <input
                    type="text"
                    placeholder="33AAAAA0000A1Z5"
                    value={subForm.gstin}
                    onChange={e => setSubForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-brand-500 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-0.5">Phone Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={subForm.phone}
                    onChange={e => setSubForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. branch@arguscnc.com"
                  value={subForm.email}
                  onChange={e => setSubForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full h-8 px-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-0.5">Full Address</label>
                <textarea
                  rows={2}
                  placeholder="Premises address, city, state, pincode"
                  value={subForm.address}
                  onChange={e => setSubForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                {subForm.id && (
                  <button
                    type="button"
                    onClick={() => setSubForm({ id: '', name: '', gstin: '', address: '', phone: '', email: '' })}
                    className="px-3 h-8 text-xs font-semibold text-slate-600 rounded-lg hover:bg-slate-100"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveSubCompany}
                  className="px-4 h-8 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg shadow-xs"
                >
                  {subForm.id ? 'Update Sub-Company' : 'Save & Select Sub-Company'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
      {/* PDF Template & Theme Selector Modal */}
      <PdfTemplateSelectorModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        activeTemplateId={templateId}
        onSelectTemplate={tId => {
          setTemplateId(tId);
          try { localStorage.setItem('metal-pdf-template', tId); } catch {}
        }}
        activeColorId={theme}
        onSelectColor={cId => {
          setTheme(cId as PdfThemeId);
          try { localStorage.setItem('metal-pdf-color', cId); } catch {}
        }}
        companyName={sellerName}
      />
    </div>
  );
}

function Row({ label, value, testid, plus }: { label: string; value: number; testid: string; plus?: boolean }) {
  const text = formatINR(Math.abs(value), { decimals: 'always' });
  return (
    <div className="flex items-center justify-between">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="font-mono" data-testid={testid}>{plus ? `${value < 0 ? '-' : '+'}${text}` : text}</span>
    </div>
  );
}

function ActionBtn({ children, icon, cls, onClick, disabled }: { children: string; icon: React.ReactNode; cls: string; onClick: () => void; disabled?: boolean }) {
  return <button onClick={onClick} disabled={disabled} className={`flex items-center gap-1.5 h-9 px-3 text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer ${cls}`}>{icon}{children}</button>;
}
