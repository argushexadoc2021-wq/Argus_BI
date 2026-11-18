import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Download, FileText, MessageCircle, Paperclip, Phone, Send, Share2, X } from 'lucide-react';
import { calcLine, calcTotals } from '@/lib/quotationCalc';
import { buildQuotePdf, type PdfThemeId, type QuoteDoc } from '@/lib/quotationDocument';
import type { QuoteSeller } from '@/lib/companyProfile';
import { desktopToast } from '@/lib/desktop/toast';
import { formatINR } from '@/lib/format';

interface WhatsappQuoteModalProps {
  open: boolean;
  onClose: () => void;
  doc: QuoteDoc;
  seller?: QuoteSeller;
  theme: PdfThemeId | string;
  templateId: string;
  /** Called right before/after opening WhatsApp so the host can persist the quotation record. */
  onConfirmSend?: () => Promise<void> | void;
}

const dmy = (iso: string) => (iso ? iso.split('-').reverse().join('-') : new Date().toLocaleDateString('en-IN'));

function buildDefaultWhatsappMessage(doc: QuoteDoc, seller?: QuoteSeller): string {
  const activeLines = doc.lines.filter(l => calcLine(l).active);
  const totals = calcTotals(doc.lines, doc.tax);
  const orgDisplayName = seller?.name?.trim() || doc.sellerName?.trim() || 'Argus Technologies';
  const orgPhone = (seller?.phones || []).map(p => p.trim()).find(Boolean) || '';
  const primaryClient = doc.clients[0]?.name?.trim() || 'Valued Client';

  let itemsSummaryText = '';
  if (activeLines.length > 0) {
    activeLines.slice(0, 5).forEach((l, idx) => {
      const name = l.description.trim() || `Product ${idx + 1}`;
      const qty = l.qty.trim() || '1';
      itemsSummaryText += `${idx + 1}. *${name}* (Qty: ${qty}${l.unit ? ` ${l.unit}` : ''})\n`;
    });
    if (activeLines.length > 5) {
      const extra = activeLines.length - 5;
      itemsSummaryText += `... and ${extra} more item${extra > 1 ? 's' : ''}\n`;
    }
  } else {
    itemsSummaryText = 'Quotation for metal fabrication and processing requirements.\n';
  }

  const grandTotalFormatted = formatINR(totals.total, { decimals: 'always' }).replace(/^₹\s*/, '');

  return [
    `*QUOTATION: #${doc.quoteNo || 'DRAFT'}*`,
    `From: *${orgDisplayName}*`,
    `To: *${primaryClient}*`,
    `Date: *${dmy(doc.date)}*`,
    '',
    '*Items Summary:*',
    itemsSummaryText.trimEnd(),
    '',
    `*Total Amount (After Tax): ₹ ${grandTotalFormatted}*`,
    '',
    'Please find our official quotation attached. Kindly review and let us know if you require any adjustments or further clarification.',
    '',
    'Best regards,',
    `*${orgDisplayName}*${orgPhone ? `\nContact: ${orgPhone}` : ''}`,
  ].join('\n');
}

export function WhatsappQuoteModal({
  open,
  onClose,
  doc,
  seller,
  theme,
  templateId,
  onConfirmSend,
}: WhatsappQuoteModalProps) {
  const allClientPhones = useMemo(() => {
    const out: string[] = [];
    (doc.clients || []).forEach(cl => {
      const raw = String(cl.phone || '').trim();
      if (!raw) return;
      raw.split(/[,/;]+/).forEach(part => {
        const clean = part.trim();
        if (clean && !out.includes(clean)) out.push(clean);
      });
    });
    return out;
  }, [doc.clients]);

  const primaryClientName = doc.clients[0]?.name?.trim() || '';
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [withWorkings, setWithWorkings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfErr, setPdfErr] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const pdfDocRef = useRef<Awaited<ReturnType<typeof buildQuotePdf>> | null>(null);
  const pdfBlobRef = useRef<Blob | null>(null);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  const pdfFilename = useMemo(() => {
    const cleanClient = (primaryClientName || 'Client').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'Client';
    const cleanNo = (doc.quoteNo || 'Quotation').replace(/[^\w-]+/g, '_');
    return `Quotation_${cleanClient}_${cleanNo}${withWorkings ? '_workings' : ''}.pdf`;
  }, [primaryClientName, doc.quoteNo, withWorkings]);

  // Reset phone & message whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setPhone(allClientPhones[0] || '');
    setMessage(buildDefaultWhatsappMessage(doc, seller));
    setWithWorkings(false);
    setCopied(false);
    setPhoneError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc.quoteNo]);

  // Generate live PDF blob + preview URL whenever modal opens or workings toggle changes
  useEffect(() => {
    if (!open) {
      setPdfUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      pdfDocRef.current = null;
      pdfBlobRef.current = null;
      setPdfErr(null);
      setPdfLoading(false);
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setPdfErr(null);

    void (async () => {
      try {
        const built = await buildQuotePdf(doc, withWorkings, theme, seller, templateId);
        const blob = built.output('blob');
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        pdfDocRef.current = built;
        pdfBlobRef.current = blob;
        setPdfUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (err) {
        console.error('WhatsApp PDF preview generation failed:', err);
        if (!cancelled) setPdfErr(`Could not generate PDF preview: ${(err as Error).message}`);
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, doc, withWorkings, theme, seller, templateId]);

  const handleDownloadPdf = () => {
    if (!pdfDocRef.current) {
      desktopToast('error', 'No quotation PDF generated yet.', undefined, 2500);
      return;
    }
    pdfDocRef.current.save(pdfFilename);
    desktopToast('success', `Saved ${pdfFilename}. Attach it to your WhatsApp chat!`, undefined, 3000);
  };

  const handleCopyText = async () => {
    const text = message.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      desktopToast('success', 'WhatsApp message text copied to clipboard.', undefined, 2000);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy WhatsApp text:', err);
    }
  };

  const canNativeShareFile = useMemo(() => {
    try {
      if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
      const testFile = new File(['x'], 'test.pdf', { type: 'application/pdf' });
      return navigator.canShare({ files: [testFile] });
    } catch {
      return false;
    }
  }, []);

  const handleNativeSharePdf = async () => {
    if (!pdfBlobRef.current) return;
    try {
      const file = new File([pdfBlobRef.current], pdfFilename, { type: 'application/pdf' });
      await navigator.share({
        title: `Quotation ${doc.quoteNo}`,
        text: message.trim(),
        files: [file],
      });
      if (onConfirmSend) await onConfirmSend();
      onClose();
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('Native PDF share failed:', err);
      }
    }
  };

  const handleOpenInWhatsapp = async () => {
    const rawPhone = phone.trim();
    let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`; // Default to India country code
    }
    if (!cleanPhone) {
      setPhoneError('Please enter a valid client WhatsApp phone number (with country code, e.g. 919876543210).');
      phoneInputRef.current?.focus();
      return;
    }
    setPhoneError(null);
    setSending(true);
    try {
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message.trim())}`;

      // Automatically download PDF so user can attach it directly to the opened WhatsApp chat
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.save(pdfFilename);
        } catch (e) {
          console.warn('PDF auto-download warning:', e);
        }
      }

      // Open WhatsApp chat in new tab
      window.open(whatsappUrl, '_blank', 'noopener');

      // Record/save the quotation in pipeline & library
      if (onConfirmSend) {
        await onConfirmSend();
      }

      desktopToast(
        'success',
        'Opening WhatsApp chat and downloaded quotation PDF for easy attachment.',
        undefined,
        3500,
      );
      onClose();
    } catch (err) {
      console.error('Send to WhatsApp failed:', err);
      desktopToast('error', `Could not complete: ${(err as Error).message}`, undefined, 3000);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const modalNode = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send Quotation to WhatsApp"
      className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-[2px]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-scale-in">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-emerald-50 text-[#25D366] rounded-2xl border border-emerald-100 shrink-0">
              <MessageCircle size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900">Send Quotation to WhatsApp</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  Instant Chat
                </span>
              </div>
              <p className="text-xs text-slate-500">Share official quotation details directly with the client on WhatsApp.</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close WhatsApp modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all cursor-pointer shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body (Left: Form & Message, Right: Live PDF Preview) */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column */}
          <div className="lg:col-span-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Client WhatsApp Number */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <span>Client WhatsApp Number <span className="text-rose-500">*</span></span>
                  {primaryClientName && (
                    <span className="text-[11px] font-normal text-slate-400 truncate">({primaryClientName})</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    ref={phoneInputRef}
                    type="text"
                    value={phone}
                    onChange={e => { setPhone(e.target.value); if (phoneError) setPhoneError(null); }}
                    placeholder="e.g. 919876543210 or 9876543210"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 transition-all ${
                      phoneError
                        ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-slate-200 focus:ring-emerald-500/20 focus:border-emerald-500'
                    }`}
                  />
                  <Phone size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                {phoneError && <p className="text-[11px] font-semibold text-red-600">{phoneError}</p>}
                {allClientPhones.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {allClientPhones.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => { setPhone(p); setPhoneError(null); }}
                        title="Click to use this phone number"
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border cursor-pointer transition-all ${
                          phone.trim() === p
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-slate-400">Enter digits with country code (defaults to +91 India if 10 digits provided).</p>
              </div>

              {/* WhatsApp Message Text */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">WhatsApp Message Text</label>
                  <button
                    type="button"
                    onClick={() => void handleCopyText()}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy Text</>}
                  </button>
                </div>
                <textarea
                  rows={9}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all leading-relaxed resize-none"
                />
              </div>

              {/* Tip Card */}
              <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 text-xs text-emerald-900 flex items-start gap-2.5">
                <Paperclip size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Attach Quotation PDF in WhatsApp</p>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Clicking <strong>&ldquo;Open in WhatsApp&rdquo;</strong> automatically downloads the PDF so you can attach it straight into the opened WhatsApp chat, or click <strong>&ldquo;Download PDF&rdquo;</strong> first.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Quotation PDF Preview */}
          <div className="lg:col-span-6 flex flex-col gap-2 min-h-[380px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText size={15} className="text-emerald-500" /> Quotation PDF Preview
              </span>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setWithWorkings(false)}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${!withWorkings ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Without Workings
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithWorkings(true)}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${withWorkings ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    With Workings
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Download size={13} /> Download PDF
                </button>
              </div>
            </div>
            <div className="flex-1 w-full bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden relative min-h-[340px]">
              {pdfLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/90 gap-2 text-xs text-slate-600">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
                  <span>Generating Quotation PDF…</span>
                </div>
              )}
              {pdfErr ? (
                <div className="flex h-full items-center justify-center p-4 text-center text-xs text-red-600">{pdfErr}</div>
              ) : pdfUrl ? (
                <iframe
                  src={`${pdfUrl}#navpanes=0&view=FitH`}
                  className="w-full h-full border-none min-h-[340px]"
                  title="Quotation PDF Preview"
                />
              ) : null}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfLoading || !pdfUrl}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download size={15} /> Download PDF
            </button>
            {canNativeShareFile && (
              <button
                type="button"
                onClick={() => void handleNativeSharePdf()}
                disabled={pdfLoading || !pdfUrl}
                className="px-4 py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Share2 size={15} /> Share PDF Directly
              </button>
            )}
            <button
              type="button"
              disabled={sending || pdfLoading}
              onClick={() => void handleOpenInWhatsapp()}
              className="px-5 py-2.5 text-xs font-bold text-white bg-[#25D366] hover:bg-[#20ba59] rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send size={15} /> {sending ? 'Opening…' : 'Open in WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}
