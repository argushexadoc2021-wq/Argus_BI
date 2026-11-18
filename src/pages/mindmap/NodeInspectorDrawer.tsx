import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import {
  NODE_COLOR_PALETTE,
  type MindMapEdge,
  type MindMapNode,
  type NodeShape,
  type NodeStyle,
} from '@/lib/mindmap/types';

interface NodeInspectorDrawerProps {
  node: MindMapNode;
  allNodes: MindMapNode[];
  edges: MindMapEdge[];
  canEdit: boolean;
  onClose: () => void;
  onChangeNode: (patch: Partial<MindMapNode>) => void;
  onChangeStyle: (patch: Partial<NodeStyle>) => void;
  onUpdateEdgeLabel: (edgeId: string, label: string) => void;
  onDeleteEdge: (edgeId: string) => void;
}

const SHAPES: { id: NodeShape; label: string }[] = [
  { id: 'rounded', label: 'Rounded' },
  { id: 'pill', label: 'Pill' },
  { id: 'rectangle', label: 'Rect' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'underline', label: 'Minimal' },
];

export function NodeInspectorDrawer({
  node,
  allNodes,
  edges,
  canEdit,
  onClose,
  onChangeNode,
  onChangeStyle,
  onUpdateEdgeLabel,
  onDeleteEdge,
}: NodeInspectorDrawerProps) {
  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  const nodeEdges = edges.filter(
    (e) => e.source_node_id === node.id || e.target_node_id === node.id,
  );
  const style = node.style || {};

  return (
    <aside className="w-80 max-w-[92vw] shrink-0 border-l border-slate-200 bg-white flex flex-col h-full overflow-hidden shadow-lg z-20">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
            <StickyNote className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-xs font-black text-slate-900">Node Details &amp; Style</h3>
            <p className="text-[10px] text-slate-500">
              {node.parent_node_id ? 'Branch / Sub-topic' : 'Central Root Node'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Node Title
          </label>
          <input
            type="text"
            disabled={!canEdit}
            value={node.title}
            onChange={(e) => onChangeNode({ title: e.target.value })}
            placeholder="Enter topic title..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-bold text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none disabled:opacity-60"
          />
        </div>

        {/* Short Description */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Subtitle / Description
          </label>
          <input
            type="text"
            disabled={!canEdit}
            value={node.description ?? ''}
            onChange={(e) => onChangeNode({ description: e.target.value })}
            placeholder="Short summary shown inside node..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none disabled:opacity-60"
          />
        </div>

        {/* Detailed Notes & Ideas */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Notes &amp; Ideas
          </label>
          <textarea
            rows={4}
            disabled={!canEdit}
            value={node.notes ?? ''}
            onChange={(e) => onChangeNode({ notes: e.target.value })}
            placeholder="Write detailed ideas, action items, references, or thoughts..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs leading-relaxed text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none resize-y disabled:opacity-60"
          />
        </div>

        {/* Colours */}
        {canEdit && (
          <div className="border-t border-slate-100 pt-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Colours
            </label>
            <div className="grid grid-cols-6 gap-1.5 mb-2.5">
              {NODE_COLOR_PALETTE.map((sw) => (
                <button
                  key={sw.name}
                  type="button"
                  title={sw.name}
                  onClick={() =>
                    onChangeStyle({
                      backgroundColor: sw.bg,
                      borderColor: sw.border,
                      fontColor: sw.text,
                      lineColor: sw.line,
                    })
                  }
                  className="h-7 w-full rounded-lg border-2 transition-transform hover:scale-105 cursor-pointer"
                  style={{ backgroundColor: sw.bg, borderColor: sw.border }}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
                Fill
                <input
                  type="color"
                  value={style.backgroundColor || '#ffffff'}
                  onChange={(e) => onChangeStyle({ backgroundColor: e.target.value })}
                  className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
                Border
                <input
                  type="color"
                  value={style.borderColor || '#3b82f6'}
                  onChange={(e) =>
                    onChangeStyle({ borderColor: e.target.value, lineColor: e.target.value })
                  }
                  className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] font-semibold text-slate-500">
                Text
                <input
                  type="color"
                  value={style.fontColor || '#0f172a'}
                  onChange={(e) => onChangeStyle({ fontColor: e.target.value })}
                  className="h-7 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                />
              </label>
            </div>
          </div>
        )}

        {/* Shape */}
        {canEdit && (
          <div className="border-t border-slate-100 pt-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Shape
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChangeStyle({ shape: s.id })}
                  className={`rounded-xl border px-2 py-1.5 text-[11px] font-bold transition-colors cursor-pointer ${
                    (style.shape || 'rounded') === s.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Typography & Size */}
        {canEdit && (
          <div className="border-t border-slate-100 pt-3 space-y-2.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Text Style &amp; Size
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={style.fontSize || (node.parent_node_id ? 13 : 17)}
                onChange={(e) => onChangeStyle({ fontSize: Number(e.target.value) })}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
              >
                {[11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}px
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  onChangeStyle({
                    fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold',
                  })
                }
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border cursor-pointer ${
                  style.fontWeight === 'bold'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Bold"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() =>
                  onChangeStyle({
                    fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic',
                  })
                }
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border cursor-pointer ${
                  style.fontStyle === 'italic'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Italic"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>

              <div className="ml-auto inline-flex rounded-lg border border-slate-200 p-0.5">
                {(['left', 'center', 'right'] as const).map((al) => {
                  const Icon = al === 'left' ? AlignLeft : al === 'center' ? AlignCenter : AlignRight;
                  return (
                    <button
                      key={al}
                      type="button"
                      onClick={() => onChangeStyle({ textAlign: al })}
                      className={`p-1 rounded-md cursor-pointer ${
                        (style.textAlign || 'center') === al
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-semibold text-slate-500">
                Width ({Math.round(node.width)}px)
                <input
                  type="range"
                  min={100}
                  max={420}
                  value={Math.round(node.width)}
                  onChange={(e) => onChangeNode({ width: Number(e.target.value) })}
                  className="mt-1 w-full accent-blue-600"
                />
              </label>
              <label className="text-[10px] font-semibold text-slate-500">
                Height ({Math.round(node.height)}px)
                <input
                  type="range"
                  min={40}
                  max={220}
                  value={Math.round(node.height)}
                  onChange={(e) => onChangeNode({ height: Number(e.target.value) })}
                  className="mt-1 w-full accent-blue-600"
                />
              </label>
            </div>
          </div>
        )}

        {/* Custom Non-Hierarchical Connections */}
        {nodeEdges.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              <Link2 className="h-3 w-3 text-indigo-500" />
              Custom Connections ({nodeEdges.length})
            </label>
            <div className="space-y-2">
              {nodeEdges.map((edge) => {
                const otherId =
                  edge.source_node_id === node.id ? edge.target_node_id : edge.source_node_id;
                const other = nodeById.get(otherId);
                return (
                  <div
                    key={edge.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-2 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-bold text-slate-700">
                        {edge.source_node_id === node.id ? '→ ' : '← '}
                        {other?.title || 'Node'}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onDeleteEdge(edge.id)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                          title="Delete connection"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={edge.label ?? ''}
                      onChange={(e) => onUpdateEdgeLabel(edge.id, e.target.value)}
                      placeholder="Connection label (optional)..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
