import { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderOpen, Search, Hash, Eye, Pencil, FileDown, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatINR } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { calcLine } from '@/lib/quotationCalc';
import { buildQuotePdf, downloadQuotePdf, type PdfThemeId, type QuoteDoc } from '@/lib/quotationDocument';
import { resolveSeller, syncProfileStore } from '@/lib/companyProfile';
import { clientNames, deleteQuote, filterQuotes, loadQuotes, mergeQuotes, noFilter, upsertQuote, type DbQuoteRow, type SavedQuote } from '@/lib/quotationStore';
import { supabase } from '@/lib/supabase';
import { fillClientDetails } from '@/lib/quoteClients';
import { CreateQuotationPage, type QuotationEmbed } from './CreateQuotationPage';

const inputCls = 'h-9 px-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20';
const dmy = (iso: string) => (iso ? iso.split('-').reverse().join('-') : '—');
const money = (n: number) => formatINR(n, { decimals: 'always' });
const itemNames = (q: SavedQuote) => q.lines.filter(l => calcLine(l).active).map(l => l.description.trim() || 'Item');

function getSavedPdfPrefs(): { theme: PdfThemeId; templateId: string } {
  try {
    return {
      theme: (localStorage.getItem('metal-pdf-color') as PdfThemeId) || 'orange',
      templateId: localStorage.getItem('metal-pdf-template') || 'template-1',
    };
  } catch {
    return { theme: 'orange', templateId: 'template-1' };
  }
}

export function QuotationLibraryPage({ onChanged }: { onChanged?: () => void } = {}) {
  const { company, email: authEmail } = useAuth();
  const cid = company?.id ?? null;
  const [quotes, setQuotes] = useState<SavedQuote[]>(() => loadQuotes(cid));
  const [dbRows, setDbRows] = useState<DbQuoteRow[]>([]);

  const reloadAll = useCallback(async () => {
    setQuotes(loadQuotes(cid));
    let { data, error } = await supabase
      .from('cnc_quotations')
      .select('id,quote_no,customer,phone,email,description,total_value,date,created_at,remarks,gst_percent,part_name,payment_terms')
      .order('created_at', { ascending: false })
      .limit(1000);
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
  const [previewWithWorkings, setPreviewWithWorkings] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewErr, setPdfPreviewErr] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState<SavedQuote | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const shown = useMemo(() => filterQuotes(all, f), [all, f]);
  const names = useMemo(() => clientNames(all), [all]);
  const set = (patch: Partial<typeof f>) => setF(p => ({ ...p, ...patch }));
  const filtered = JSON.stringify(f) !== JSON.stringify(noFilter);

  // Build the actual downloading Quotation PDF live inside the View popup
  useEffect(() => {
    if (!viewingQuote) {
      setPdfPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPdfPreviewErr(null);
      setPdfPreviewLoading(false);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;
    setPdfPreviewLoading(true);
    setPdfPreviewErr(null);

    void (async () => {
      try {
        const [enrichedClients, store] = await Promise.all([
          fillClientDetails(viewingQuote.clients, cid),
          syncProfileStore(cid, { orgName: company?.company_name ?? '', email: authEmail ?? '' }),
        ]);
        const seller = resolveSeller(store, viewingQuote.sellerRef);
        const { theme, templateId } = getSavedPdfPrefs();
        const pdfDoc = await buildQuotePdf(
          { ...viewingQuote, clients: enrichedClients },
          previewWithWorkings,
          theme,
          seller,
          templateId,
        );
        const blob = pdfDoc.output('blob');
        createdUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(createdUrl);
          return;
        }
        setPdfPreviewUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return createdUrl;
        });
      } catch (err) {
        console.error('Quotation PDF preview failed:', err);
        if (!cancelled) {
          setPdfPreviewErr(`Could not generate quotation PDF preview: ${(err as Error).message}`);
        }
      } finally {
        if (!cancelled) setPdfPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewingQuote, previewWithWorkings, cid, company?.company_name, authEmail]);

  const openView = (q: SavedQuote) => {
    setEditingQuote(null);
    setPreviewWithWorkings(false);
    setViewingQuote(q);
  };

  const openEdit = (q: SavedQuote) => {
    setViewingQuote(null);
    setEditingQuote(q);
  };

  const pdf = async (q: SavedQuote, workings: boolean) => {
    try {
      const { theme, templateId } = getSavedPdfPrefs();
      await downloadQuotePdf(
        { ...q, clients: await fillClientDetails(q.clients, cid) },
        workings,
        theme,
        resolveSeller(await syncProfileStore(cid, { orgName: company?.company_name ?? '', email: authEmail ?? '' }), q.sellerRef),
        templateId,
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
          upsertQuote(cid, doc, { id: target.id, seq: target.seq, quoteNo: target.quoteNo || quoteNo });
        }

        await reloadAll();
        onChanged?.();
        setNotice({ kind: 'ok', text: `Quotation #${target.seq} (${target.quoteNo}) updated successfully.` });
      },
    };
  }, [editingQuote, dbRows, cid, reloadAll, onChanged]);

  const iconBtn = 'p-1.5 text-slate-500 rounded hover:bg-white/80 transition-colors cursor-pointer';

  return (
    <div className="p-4 lg:p-6 bg-grid min-h-full">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap xl:flex-nowrap items-center gap-2">
          <h1 className="flex items-center gap-1.5 text-base font-bold text-slate-900 whitespace-nowrap shrink-0 mr-1">
            <FolderOpen className="text-orange-500 shrink-0" size={18} /> Saved Quotation Library
          </h1>
          <div className="relative w-44 shrink-0">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input aria-label="Search client or item" className={`${inputCls} w-full pl-8`} placeholder="Search client or item…" value={f.text} onChange={e => set({ text: e.target.value })} />
          </div>
          <div className="relative w-32 shrink-0">
            <Hash size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input aria-label="Quote number" className={`${inputCls} w-full pl-7`} placeholder="Quote #" value={f.quoteNo} onChange={e => set({ quoteNo: e.target.value })} />
          </div>
          <select aria-label="Filter by company" className={`${inputCls} w-36 shrink-0`} value={f.client} onChange={e => set({ client: e.target.value })}>
            <option value="">All Companies</option>
            {names.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 h-9 bg-slate-50/60 shrink-0">
            <span className="text-[10px] font-bold text-slate-500">FROM:</span>
            <input type="date" aria-label="From date" className="h-7 px-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-orange-500" value={f.from} onChange={e => set({ from: e.target.value })} />
            <span className="text-[10px] font-bold text-slate-500">TO:</span>
            <input type="date" aria-label="To date" className="h-7 px-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-orange-500" value={f.to} onChange={e => set({ to: e.target.value })} />
          </div>
          {filtered && <button type="button" onClick={() => setF(noFilter)} className="text-xs font-semibold text-orange-600 underline whitespace-nowrap shrink-0">Clear</button>}
          <span data-testid="count" className="ml-auto text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 h-9 flex items-center whitespace-nowrap shrink-0">
            {all.length} Saved {all.length === 1 ? 'Quote' : 'Quotes'}{filtered && ` · ${shown.length} shown`}
          </span>
        </div>

        {notice && (
          <div role="status" className={`flex justify-between text-sm rounded-lg px-3 py-2 border ${notice.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <span>{notice.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button>
          </div>
        )}

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
                        <button type="button" aria-label={`View #${q.seq}`} title="View Quotation PDF" onClick={() => openView(q)} className={`${iconBtn} hover:text-blue-600`}>
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

      {/* View Quotation PDF Modal (live preview of the exact downloading PDF) */}
      <Modal
        open={!!viewingQuote}
        onClose={() => setViewingQuote(null)}
        title={viewingQuote ? `Quotation #${viewingQuote.seq} — ${viewingQuote.quoteNo}` : 'Quotation PDF'}
        subtitle={viewingQuote ? `${viewingQuote.clients.map(c => c.name).join(', ') || ''}${viewingQuote.date ? ` · Date: ${dmy(viewingQuote.date)}` : ''}` : undefined}
        size="xl"
        width={980}
        tall
        windowControls
        footer={
          viewingQuote ? (
            <div className="flex flex-wrap items-center justify-between gap-2 w-full">
              <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewWithWorkings(false)}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${!previewWithWorkings ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Without Workings
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewWithWorkings(true)}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${previewWithWorkings ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  With Workings
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
            </div>
          ) : undefined
        }
      >
        <div className="h-[calc(86vh-11rem)] min-h-[500px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 relative">
          {pdfPreviewLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/90 gap-2 text-sm text-slate-600">
              <div className="w-7 h-7 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
              <span className="font-medium">Generating quotation PDF preview…</span>
            </div>
          )}
          {pdfPreviewErr ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-red-600">
              {pdfPreviewErr}
            </div>
          ) : pdfPreviewUrl ? (
            <iframe
              title={`Quotation PDF Preview ${viewingQuote?.quoteNo ?? ''}`}
              src={`${pdfPreviewUrl}#navpanes=0&view=FitH`}
              className="h-full w-full border-0"
            />
          ) : null}
        </div>
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
