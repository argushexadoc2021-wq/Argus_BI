import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Check } from 'lucide-react';
import { PDF_TEMPLATES, TEMPLATE_COLORS, PDF_THEMES, type PdfThemeColor } from '@/lib/quotationDocument';

export interface PdfTemplateSelectorModalProps {
  open: boolean;
  onClose: () => void;
  activeTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  activeColorId: string;
  onSelectColor: (colorId: string) => void;
  companyName?: string;
}

export function PdfTemplateSelectorModal({
  open,
  onClose,
  activeTemplateId,
  onSelectTemplate,
  activeColorId,
  onSelectColor,
  companyName = 'Argus Technologies',
}: PdfTemplateSelectorModalProps) {
  const currentColorObj: PdfThemeColor = PDF_THEMES[activeColorId] || PDF_THEMES.orange;

  const renderThumbnail = (templateId: string, color: PdfThemeColor) => {
    const hexPrimary = color.hex;
    const hexBg = color.bgHex;
    const hexBorder = color.borderHex;
    const hexAccent = color.accentTextHex;

    const isT9or10 = templateId === 'template-9' || templateId === 'template-10';
    const isT7or8 = templateId === 'template-7' || templateId === 'template-8';
    const isT5or6 = templateId === 'template-5' || templateId === 'template-6';
    const isT3or4 = templateId === 'template-3' || templateId === 'template-4';
    const isEven = ['template-2', 'template-4', 'template-6', 'template-8', 'template-10'].includes(templateId);

    if (isT9or10) {
      return (
        <div className="h-56 w-full rounded-xl bg-white border border-slate-200 shadow-2xs p-2.5 flex flex-col justify-between select-none overflow-hidden text-[7px] leading-tight font-sans">
          <div className="text-center font-black text-[10px] tracking-wide" style={{ color: hexPrimary }}>
            Quotation
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-xs flex items-center justify-center font-bold text-white text-[7px] bg-slate-900">
              A
            </div>
            <span className="font-bold text-[7.5px] text-slate-900 truncate uppercase">{companyName}</span>
          </div>
          <div className="grid grid-cols-2 gap-1 my-0.5">
            <div className="p-1 rounded text-[5px]" style={{ backgroundColor: hexBg, border: `1px solid ${hexBorder}50` }}>
              <span className="font-bold block" style={{ color: hexAccent }}>Quotation by</span>
              <span className="font-semibold text-slate-800 block truncate">{companyName}</span>
              <span className="text-slate-500 block">GSTIN: 33CZEPS8675J1ZN</span>
            </div>
            <div className="p-1 rounded text-[5px]" style={{ backgroundColor: hexBg, border: `1px solid ${hexBorder}50` }}>
              <span className="font-bold block" style={{ color: hexAccent }}>Quotation to</span>
              <span className="font-semibold text-slate-800 block truncate">Valued Client Corp</span>
              <span className="text-slate-500 block">GSTIN: 29ABCDE1234F1Z5</span>
            </div>
          </div>
          <div className="flex justify-between px-1 text-[5.5px] text-slate-600 font-bold border-y border-slate-100 py-0.5">
            <span>Quote #: <strong>001</strong></span>
            <span>Date: <strong>17/11/2026</strong></span>
          </div>
          <div className="rounded overflow-hidden border border-slate-200">
            <div className="h-3 text-white flex items-center px-1 justify-between font-bold text-[5px]" style={{ backgroundColor: hexPrimary }}>
              <span className="flex-1">Item Description</span>
              <span className="w-5 text-center">Qty</span>
              <span className="w-7 text-right">Price</span>
              <span className="w-8 text-right">Amount</span>
            </div>
            <div className="bg-white px-1 py-0.5 flex justify-between text-[4.8px] text-slate-700">
              <span className="flex-1 truncate">CNC Machined Shaft</span>
              <span className="w-5 text-center">1</span>
              <span className="w-7 text-right">4,500</span>
              <span className="w-8 text-right font-bold">4,500.00</span>
            </div>
          </div>
          <div className="flex justify-between items-end pt-1 border-t border-slate-100 text-[5px]">
            <span className="text-slate-400 italic">Total: ₹5,310.00</span>
            {isEven ? (
              <span className="text-slate-400 italic text-[4.5px]">Electronic Generation</span>
            ) : (
              <span className="border-t border-slate-400 px-1 font-bold text-slate-700 text-[4.8px]">Authorized Sign</span>
            )}
          </div>
        </div>
      );
    }

    if (isT7or8) {
      return (
        <div className="h-56 w-full rounded-xl bg-white border border-slate-200 shadow-2xs p-2.5 flex flex-col justify-between select-none overflow-hidden text-[7px] leading-tight font-sans">
          <div className="flex items-start justify-between pb-1 border-b border-slate-100">
            <div>
              <div className="font-extrabold text-[8px] text-slate-900 truncate uppercase">{companyName}</div>
              <div className="text-[5px] text-slate-500">Coimbatore, Tamil Nadu</div>
              <div className="text-[5px] text-slate-500 font-mono">GSTIN: 33CZEPS8675J1ZN</div>
            </div>
            <div className="text-right">
              <div className="font-black text-[12px] uppercase" style={{ color: hexPrimary }}>QUOTE</div>
              <div className="text-[5px] text-slate-600 font-medium">Quote #: 001</div>
            </div>
          </div>
          <div className="text-[5.5px]">
            <span className="font-bold uppercase" style={{ color: hexAccent }}>Bill To</span>
            <div className="font-bold text-slate-800 truncate">Valued Client Corp</div>
          </div>
          <div className="rounded overflow-hidden border border-slate-200">
            <div className="h-3 text-white flex items-center px-1 justify-between font-bold text-[5px]" style={{ backgroundColor: hexPrimary }}>
              <span className="flex-1">Description</span>
              <span className="w-6 text-center">HSN</span>
              <span className="w-5 text-center">Qty</span>
              <span className="w-8 text-right">Total</span>
            </div>
            <div className="bg-white px-1 py-0.5 flex justify-between text-[4.8px] text-slate-700">
              <span className="flex-1 truncate">Laser Cut Flange</span>
              <span className="w-6 text-center text-slate-400">7326</span>
              <span className="w-5 text-center">2</span>
              <span className="w-8 text-right font-bold">3,600.00</span>
            </div>
          </div>
          <div className="flex justify-between items-end pt-1 border-t border-slate-100 text-[5px]">
            <span className="text-slate-400 italic">Total: ₹4,248.00</span>
            {isEven ? (
              <span className="text-slate-400 italic text-[4.5px]">Electronic Generation</span>
            ) : (
              <span className="border-t border-slate-400 px-1 font-bold text-slate-700 text-[4.8px]">customer sign</span>
            )}
          </div>
        </div>
      );
    }

    if (isT5or6) {
      return (
        <div className="h-56 w-full rounded-xl bg-white border border-slate-200 shadow-2xs p-2.5 flex flex-col justify-between select-none overflow-hidden text-[7px] leading-tight font-sans">
          <div className="pb-1 border-b border-slate-100">
            <span className="text-[5px] uppercase font-bold tracking-wider" style={{ color: hexPrimary }}>Quotation</span>
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[8px]" style={{ color: hexPrimary }}>{companyName}</span>
              <span className="text-[5px] font-mono text-slate-500">GSTIN: 33CZEPS8675J1ZN</span>
            </div>
          </div>
          <div className="h-2.5 flex items-center justify-between px-1 text-white text-[5px] font-bold rounded-xs" style={{ backgroundColor: hexPrimary }}>
            <span>Quotation No: 001</span>
            <span>Date: 17/11/2026</span>
          </div>
          <div className="text-[5.5px]">
            <span className="font-bold text-slate-800">Bill To: </span>
            <span className="text-slate-600 truncate">Valued Client Corp</span>
          </div>
          <div className="rounded overflow-hidden border border-slate-200">
            <div className="h-3 text-white flex items-center px-1 justify-between font-bold text-[5px]" style={{ backgroundColor: hexPrimary }}>
              <span className="flex-1">Items</span>
              <span className="w-6 text-center">Qty</span>
              <span className="w-8 text-right">Amount</span>
            </div>
            <div className="bg-white px-1 py-0.5 flex justify-between text-[4.8px] text-slate-700">
              <span className="flex-1 truncate">Tool Steel Block</span>
              <span className="w-6 text-center">4</span>
              <span className="w-8 text-right font-bold">8,000.00</span>
            </div>
          </div>
          <div className="flex justify-between items-end pt-1 border-t border-slate-100 text-[5px]">
            <span className="text-slate-400 italic">Total: ₹9,440.00</span>
            {isEven ? (
              <span className="text-slate-400 italic text-[4.5px]">Electronic Generation</span>
            ) : (
              <span className="border-t border-slate-400 px-1 font-bold text-slate-700 text-[4.8px]">Authorised Signature</span>
            )}
          </div>
        </div>
      );
    }

    if (isT3or4) {
      return (
        <div className="h-56 w-full rounded-xl bg-white border border-slate-200 shadow-2xs p-2.5 flex flex-col justify-between select-none overflow-hidden text-[7px] leading-tight font-sans">
          <div className="text-center font-bold text-[9px] uppercase tracking-wide border-b border-slate-100 pb-0.5" style={{ color: hexPrimary }}>
            QUOTATION
          </div>
          <div className="text-center">
            <span className="font-extrabold text-[8px] block" style={{ color: hexPrimary }}>{companyName}</span>
            <span className="text-[5px] text-slate-500">Ganapathy, Coimbatore · GSTIN: 33CZEPS8675J1ZN</span>
          </div>
          <div className="border border-slate-200 rounded p-1 text-[5px] flex justify-between" style={{ backgroundColor: hexBg }}>
            <div>
              <span className="font-bold block" style={{ color: hexAccent }}>Client Details:</span>
              <span className="font-semibold text-slate-800">Valued Client Corp</span>
            </div>
            <div className="text-right">
              <div>Quote #: <strong>001</strong></div>
              <div>Date: <strong>17/11/2026</strong></div>
            </div>
          </div>
          <div className="rounded overflow-hidden border border-slate-200">
            <div className="h-3 text-white flex items-center px-1 justify-between font-bold text-[5px]" style={{ backgroundColor: hexPrimary }}>
              <span className="flex-1">Description</span>
              <span className="w-6 text-center">Qty</span>
              <span className="w-8 text-right">Amount</span>
            </div>
            <div className="bg-white px-1 py-0.5 flex justify-between text-[4.8px] text-slate-700">
              <span className="flex-1 truncate">Precision Bush</span>
              <span className="w-6 text-center">10</span>
              <span className="w-8 text-right font-bold">12,500.00</span>
            </div>
          </div>
          <div className="flex justify-between items-end pt-1 border-t border-slate-100 text-[5px]">
            <span className="text-slate-400 italic">Total: ₹14,750.00</span>
            {isEven ? (
              <span className="text-slate-400 italic text-[4.5px]">Electronic Generation</span>
            ) : (
              <span className="border-t border-slate-400 px-1 font-bold text-slate-700 text-[4.8px]">Authorised Signature</span>
            )}
          </div>
        </div>
      );
    }

    // Default: Template 1 & 2 (Dual Card / Banner Header)
    return (
      <div className="h-56 w-full rounded-xl bg-white border border-slate-200 shadow-2xs p-2.5 flex flex-col justify-between select-none overflow-hidden text-[7px] leading-tight font-sans">
        <div className="h-5 rounded-sm px-1.5 flex items-center justify-between text-white" style={{ backgroundColor: hexPrimary }}>
          <span className="font-black text-[8px] uppercase tracking-wider">QUOTATION</span>
          <span className="text-[5.5px] truncate max-w-[100px]">{companyName}</span>
        </div>
        <div className="flex justify-between text-[5.2px] text-slate-600 px-0.5">
          <span>Quote: #001</span>
          <span>Date: 17/11/2026</span>
        </div>
        <div className="border-l-2 pl-1.5 my-0.5 text-[5.2px]" style={{ borderColor: hexPrimary }}>
          <span className="font-bold text-slate-800">To: Valued Client Corp</span>
          <div className="text-slate-500 text-[4.8px]">Industrial Area, Bangalore</div>
        </div>
        <div className="rounded overflow-hidden border border-slate-200">
          <div className="h-3 text-white flex items-center px-1 justify-between font-bold text-[5px]" style={{ backgroundColor: hexPrimary }}>
            <span className="w-3">#</span>
            <span className="flex-1 px-1">Description</span>
            <span className="w-6 text-center">Qty</span>
            <span className="w-8 text-right">Amount</span>
          </div>
          <div className="bg-white px-1 py-0.5 flex justify-between text-[4.8px] text-slate-700">
            <span className="w-3">1</span>
            <span className="flex-1 px-1 truncate">Machined Component</span>
            <span className="w-6 text-center">5</span>
            <span className="w-8 text-right font-bold">6,000.00</span>
          </div>
        </div>
        <div className="flex justify-between items-end pt-1 border-t border-slate-100 text-[5px]">
          <span className="text-slate-400 italic">Total: ₹7,080.00</span>
          {isEven ? (
            <span className="text-slate-400 italic text-[4.5px]">Electronic Generation</span>
          ) : (
            <span className="border-t border-slate-400 px-1 font-bold text-slate-700 text-[4.8px]">Authorized Sign</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select Quotation PDF Template & Theme"
      subtitle="Choose from 10 professional layouts and 5 executive color schemes"
      size="xl"
      tall={true}
    >
      <div className="space-y-4 pb-2">
        {/* Active Theme Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Active Format:</span>
            <span className="text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shadow-2xs">
              {PDF_TEMPLATES.find(t => t.id === activeTemplateId)?.name || 'Template 1'}
            </span>
            <span
              className="text-xs font-bold text-white px-2.5 py-1 rounded-lg shadow-2xs"
              style={{ backgroundColor: currentColorObj.hex }}
            >
              {currentColorObj.name}
            </span>
          </div>
          <div className="text-xs text-slate-500">
            Pick a template and click any color circle to customize
          </div>
        </div>

        {/* 10 Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {PDF_TEMPLATES.map(template => {
            const isSelected = template.id === activeTemplateId;
            return (
              <div
                key={template.id}
                onClick={() => onSelectTemplate(template.id)}
                className={`cursor-pointer rounded-2xl border-2 p-3 transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50/10 shadow-md ring-2 ring-brand-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-xs font-extrabold text-slate-900">{template.name}</span>
                    {isSelected ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Check size={10} /> Active
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">Select</span>
                    )}
                  </div>

                  {/* Thumbnail Preview */}
                  <div className="pointer-events-none mb-2">
                    {renderThumbnail(template.id, currentColorObj)}
                  </div>

                  {/* Tagline */}
                  <p className="text-[10px] text-slate-500 leading-tight mb-3">
                    {template.tagline}
                  </p>

                  {/* Color Swatches */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Color:</span>
                    <div className="flex items-center gap-1.5">
                      {TEMPLATE_COLORS.map(c => {
                        const isColorSelected = c.id === activeColorId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            title={c.name}
                            onClick={e => {
                              e.stopPropagation();
                              onSelectColor(c.id);
                              onSelectTemplate(template.id);
                            }}
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-115 cursor-pointer ${
                              isColorSelected && isSelected
                                ? 'ring-2 ring-offset-1 ring-slate-800 scale-110 shadow-xs'
                                : 'opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          >
                            {isColorSelected && isSelected && <Check size={10} className="text-white stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Choose button */}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onSelectTemplate(template.id);
                  }}
                  className={`mt-3 w-full py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {isSelected ? 'Active Template' : `Use ${template.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
