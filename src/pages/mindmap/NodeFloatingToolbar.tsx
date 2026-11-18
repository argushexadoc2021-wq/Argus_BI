import { useState } from 'react';
import {
  Clipboard,
  Copy,
  GitBranchPlus,
  GitFork,
  Link2,
  Palette,
  Pencil,
  Plus,
  Shapes,
  Trash2,
  ArrowUpFromLine,
} from 'lucide-react';
import {
  NODE_COLOR_PALETTE,
  type MindMapNode,
  type NodeShape,
  type NodeStyle,
} from '@/lib/mindmap/types';

interface NodeFloatingToolbarProps {
  node: MindMapNode;
  isRoot: boolean;
  canEdit: boolean;
  hasClipboard: boolean;
  connectingFromId: string | null;
  onAddChild: () => void;
  onAddSibling: () => void;
  onAddParent: () => void;
  onEditNode: () => void;
  onUpdateStyle: (patch: Partial<NodeStyle>) => void;
  onStartConnect: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
}

const SHAPE_OPTIONS: { id: NodeShape; label: string; previewClass: string }[] = [
  { id: 'rounded', label: 'Rounded', previewClass: 'rounded-md' },
  { id: 'pill', label: 'Pill', previewClass: 'rounded-full' },
  { id: 'rectangle', label: 'Rectangle', previewClass: 'rounded-[2px]' },
  { id: 'ellipse', label: 'Ellipse', previewClass: 'rounded-[50%]' },
  { id: 'diamond', label: 'Diamond', previewClass: 'rotate-45 rounded-[2px] scale-75' },
  { id: 'underline', label: 'Underline', previewClass: 'border-0 border-b-2 rounded-none' },
];

export function NodeFloatingToolbar({
  node,
  isRoot,
  canEdit,
  hasClipboard,
  connectingFromId,
  onAddChild,
  onAddSibling,
  onAddParent,
  onEditNode,
  onUpdateStyle,
  onStartConnect,
  onDuplicate,
  onCopy,
  onPaste,
  onDelete,
}: NodeFloatingToolbarProps) {
  const [popover, setPopover] = useState<'none' | 'color' | 'shape'>('none');

  if (!canEdit) return null;

  const currentShape: NodeShape = node.style.shape || 'rounded';

  return (
    <div
      className="relative flex items-center gap-0.5 rounded-2xl border border-slate-200 bg-white/95 px-1.5 py-1 shadow-xl backdrop-blur-md select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <ToolbarBtn icon={GitBranchPlus} label="Add Child (Tab)" onClick={onAddChild} accent="text-blue-600" />
      {!isRoot && (
        <ToolbarBtn icon={GitFork} label="Add Sibling (Enter)" onClick={onAddSibling} accent="text-emerald-600" />
      )}
      <ToolbarBtn icon={ArrowUpFromLine} label="Add Parent Node" onClick={onAddParent} accent="text-violet-600" />

      <span className="mx-0.5 h-5 w-px bg-slate-200" />

      <ToolbarBtn icon={Pencil} label="Edit Node & Notes" onClick={onEditNode} />

      <button
        type="button"
        title="Change Colour"
        onClick={() => setPopover((p) => (p === 'color' ? 'none' : 'color'))}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-xl transition-colors cursor-pointer ${
          popover === 'color' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <Palette className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        title="Change Shape"
        onClick={() => setPopover((p) => (p === 'shape' ? 'none' : 'shape'))}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-xl transition-colors cursor-pointer ${
          popover === 'shape' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <Shapes className="h-3.5 w-3.5" />
      </button>

      <ToolbarBtn
        icon={Link2}
        label={connectingFromId === node.id ? 'Cancel connection' : 'Connect to another node'}
        onClick={onStartConnect}
        active={connectingFromId === node.id}
      />

      <span className="mx-0.5 h-5 w-px bg-slate-200" />

      {!isRoot && <ToolbarBtn icon={Plus} label="Duplicate (Ctrl+D)" onClick={onDuplicate} />}
      <ToolbarBtn icon={Copy} label="Copy Branch (Ctrl+C)" onClick={onCopy} />
      {hasClipboard && <ToolbarBtn icon={Clipboard} label="Paste as Child (Ctrl+V)" onClick={onPaste} accent="text-blue-600" />}

      <span className="mx-0.5 h-5 w-px bg-slate-200" />

      <button
        type="button"
        disabled={isRoot}
        title={isRoot ? 'Root node cannot be deleted while the mind map is active' : 'Delete Node & Sub-branches (Del)'}
        onClick={onDelete}
        className="inline-flex h-7 w-7 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Colour Picker Popover */}
      {popover === 'color' && (
        <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 w-56 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xl z-50">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Node Theme Swatches
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {NODE_COLOR_PALETTE.map((swatch) => (
              <button
                key={swatch.name}
                type="button"
                title={swatch.name}
                onClick={() => {
                  onUpdateStyle({
                    backgroundColor: swatch.bg,
                    borderColor: swatch.border,
                    fontColor: swatch.text,
                    lineColor: swatch.line,
                  });
                  setPopover('none');
                }}
                className="h-7 w-7 rounded-lg border-2 shadow-xs transition-transform hover:scale-110 cursor-pointer"
                style={{ backgroundColor: swatch.bg, borderColor: swatch.border }}
              />
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              Fill
              <input
                type="color"
                value={node.style.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdateStyle({ backgroundColor: e.target.value })}
                className="h-5 w-6 cursor-pointer rounded border border-slate-200 p-0"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              Border
              <input
                type="color"
                value={node.style.borderColor || '#3b82f6'}
                onChange={(e) =>
                  onUpdateStyle({ borderColor: e.target.value, lineColor: e.target.value })
                }
                className="h-5 w-6 cursor-pointer rounded border border-slate-200 p-0"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              Text
              <input
                type="color"
                value={node.style.fontColor || '#0f172a'}
                onChange={(e) => onUpdateStyle({ fontColor: e.target.value })}
                className="h-5 w-6 cursor-pointer rounded border border-slate-200 p-0"
              />
            </label>
          </div>
        </div>
      )}

      {/* Shape Picker Popover */}
      {popover === 'shape' && (
        <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl z-50">
          <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Node Shape
          </p>
          <div className="grid grid-cols-2 gap-1">
            {SHAPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onUpdateStyle({ shape: opt.id });
                  setPopover('none');
                }}
                className={`flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[11px] font-semibold transition-colors cursor-pointer ${
                  currentShape === opt.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-5 border-2 border-current shrink-0 ${opt.previewClass}`}
                />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarBtn({
  icon: Icon,
  label,
  onClick,
  accent,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  accent?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-xl transition-colors cursor-pointer ${
        active
          ? 'bg-indigo-600 text-white shadow-xs'
          : `${accent || 'text-slate-600'} hover:bg-slate-100`
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
