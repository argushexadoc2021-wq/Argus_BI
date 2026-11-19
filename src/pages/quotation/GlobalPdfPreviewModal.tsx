import React from 'react';
import { Download, FileText, X } from 'lucide-react';

export interface GlobalPdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  blobUrl: string | null;
  filename: string;
  clientName?: string;
  quoteNo?: string;
  onDownload?: () => void;
}

export function GlobalPdfPreviewModal({
  open,
  onClose,
  blobUrl,
  filename,
  clientName,
  quoteNo,
  onDownload,
}: GlobalPdfPreviewModalProps) {
  if (!open || !blobUrl) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md transition-all">
      <div className="relative w-full max-w-6xl h-[92vh] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0 border border-orange-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 truncate">{filename || 'Quotation PDF Preview'}</h3>
              <p className="text-[11px] font-semibold text-slate-500 truncate">
                {clientName ? `Client: ${clientName}` : 'Quotation Document'} {quoteNo ? `• Quotation #${quoteNo}` : ''}
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 w-full bg-slate-800 relative overflow-hidden">
          <iframe
            src={`${blobUrl}#navpanes=0&view=FitH`}
            className="w-full h-full border-0"
            title="Quotation PDF"
          />
        </div>
      </div>
    </div>
  );
}
