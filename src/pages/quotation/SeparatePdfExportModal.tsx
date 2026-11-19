import React, { useState } from 'react';
import { DownloadCloud, Download, Eye, FileDown, Palette, X } from 'lucide-react';
import {
  buildQuotePdf,
  downloadQuotePdf,
  getQuotePdfFilename,
  type PdfThemeId,
  type QuoteClient,
  type QuoteDoc,
} from '@/lib/quotationDocument';
import type { QuoteSeller } from '@/lib/companyProfile';
import { GlobalPdfPreviewModal } from './GlobalPdfPreviewModal';

export interface SeparatePdfExportModalProps {
  open: boolean;
  onClose: () => void;
  doc: QuoteDoc;
  includeWorkings: boolean;
  themeId: PdfThemeId | string;
  templateId: string;
  seller?: QuoteSeller;
  onOpenThemeModal?: () => void;
}

export function SeparatePdfExportModal({
  open,
  onClose,
  doc,
  includeWorkings,
  themeId,
  templateId,
  seller,
  onOpenThemeModal,
}: SeparatePdfExportModalProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [previewClient, setPreviewClient] = useState<QuoteClient | null>(null);
  const [generating, setGenerating] = useState(false);

  if (!open) return null;

  const clients = doc.clients.length > 0 ? doc.clients : [{ key: 'c1', name: 'Valued Client', email: '', phone: '', address: '', gstin: '' }];

  const handleDownloadSingle = async (client: QuoteClient) => {
    try {
      await downloadQuotePdf(doc, includeWorkings, themeId, seller, templateId, client);
    } catch (err) {
      console.error('Failed to download single PDF:', err);
    }
  };

  const handlePreviewSingle = async (client: QuoteClient) => {
    try {
      setGenerating(true);
      const filename = getQuotePdfFilename(doc, includeWorkings, client);
      const pdf = await buildQuotePdf(doc, includeWorkings, themeId, seller, templateId, client);
      const blob = pdf.output('blob');
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setPreviewFilename(filename);
      setPreviewClient(client);
      setPreviewOpen(true);
    } catch (err) {
      console.error('Failed to preview PDF:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadAll = async () => {
    setGenerating(true);
    for (let i = 0; i < clients.length; i++) {
      await handleDownloadSingle(clients[i]);
      if (i < clients.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    setGenerating(false);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm transition-all duration-200">
        <div className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl border border-orange-100">
                <FileDown className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">Export Quotation PDFs</h3>
                  {includeWorkings ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200">
                      Quote with Workings
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200">
                      Commercial Quote
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">Download or preview separate quotation PDFs for each recipient.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onOpenThemeModal && (
                <button
                  type="button"
                  onClick={onOpenThemeModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:from-violet-500 hover:via-purple-500 hover:to-pink-400 border border-white/20 shadow-md shadow-purple-500/20 transition-all cursor-pointer active:scale-95"
                >
                  <Palette className="w-3.5 h-3.5 text-white" />
                  <span>Select Theme</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Selected Client Recipients ({clients.length})
              </span>
              <button
                type="button"
                disabled={generating}
                onClick={() => void handleDownloadAll()}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-1.5 px-3 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>{generating ? 'Downloading...' : 'Download All PDFs'}</span>
              </button>
            </div>

            {/* Scrollable list of clients */}
            <div className="space-y-2.5">
              {clients.map((client, idx) => {
                const gstinTxt = client.gstin ? ` • GSTIN: ${client.gstin}` : '';
                return (
                  <div
                    key={client.key || client.name || idx}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate">{client.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 ml-7 truncate">
                        {client.address || 'No address specified'}{gstinTxt}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        disabled={generating}
                        onClick={() => void handlePreviewSingle(client)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all active:scale-95 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Preview</span>
                      </button>
                      <button
                        type="button"
                        disabled={generating}
                        onClick={() => void handleDownloadSingle(client)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-all active:scale-95 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <GlobalPdfPreviewModal
        open={previewOpen}
        onClose={closePreview}
        blobUrl={previewBlobUrl}
        filename={previewFilename}
        clientName={previewClient?.name}
        quoteNo={doc.quoteNo}
        onDownload={previewClient ? () => void handleDownloadSingle(previewClient) : undefined}
      />
    </>
  );
}
