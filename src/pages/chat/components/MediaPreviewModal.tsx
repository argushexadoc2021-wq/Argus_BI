import { X, Download, FileText } from 'lucide-react';

export function MediaPreviewModal({
  file,
  onClose,
}: {
  file: { name: string; url: string; type: string; size?: number } | null;
  onClose: () => void;
}) {
  if (!file) return null;

  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar with file name & actions */}
        <div className="w-full flex items-center justify-between py-2 px-4 bg-slate-900/80 rounded-t-xl text-white mb-1">
          <div className="flex items-center gap-2 truncate">
            <FileText size={16} className="text-orange-400 shrink-0" />
            <span className="text-sm font-semibold truncate">{file.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={file.url}
              download={file.name}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-colors"
            >
              <Download size={14} /> Download
            </a>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="w-full max-h-[80vh] flex items-center justify-center overflow-auto rounded-b-xl bg-slate-950 p-2">
          {isImage ? (
            <img src={file.url} alt={file.name} className="max-h-[75vh] max-w-full object-contain rounded shadow-lg" />
          ) : isPdf ? (
            <iframe src={file.url} title={file.name} className="w-full h-[75vh] rounded border-0" />
          ) : (
            <div className="py-16 text-center text-slate-300">
              <FileText size={48} className="mx-auto mb-3 text-brand-500" />
              <p className="text-base font-bold">{file.name}</p>
              <p className="text-xs text-slate-400 mt-1">Preview not supported for this file type</p>
              <a
                href={file.url}
                download={file.name}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <Download size={14} /> Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
