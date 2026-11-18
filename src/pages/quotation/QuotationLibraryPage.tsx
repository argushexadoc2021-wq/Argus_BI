import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderOpen, Search, Hash, Eye, Pencil, FileDown, Trash2, Building2, Calculator } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatINR } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { calcLine, calcTotals } from '@/lib/quotationCalc';
import { downloadQuotePdf, type QuoteClient, type QuoteDoc } from '@/lib/quotationDocument';
import { resolveSeller, syncProfileStore } from '@/lib/companyProfile';
import { clientNames, deleteQuote, filterQuotes, loadQuotes, mergeQuotes, noFilter, upsertQuote, type DbQuoteRow, type SavedQuote } from '@/lib/quotationStore';
import { supabase } from '@/lib/supabase';
import { fillClientDetails } from '@/lib/quoteClients';
import { hasWorkings } from '@/lib/quotationWorkings';
import { CreateQuotationPage, type QuotationEmbed } from './CreateQuotationPage';

const inputCls = 'h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20';
const dmy = (iso: string) => (iso ? iso.split('-').reverse().join('-') : '—');
const money = (n: number) => formatINR(n, { decimals: 'always' });
const itemNames = (q: SavedQuote) => q.lines.filter(l => calcLine(l).active).map(l => l.description.trim() || 'Item');

export function QuotationLibraryPage({ onChanged }: { onChanged?: () => void } = {}) {
  const { company, email: authEmail } = useAuth();
  const cid = company?.id ?? null;
  const [quotes, setQuotes] = useState<SavedQuote[]>(() => loadQuotes(cid));
  const [dbRows, setDbRows] = useState<DbQuoteRow[]>([]);

  const reloadAll = useCallback(async () => {
    setQuotes(loadQuotes(cid));
    let q = supabase
      .from('cnc_quotations')
      .select('id,quote_no,customer,phone,email,description,total_value,date,created_at,remarks,gst_percent,part_name,payment_terms')
      .order('created_at', { ascending: false })
      .limit(1000);
    let { data, error } = await q;
    if (error && (error.message?.includes('payment_terms') || error.code === '42703')) {
      ({ data, error } = await supabase
        .from('cnc_quotations')
        .select('id,quote_no,customer,phone,email,description,total_value,date,created_at,remarks,gst_percent,part_name')
        .order('created_at', { ascending: false })
        .limit(1000));
    }
    if (!error) setDbRows((data ?? []) as DbQuoteRow[]);
  }, [cid]);

  useEffect(() => {
    let off = false;
    void (async () => {
      if (!off) await reloadAll();
    })();
    return () => { off = true; };
  }, [reloadAll]);

  const all = useMemo(() => mergeQuotes(quotes, dbRows), [quotes, dbRows]);
  const [f, setF] = useState(noFilter);
  const [toDelete, setToDelete] = useState<SavedQuote | null>(null);
  const [viewingQuote, setViewingQuote] = useState<SavedQuote | null>(null);
  const [viewingClients, setViewingClients] = useState<QuoteClient[]>([]);
  const [editingQuote, setEditingQuote] = useState<SavedQuote | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const shown = useMemo(() => filterQuotes(all, f), [all, f]);
  const names = useMemo(() => clientNames(all), [all]);
  const set = (patch: Partial<typeof f>) => setF(p => ({ ...p, ...patch }));
  const filtered = JSON.stringify(f) !== JSON.stringify(noFilter);

  // Enrich client details (address / GSTIN / phone / email) when viewing a quotation
  useEffect(() => {
    if (!viewingQuote) { setViewingClients([]); return; }
    let live = true;
    setViewingClients(viewingQuote.clients);
    void fillClientDetails(viewingQuote.clients, cid).then(next => {
      if (live) setViewingClients(next);
    });
    return () => { live = false; };
  }, [viewingQuote, cid]);

  const openView = (q: SavedQuote) => {
    setEditingQuote(null);
    setViewingQuote(q);
  };

  const openEdit = (q: SavedQuote) => {
    setViewingQuote(null);
    setEditingQuote(q);
  };

  const pdf = async (q: SavedQuote, workings: boolean) => {
    try {
      await downloadQuotePdf(
        { ...q, clients: await fillClientDetails(q.clients, cid) },
        workings,
        'orange',
        resolveSeller(await syncProfileStore(cid, { orgName: company?.company_name ?? '', email: authEmail ?? '' }), q.sellerRef),
      );
    } catch (e) {
      console.error(e);
      setNotice({ kind: 'err', text: `Could not create the PDF: ${(e as Error).message}` });
    }
  };

  const remove = () => {
    if (!toDelete) return;
    if (deleteQuote(cid, toDelete.id)) {
      setQuotes(loadQuotes(cid));
      setNotice({ kind: 'ok', text: `Quotation #${toDelete.seq} deleted` });
    } else {
      setNotice({ kind: 'err', text: 'Could not delete: browser storage is unavailable.' });
    }
    setToDelete(null);
  };

  // Build QuotationEmbed for editing any quotation (both DB/Pipeline & local library quotes) in CreateQuotationPage
  const editEmbed = useMemo<QuotationEmbed | undefined>(() => {
    if (!editingQuote) return undefined;
    const target = editingQuote;
    const matchedDbId = target.id.startsWith('db-')
      ? target.id.slice(3)
      : dbRows.find(r => r.quote_no && r.quote_no === target.quoteNo)?.id ?? null;

    return {
      isEdit: true,
      quoteId: target.id,
      quoteNo: target.quoteNo,
      date: target.date || undefined,
      clients: target.clients,
      lines: target.lines.map(l => ({
        hsn: l.hsn || '',
        description: l.description || '',
        qty: l.qty || '1',
        unit: l.unit || 'Nos',
        unitPrice: l.unitPrice || '',
        discount: l.discount || '0',
        workings: l.workings,
      })),
      tax: target.tax,
      terms: target.terms,
      notes: target.notes,
      sellerRef: target.sellerRef,
      onClose: () => {
        setEditingQuote(null);
        void reloadAll();
        onChanged?.();
      },
      onRecord: async (doc: QuoteDoc, total: number, quoteNo: string) => {
        // 1. If this quotation exists in Supabase cnc_quotations, update the DB record in-place
        if (matchedDbId) {
          const origRow = dbRows.find(r => r.id === matchedDbId);
          let origItems: any[] = [];
          try {
            const parsed = origRow?.description ? JSON.parse(origRow.description) : null;
            if (Array.isArray(parsed)) origItems = parsed;
          } catch { /* ignore */ }

          const lineItems = doc.lines
            .filter(l => l.description.trim() || l.unitPrice.trim())
            .map((l, idx) => {
              const orig = origItems[idx];
              return {
                id: l.id,
                hsn: l.hsn || '',
                partName: l.description.trim(),
                partNumber: String(orig?.partNumber || orig?.part_number || ''),
                quantity: l.qty,
                unit: l.unit || 'Nos',
                unitPrice: l.unitPrice,
                discount: l.discount || '0',
                unitDiscount: '0',
                gst: String((Number(doc.tax.cgst) || 0) + (Number(doc.tax.sgst) || 0) + (Number(doc.tax.igst) || 0)),
                cgst: doc.tax.cgst,
                sgst: doc.tax.sgst,
                igst: doc.tax.igst,
                filePaths: Array.isArray(orig?.filePaths) ? orig.filePaths : [],
                files: [],
                workings: l.workings,
              };
            });
          const first = lineItems[0];
          const itemListNames = lineItems.map(i => i.partName).filter(Boolean).join(', ');
          const payload: any = {
            quote_no: origRow?.quote_no || target.quoteNo || quoteNo,
            customer: doc.clients[0]?.name || origRow?.customer || '',
            part_name: lineItems.length > 1 ? `${itemListNames} (${lineItems.length} Products)` : (first?.partName || 'TBD'),
            phone: doc.clients[0]?.phone || origRow?.phone || '',
            email: doc.clients[0]?.email || origRow?.email || '',
            description: JSON.stringify(lineItems),
            unit_price: Number(first?.unitPrice) || 0,
            unit_discount: 0,
            quantity: lineItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
            total_value: total,
            date: doc.date || null,
            discount_percent: Number(first?.discount) || 0,
            gst_percent: Number(first?.gst) || 18,
            payment_terms: doc.terms || '',
            remarks: doc.notes,
          };
          const write = (pl: any) => supabase.from('cnc_quotations').update(pl).eq('id', matchedDbId);
          let { error } = await write(payload);
          if (error && (error.message?.includes('unit_discount') || error.code === '42703')) {
            const { unit_discount, ...rest } = payload;
            ({ error } = await write(rest));
          }
          if (error) throw new Error(`Could not update quotation in database: ${error.message}`);
        } else {
          // 2. Local browser-saved quote: ensure same seq & id is preserved
          upsertQuote(cid, doc, { id: target.id, seq: target.seq, quoteNo: target.quoteNo || quoteNo });
        }

        await reloadAll();
        onChanged?.();
        setNotice({ kind: 'ok', text: `Quotation #${target.seq} (${target.quoteNo}) updated successfully.` });
      },
    };
  }, [editingQuote, dbRows, cid, reloadAll, onChanged]);

  const viewTotals = useMemo(
    () => (viewingQuote ? calcTotals(viewingQuote.lines, viewingQuote.tax) : null),
    [viewingQuote],
  );

  const iconBtn = 'p-1.5 text-slate-500 rounded hover:bg-white/80 transition-colors cursor-pointer';

  return (
    <div className="p-4 lg:p-6 bg-grid min-h-full">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><FolderOpen className="text-orange-500" size={26} /> Saved Quotation Library</h1>
          <p className="text-sm text-slate-500 mt-1">View, edit, download PDF, and manage all your saved quotations in one place.</p>
        </div>

        {notice && (
          <div role="status" className={`flex justify-between text-sm rounded-lg px-3 py-2 border ${notice.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <span>{notice.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input aria-label="Search client or item" className={`${inputCls} w-full pl-9`} placeholder="Search client or item…" value={f.text} onChange={e => set({ text: e.target.value })} />
          </div>
          <div className="relative w-full sm:w-44">
            <Hash size={15} className="absolute left-3 top-3 text-slate-400" />
            <input aria-label="Quote number" className={`${inputCls} w-full pl-9`} placeholder="Quote # (Exact)" value={f.quoteNo} onChange={e => set({ quoteNo: e.target.value })} />
          </div>
          <select aria-label="Filter by company" className={`${inputCls} w-full sm:w-52`} value={f.client} onChange={e => set({ client: e.target.value })}>
            <option value="">All Companies</option>
            {names.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2 h-12 bg-slate-50/60">
            <span className="text-[10px] font-bold text-slate-500">FROM:</span>
            <input type="date" aria-label="From date" className={`${inputCls} h-9`} value={f.from} onChange={e => set({ from: e.target.value })} />
            <span className="text-[10px] font-bold text-slate-500">TO:</span>
            <input type="date" aria-label="To date" className={`${inputCls} h-9`} value={f.to} onChange={e => set({ to: e.target.value })} />
          </div>
          {filtered && <button type="button" onClick={() => setF(noFilter)} className="text-xs font-semibold text-orange-600 underline">Clear filters</button>}
          <span data-testid="count" className="ml-auto text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-4 h-10 flex items-center">
            {all.length} Saved {all.length === 1 ? 'Quote' : 'Quotes'}{filtered && ` · ${shown.length} shown`}
          </span>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[840px]">
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr>
              {['#', 'Date', 'Client / Company', 'Products / Line Items', 'Grand Total (₹)', 'Actions'].map((h, i) => <th key={h} className={`font-semibold px-4 py-2 ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {shown.map(q => {
                const items = itemNames(q);
                return (
                  <tr key={q.id} data-testid="quote-row" className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2 font-bold text-orange-600">
                      <button type="button" onClick={() => openView(q)} className="hover:underline cursor-pointer">#{q.seq}</button>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{dmy(q.date)}</td>
                    <td className="px-4 py-2 font-medium text-slate-800">{q.clients.map(c => c.name).join(', ') || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">{items.slice(0, 2).join(', ')}{items.length > 2 && <span className="text-slate-400"> +{items.length - 2} more</span>}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{money(q.total)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label={`View #${q.seq}`} title="View Quotation" onClick={() => openView(q)} className={`${iconBtn} hover:text-blue-600`}>
                          <Eye size={15} />
                        </button>
                        <button type="button" aria-label={`Edit #${q.seq}`} title="Edit Quotation" onClick={() => openEdit(q)} className={`${iconBtn} hover:text-orange-600`}>
                          <Pencil size={15} />
                        </button>
                        <button type="button" aria-label={`Download PDF #${q.seq}`} title="Download PDF" onClick={() => void pdf(q, false)} className={`${iconBtn} hover:text-emerald-600`}>
                          <FileDown size={15} />
                        </button>
                        {q.id.startsWith('db-')
                          ? <span title="Recorded in the sales pipeline" className="ml-1 text-[10px] font-bold uppercase text-slate-500 bg-white/70 border border-slate-300 rounded px-1.5 py-0.5">Pipeline</span>
                          : <button type="button" aria-label={`Delete #${q.seq}`} title="Delete" onClick={() => setToDelete(q)} className={`${iconBtn} hover:text-red-600`}><Trash2 size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && (
            <div className="flex flex-col items-center py-14 text-center">
              <FolderOpen size={28} className="text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-800">{all.length ? 'No quotations match your filters.' : 'No saved quotations in directory.'}</p>
              <p className="text-xs text-slate-500 mt-1">{all.length ? 'Change or clear the filters.' : <>Every quotation you <b>Save</b>, export or send from Create Quotation is listed here, numbered #1, #2, #3…</>}</p>
            </div>
          )}
        </div>
      </div>

      {/* View Quotation Modal */}
      <Modal
        open={!!viewingQuote}
        onClose={() => setViewingQuote(null)}
        title={viewingQuote ? `Quotation #${viewingQuote.seq} — ${viewingQuote.quoteNo}` : 'Quotation Details'}
        subtitle={viewingQuote ? `Date: ${dmy(viewingQuote.date)}` : undefined}
        size="xl"
        width={960}
        windowControls
        footer={
          viewingQuote ? (
            <div className="flex flex-wrap items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => void pdf(viewingQuote, false)}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <FileDown size={14} className="text-orange-500" /> PDF without Workings
              </button>
              <button
                type="button"
                onClick={() => void pdf(viewingQuote, true)}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
              >
                <FileDown size={14} className="text-slate-600" /> PDF with Workings
              </button>
              <button
                type="button"
                onClick={() => openEdit(viewingQuote)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Pencil size={14} /> Edit Quotation
              </button>
              <button
                type="button"
                onClick={() => setViewingQuote(null)}
                className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : undefined
        }
      >
        {viewingQuote && viewTotals && (
          <div className="space-y-4 text-sm">
            {/* Client Info */}
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                <Building2 size={14} className="text-orange-500" /> Client / Company Details
              </h3>
              {viewingClients.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No client attached.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {viewingClients.map(c => (
                    <div key={c.key} className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 text-xs space-y-0.5">
                      <p className="font-bold text-slate-900 text-sm">{c.name}</p>
                      {c.gstin && <p className="font-mono text-slate-600">GSTIN: {c.gstin}</p>}
                      {c.address && <p className="text-slate-600">{c.address}</p>}
                      {(c.phone || c.email) && (
                        <p className="text-slate-500">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-xs min-w-[680px]">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-left px-3 py-2">HSN/SAC</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-left px-2 py-2">Unit</th>
                    <th className="text-right px-3 py-2">Unit Price</th>
                    <th className="text-right px-3 py-2">Disc %</th>
                    <th className="text-right px-3 py-2">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingQuote.lines.map((l, idx) => {
                    const res = calcLine(l);
                    return (
                      <tr key={l.id}>
                        <td className="px-3 py-2 text-slate-500 font-semibold">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">{l.hsn || '—'}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          <div>{l.description || '—'}</div>
                          {hasWorkings(l.workings) && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                              <Calculator size={10} /> Workings attached
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{l.qty || '—'}</td>
                        <td className="px-2 py-2 text-slate-600">{l.unit || 'Nos'}</td>
                        <td className="px-3 py-2 text-right font-mono">{l.unitPrice ? money(Number(String(l.unitPrice).replace(/,/g, '')) || 0) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono">{l.discount || '0'}%</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{money(res.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals & Terms/Notes */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2.5 text-xs">
                {viewingQuote.terms && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-1">Terms &amp; Conditions</p>
                    <p className="whitespace-pre-line text-slate-700">{viewingQuote.terms}</p>
                  </div>
                )}
                {viewingQuote.notes && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="font-bold uppercase tracking-wider text-slate-500 text-[10px] mb-1">Notes</p>
                    <p className="whitespace-pre-line text-slate-700">{viewingQuote.notes}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-mono font-semibold text-slate-800">{money(viewTotals.subtotal)}</span>
                </div>
                {Number(viewingQuote.tax.cgst) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">CGST ({viewingQuote.tax.cgst}%)</span>
                    <span className="font-mono text-slate-700">{money(viewTotals.cgst)}</span>
                  </div>
                )}
                {Number(viewingQuote.tax.sgst) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">SGST ({viewingQuote.tax.sgst}%)</span>
                    <span className="font-mono text-slate-700">{money(viewTotals.sgst)}</span>
                  </div>
                )}
                {Number(viewingQuote.tax.igst) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">IGST ({viewingQuote.tax.igst}%)</span>
                    <span className="font-mono text-slate-700">{money(viewTotals.igst)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-slate-200 pt-2 mt-1">
                  <span className="font-bold text-slate-900 uppercase">Grand Total</span>
                  <span className="font-mono text-lg font-extrabold text-orange-600">{money(viewTotals.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Quotation Modal (exact same CreateQuotationPage format) */}
      <Modal
        open={!!editingQuote}
        onClose={() => setEditingQuote(null)}
        title="Edit Quotation"
        subtitle={editingQuote ? `#${editingQuote.seq} · ${editingQuote.quoteNo}${editingQuote.clients[0]?.name ? ` · ${editingQuote.clients[0].name}` : ''}` : undefined}
        size="full"
        width={1040}
        windowControls
      >
        {editingQuote && editEmbed && (
          <CreateQuotationPage key={`lib-edit-${editingQuote.id}`} embed={editEmbed} />
        )}
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} size="sm" title="Delete quotation?">
        <p className="text-sm text-slate-600">Quotation #{toDelete?.seq} ({toDelete?.clients.map(c => c.name).join(', ')}) will be permanently removed.</p>
        <div className="flex justify-end gap-3 mt-5">
          <button type="button" onClick={() => setToDelete(null)} className="text-sm font-semibold text-slate-600 px-3">Cancel</button>
          <button type="button" onClick={remove} className="h-10 px-5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </Modal>
    </div>
  );
}
