// Mind maps, flowcharts / diagrams and tables made by the Adviser. The AI adds blocks at the END of its answer:
//   [[MINDMAP {"title":"...","root":{"label":"Centre","children":[{"label":"Branch","children":[{"label":"Leaf"}]}]}}]]
//   [[DIAGRAM {"title":"...","kind":"flow|org|timeline|cycle","direction":"TB|LR","nodes":[{"id":"a","label":"Start","shape":"start|end|step|decision|data"}],"edges":[{"from":"a","to":"b","label":"Yes"}]}]]
//   [[TABLE {"title":"...","columns":["A","B"],"rows":[["1","2"]]}]]
// Each is drawn on screen as a picture (or a table) with Download buttons; a mind map can also be saved into the Mind Maps module.

/* eslint-disable @typescript-eslint/no-explicit-any -- the AI's JSON is read loosely and checked field by field */
import { useState, type ReactNode } from 'react';
import { Download, ExternalLink, Loader2, Network } from 'lucide-react';
import type { NodeStyle, TemplateEdgeSeed, TemplateNodeSeed } from '@/lib/mindmap/types';

export interface MindNode { label: string; children?: MindNode[] }
export interface MindMapSpec { title: string; root: MindNode }
export interface DiagramNode { id: string; label: string; shape?: 'start' | 'end' | 'step' | 'decision' | 'data' | 'person' }
export interface DiagramEdge { from: string; to: string; label?: string }
export interface DiagramSpec { title: string; kind: 'flow' | 'org' | 'timeline' | 'cycle'; direction: 'TB' | 'LR'; nodes: DiagramNode[]; edges: DiagramEdge[] }
export interface TableSpec { title: string; columns: string[]; rows: string[][] }
export interface Visuals { mindmaps: MindMapSpec[]; diagrams: DiagramSpec[]; tables: TableSpec[] }

const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
const FONT = 'font-family="Segoe UI, Noto Sans Tamil, Arial, sans-serif"';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Pulls every MINDMAP / DIAGRAM / TABLE block out of an answer. Braces are matched properly, so nested JSON is read whole. */
export function parseVisuals(text: string): Visuals {
  const out: Visuals = { mindmaps: [], diagrams: [], tables: [] };
  const re = /\[\[\s*(MINDMAP|DIAGRAM|TABLE)\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = text.indexOf('{', m.index + m[0].length - 1);
    if (start < 0) break;
    const end = matchBrace(text, start);
    if (end < 0) break;   // still streaming
    re.lastIndex = end + 1;
    try {
      const j = JSON.parse(text.slice(start, end + 1));
      if (m[1] === 'MINDMAP') {
        const root = toMindNode(j.root ?? j, 0);
        if (root) out.mindmaps.push({ title: String(j.title || root.label || 'Mind map'), root });
      } else if (m[1] === 'DIAGRAM') {
        const d = toDiagram(j);
        if (d) out.diagrams.push(d);
      } else {
        const columns = (Array.isArray(j.columns) ? j.columns : []).map((c: unknown) => String(c ?? ''));
        const rows = (Array.isArray(j.rows) ? j.rows : []).slice(0, 300)
          .map((r: unknown) => (Array.isArray(r) ? r : [r]).map((c) => (c == null ? '' : String(c))));
        if (columns.length || rows.length) out.tables.push({ title: String(j.title || 'Table'), columns, rows });
      }
    } catch { /* a broken block is skipped */ }
  }
  return out;
}

function matchBrace(s: string, i: number): number {
  let depth = 0, inStr = false;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (inStr) { if (c === '\\') k++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return k; }
  }
  return -1;
}

function toMindNode(v: any, depth: number): MindNode | null {
  if (v == null) return null;
  if (typeof v === 'string') return { label: v };
  const label = String(v.label ?? v.title ?? v.name ?? v.text ?? '').trim();
  if (!label) return null;
  const kids = depth < 5 && Array.isArray(v.children) ? v.children.slice(0, 12).map((c: any) => toMindNode(c, depth + 1)).filter(Boolean) as MindNode[] : [];
  return kids.length ? { label, children: kids } : { label };
}

function toDiagram(j: any): DiagramSpec | null {
  const kind = (['flow', 'org', 'timeline', 'cycle'].includes(j.kind) ? j.kind : 'flow') as DiagramSpec['kind'];
  const nodes: DiagramNode[] = (Array.isArray(j.nodes) ? j.nodes : []).slice(0, 40).map((n: any, i: number) => (
    typeof n === 'string' ? { id: `n${i}`, label: n } : { id: String(n.id ?? `n${i}`), label: String(n.label ?? n.title ?? n.id ?? ''), shape: n.shape }
  )).filter((n: DiagramNode) => n.label);
  if (!nodes.length) return null;
  const ids = new Set(nodes.map((n) => n.id));
  let edges: DiagramEdge[] = (Array.isArray(j.edges) ? j.edges : []).map((e: any) => ({ from: String(e.from ?? e.source ?? ''), to: String(e.to ?? e.target ?? ''), label: e.label ? String(e.label) : undefined }))
    .filter((e: DiagramEdge) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to);
  // a timeline / cycle with no links: one after the other (a cycle also goes back to the start)
  if (!edges.length && (kind === 'timeline' || kind === 'cycle' || kind === 'flow')) {
    edges = nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }));
    if (kind === 'cycle' && nodes.length > 2) edges.push({ from: nodes[nodes.length - 1].id, to: nodes[0].id });
  }
  const direction = j.direction === 'LR' || (j.direction !== 'TB' && kind === 'timeline') ? 'LR' : 'TB';
  return { title: String(j.title || 'Diagram'), kind, direction, nodes, edges };
}

/** Splits a label into lines of at most `max` characters. */
function wrap(label: string, max: number, maxLines = 3): string[] {
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] = `${keep[maxLines - 1].slice(0, max - 1)}…`; return keep; }
  return lines;
}

// ------------------------------------------------------------------ mind map: the centre on the left, branches to the right
interface Placed { node: MindNode; depth: number; x: number; y: number; w: number; h: number; lines: string[]; color: string; parent?: Placed }

function layoutMind(spec: MindMapSpec) {
  const ROW = 46, COLW = 230;
  const placed: Placed[] = [];
  let leafY = 0;
  const walk = (n: MindNode, depth: number, color: string, parent?: Placed): Placed => {
    const lines = wrap(n.label, depth === 0 ? 20 : 26, depth === 0 ? 3 : 2);
    const w = depth === 0 ? 170 : Math.min(200, Math.max(90, Math.max(...lines.map((l) => l.length)) * 6.6 + 22));
    const h = depth === 0 ? 26 + lines.length * 16 : 14 + lines.length * 14;
    const p: Placed = { node: n, depth, x: 20 + depth * COLW, y: 0, w, h, lines, color, parent };
    placed.push(p);
    const kids = n.children ?? [];
    if (!kids.length) { p.y = leafY + ROW / 2; leafY += Math.max(ROW, h + 10); return p; }
    const placedKids = kids.map((c, i) => walk(c, depth + 1, depth === 0 ? PALETTE[i % PALETTE.length] : color, p));
    p.y = (placedKids[0].y + placedKids[placedKids.length - 1].y) / 2;
    return p;
  };
  walk(spec.root, 0, '#0f172a');
  const maxDepth = Math.max(...placed.map((p) => p.depth));
  return { placed, W: 40 + maxDepth * COLW + 210, H: Math.max(140, leafY + 50) };
}

export function mindMapSvg(spec: MindMapSpec): { svg: string; W: number; H: number } {
  const { placed, W, H } = layoutMind(spec);
  const top = 34;
  const o: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + top}" viewBox="0 0 ${W} ${H + top}"><rect width="${W}" height="${H + top}" fill="#ffffff"/>`,
    `<text x="16" y="22" font-size="15" font-weight="700" fill="#0f172a" ${FONT}>${esc(spec.title)}</text>`, `<g transform="translate(0 ${top})">`];
  for (const p of placed) {
    if (!p.parent) continue;
    const x1 = p.parent.x + p.parent.w, y1 = p.parent.y, x2 = p.x, y2 = p.y, mx = (x1 + x2) / 2;
    o.push(`<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="${p.color}" stroke-width="${p.depth === 1 ? 2.5 : 1.6}" opacity="0.85"/>`);
  }
  for (const p of placed) {
    const y = p.y - p.h / 2;
    const fill = p.depth === 0 ? '#0f172a' : p.depth === 1 ? p.color : '#ffffff';
    const stroke = p.depth === 0 ? '#3b82f6' : p.color;
    const txt = p.depth <= 1 ? '#ffffff' : '#1e293b';
    o.push(`<rect x="${p.x}" y="${y}" width="${p.w}" height="${p.h}" rx="${p.depth === 0 ? 12 : p.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${p.depth === 0 ? 2 : 1.5}"/>`);
    const fs = p.depth === 0 ? 14 : p.depth === 1 ? 12 : 11;
    const lh = p.depth === 0 ? 16 : 14;
    p.lines.forEach((l, i) => o.push(`<text x="${p.x + p.w / 2}" y="${p.y - ((p.lines.length - 1) * lh) / 2 + i * lh + 4}" text-anchor="middle" font-size="${fs}" font-weight="${p.depth <= 1 ? 700 : 600}" fill="${txt}" ${FONT}>${esc(l)}</text>`));
  }
  o.push('</g></svg>');
  return { svg: o.join(''), W, H: H + top };
}

// ------------------------------------------------------------------ diagrams: boxes in layers, joined by arrows
export function diagramSvg(d: DiagramSpec): { svg: string; W: number; H: number } {
  const lr = d.direction === 'LR';
  const BW = 150, GAP_MAIN = lr ? 70 : 64, GAP_CROSS = 26;
  // layer = longest path from a start (back links of a cycle are ignored for this)
  const layer = new Map<string, number>(d.nodes.map((n) => [n.id, 0]));
  const order = new Map(d.nodes.map((n, i) => [n.id, i]));
  const forward = d.edges.filter((e) => (order.get(e.to) ?? 0) > (order.get(e.from) ?? 0) || d.kind !== 'cycle');
  for (let pass = 0; pass < d.nodes.length; pass++) {
    let moved = false;
    for (const e of forward) {
      if ((order.get(e.to) ?? 0) <= (order.get(e.from) ?? 0) && d.kind === 'cycle') continue;
      const want = (layer.get(e.from) ?? 0) + 1;
      if (want > (layer.get(e.to) ?? 0) && want < d.nodes.length) { layer.set(e.to, want); moved = true; }
    }
    if (!moved) break;
  }
  const layers: DiagramNode[][] = [];
  for (const n of d.nodes) { const l = layer.get(n.id) ?? 0; (layers[l] ??= []).push(n); }
  const size = (n: DiagramNode) => {
    const lines = wrap(n.label, 20, 3);
    const h = n.shape === 'decision' ? 34 + lines.length * 14 : 18 + lines.length * 14;
    return { lines, w: n.shape === 'decision' ? BW + 20 : BW, h };
  };
  const info = new Map(d.nodes.map((n) => [n.id, size(n)]));
  const mainSizes = layers.map((ns) => Math.max(...ns.map((n) => (lr ? info.get(n.id)!.w : info.get(n.id)!.h))));
  const crossTotal = layers.map((ns) => ns.reduce((a, n) => a + (lr ? info.get(n.id)!.h : info.get(n.id)!.w) + GAP_CROSS, -GAP_CROSS));
  const crossMax = Math.max(...crossTotal);
  const pos = new Map<string, { cx: number; cy: number; w: number; h: number }>();
  let mainAt = 20;
  layers.forEach((ns, li) => {
    let crossAt = 20 + (crossMax - crossTotal[li]) / 2;
    ns.forEach((n) => {
      const s = info.get(n.id)!;
      const along = lr ? s.h : s.w;
      const c1 = mainAt + mainSizes[li] / 2, c2 = crossAt + along / 2;
      pos.set(n.id, lr ? { cx: c1, cy: c2, w: s.w, h: s.h } : { cx: c2, cy: c1, w: s.w, h: s.h });
      crossAt += along + GAP_CROSS;
    });
    mainAt += mainSizes[li] + GAP_MAIN;
  });
  const top = 34;
  // room at the side for links that curve around (loops and jumps)
  const W = Math.max(320, (lr ? mainAt - GAP_MAIN : crossMax) + 40 + (lr ? 0 : 70));
  const H = (lr ? crossMax : mainAt - GAP_MAIN) + 40 + (lr ? 60 : 0);
  const o: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + top}" viewBox="0 0 ${W} ${H + top}"><rect width="${W}" height="${H + top}" fill="#ffffff"/>`,
    `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#64748b"/></marker></defs>`,
    `<text x="16" y="22" font-size="15" font-weight="700" fill="#0f172a" ${FONT}>${esc(d.title)}</text>`, `<g transform="translate(0 ${top})">`];
  const edgePoint = (p: { cx: number; cy: number; w: number; h: number }, tx: number, ty: number) => {
    const dx = tx - p.cx, dy = ty - p.cy;
    if (!dx && !dy) return { x: p.cx, y: p.cy };
    const sx = (p.w / 2) / Math.abs(dx || 1e-9), sy = (p.h / 2) / Math.abs(dy || 1e-9);
    const s = Math.min(sx, sy);
    return { x: p.cx + dx * s, y: p.cy + dy * s };
  };
  d.edges.forEach((e) => {
    const a = pos.get(e.from), b = pos.get(e.to); if (!a || !b) return;
    const back = (lr ? b.cx <= a.cx : b.cy <= a.cy);
    const p1 = edgePoint(a, b.cx, b.cy), p2 = edgePoint(b, a.cx, a.cy);
    // a link that jumps over a layer would run through the boxes between: it curves around the side instead
    const skips = !back && Math.abs((layer.get(e.to) ?? 0) - (layer.get(e.from) ?? 0)) > 1
      && (lr ? Math.abs(a.cy - b.cy) < 4 : Math.abs(a.cx - b.cx) < 4);
    if (skips) {
      const off = lr ? Math.max(a.h, b.h) / 2 + 34 : Math.max(a.w, b.w) / 2 + 44;
      const path = lr
        ? `M${a.cx},${a.cy + a.h / 2} C${a.cx},${a.cy + off} ${b.cx},${b.cy + off} ${b.cx},${b.cy + b.h / 2}`
        : `M${a.cx + a.w / 2},${a.cy} C${a.cx + off},${a.cy} ${b.cx + off},${b.cy} ${b.cx + b.w / 2},${b.cy}`;
      o.push(`<path d="${path}" fill="none" stroke="#64748b" stroke-width="1.8" marker-end="url(#arr)"/>`);
      if (e.label) {
        const mx = lr ? (a.cx + b.cx) / 2 : a.cx + off * 0.78, my = lr ? a.cy + off * 0.78 : (a.cy + b.cy) / 2;
        const w = e.label.length * 6.2 + 10;
        o.push(`<rect x="${mx - w / 2}" y="${my - 9}" width="${w}" height="16" rx="4" fill="#f8fafc" stroke="#cbd5e1"/>`,
          `<text x="${mx}" y="${my + 3}" text-anchor="middle" font-size="10" font-weight="600" fill="#334155" ${FONT}>${esc(e.label)}</text>`);
      }
      return;
    }
    if (back) {
      // a link going back (a loop): drawn as a curve around the side
      const off = lr ? -(Math.max(a.h, b.h) / 2 + 30) : Math.max(a.w, b.w) / 2 + 40;
      const path = lr
        ? `M${a.cx},${a.cy - a.h / 2} C${a.cx},${a.cy + off} ${b.cx},${b.cy + off} ${b.cx},${b.cy - b.h / 2}`
        : `M${a.cx + a.w / 2},${a.cy} C${a.cx + off},${a.cy} ${b.cx + off},${b.cy} ${b.cx + b.w / 2},${b.cy}`;
      o.push(`<path d="${path}" fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#arr)"/>`);
    } else {
      o.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#64748b" stroke-width="1.8" marker-end="url(#arr)"/>`);
    }
    if (e.label) {
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      const w = e.label.length * 6.2 + 10;
      o.push(`<rect x="${mx - w / 2}" y="${my - 9}" width="${w}" height="16" rx="4" fill="#f8fafc" stroke="#cbd5e1"/>`,
        `<text x="${mx}" y="${my + 3}" text-anchor="middle" font-size="10" font-weight="600" fill="#334155" ${FONT}>${esc(e.label)}</text>`);
    }
  });
  d.nodes.forEach((n, i) => {
    const p = pos.get(n.id)!; const s = info.get(n.id)!;
    const color = d.kind === 'org' ? PALETTE[Math.min(layer.get(n.id) ?? 0, PALETTE.length - 1)] : n.shape === 'start' ? '#10b981' : n.shape === 'end' ? '#ef4444' : n.shape === 'decision' ? '#f59e0b' : n.shape === 'data' ? '#8b5cf6' : d.kind === 'timeline' || d.kind === 'cycle' ? PALETTE[i % PALETTE.length] : '#2563eb';
    const x = p.cx - p.w / 2, y = p.cy - p.h / 2;
    if (n.shape === 'decision') o.push(`<polygon points="${p.cx},${y} ${x + p.w},${p.cy} ${p.cx},${y + p.h} ${x},${p.cy}" fill="#fffbeb" stroke="${color}" stroke-width="2"/>`);
    else if (n.shape === 'data') o.push(`<polygon points="${x + 12},${y} ${x + p.w},${y} ${x + p.w - 12},${y + p.h} ${x},${y + p.h}" fill="#f5f3ff" stroke="${color}" stroke-width="2"/>`);
    else if (n.shape === 'start' || n.shape === 'end') o.push(`<rect x="${x}" y="${y}" width="${p.w}" height="${p.h}" rx="${p.h / 2}" fill="${color}" stroke="${color}" stroke-width="2"/>`);
    else o.push(`<rect x="${x}" y="${y}" width="${p.w}" height="${p.h}" rx="8" fill="${d.kind === 'flow' ? '#eff6ff' : '#ffffff'}" stroke="${color}" stroke-width="2"/>`, d.kind !== 'flow' ? `<rect x="${x}" y="${y}" width="5" height="${p.h}" rx="2" fill="${color}"/>` : '');
    const txt = n.shape === 'start' || n.shape === 'end' ? '#ffffff' : '#0f172a';
    s.lines.forEach((l, li) => o.push(`<text x="${p.cx}" y="${p.cy - ((s.lines.length - 1) * 14) / 2 + li * 14 + 4}" text-anchor="middle" font-size="11.5" font-weight="600" fill="${txt}" ${FONT}>${esc(l)}</text>`));
  });
  o.push('</g></svg>');
  return { svg: o.join(''), W, H: H + top };
}

// ------------------------------------------------------------------ downloads
const fileName = (t: string, ext: string) => `${(t || 'adviser').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'adviser'}.${ext}`;
function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function savePng(svg: string, W: number, H: number, name: string) {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('image')); img.src = url; });
  const cv = document.createElement('canvas');
  cv.width = W * 2; cv.height = H * 2;
  const ctx = cv.getContext('2d')!;
  ctx.scale(2, 2); ctx.drawImage(img, 0, 0, W, H);
  URL.revokeObjectURL(url);
  await new Promise<void>((res) => cv.toBlob((b) => { if (b) saveBlob(b, name); res(); }, 'image/png'));
}

const btn = 'inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50';

function PictureCard({ title, svg, W, H, extra }: { title: string; svg: string; W: number; H: number; extra?: ReactNode }) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="max-h-[420px] overflow-auto" dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', `<svg style="min-width:${Math.min(W, 520)}px;width:100%;height:auto;display:block" `) }} />
      <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 bg-slate-50 px-2 py-1.5">
        <button type="button" className={btn} onClick={() => void savePng(svg, W, H, fileName(title, 'png'))}><Download size={11} /> PNG</button>
        <button type="button" className={btn} onClick={() => saveBlob(new Blob([svg], { type: 'image/svg+xml' }), fileName(title, 'svg'))}><Download size={11} /> SVG</button>
        {extra}
      </div>
    </div>
  );
}

/** A mind map from the chat as Mind Maps module nodes (a tree to the right of the centre). */
function mindToSeeds(spec: MindMapSpec): { nodes: TemplateNodeSeed[]; edges: TemplateEdgeSeed[] } {
  const { placed } = layoutMind(spec);
  const idOf = new Map<Placed, string>(placed.map((p, i) => [p, i === 0 ? 'root' : `n${i}`]));
  const order = new Map<Placed, number>();
  const nodes: TemplateNodeSeed[] = placed.map((p) => {
    const sibs = placed.filter((q) => q.parent === p.parent);
    order.set(p, sibs.indexOf(p));
    const style: NodeStyle = p.depth === 0
      ? { backgroundColor: '#0f172a', borderColor: '#3b82f6', borderWidth: 2, shape: 'rounded', fontSize: 17, fontColor: '#ffffff', fontWeight: 'bold', textAlign: 'center', lineColor: '#3b82f6' }
      : p.depth === 1
        ? { backgroundColor: p.color, borderColor: p.color, borderWidth: 2, shape: 'rounded', fontSize: 14, fontColor: '#ffffff', fontWeight: 'bold', textAlign: 'left', lineColor: p.color }
        : { backgroundColor: '#ffffff', borderColor: p.color, borderWidth: 1.5, shape: 'pill', fontSize: 12, fontColor: '#1e293b', fontWeight: 'semibold', textAlign: 'left', lineColor: p.color };
    return {
      temp_id: idOf.get(p)!, parent_temp_id: p.parent ? idOf.get(p.parent)! : null, title: p.node.label,
      node_type: p.depth === 0 ? 'root' : p.depth === 1 ? 'topic' : 'subtopic',
      position_x: Math.round(p.depth * 300), position_y: Math.round((p.y - placed[0].y) * 1.6),
      width: p.depth === 0 ? 230 : p.depth === 1 ? 196 : 176, height: p.depth === 0 ? 78 : p.depth === 1 ? 60 : 46,
      sort_order: order.get(p) ?? 0, style,
    };
  });
  return { nodes, edges: [] };
}

export function MindMapView({ spec, companyId, onOpen }: { spec: MindMapSpec; companyId: string | null; onOpen: (path: string) => void }) {
  const { svg, W, H } = mindMapSvg(spec);
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [err, setErr] = useState('');
  const save = async () => {
    setState('saving'); setErr('');
    try {
      const { mindMapApi } = await import('@/lib/mindmap/api');
      const seeds = mindToSeeds(spec);
      const res = await mindMapApi.createMindMap({ companyId, title: spec.title, description: 'Made by the Adviser', nodes: seeds.nodes, edges: seeds.edges });
      setState('idle');
      onOpen(`/mind-map/editor/${res.map.id}`);
    } catch (e) {
      setState('error'); setErr(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <PictureCard title={spec.title} svg={svg} W={W} H={H} extra={<>
      <button type="button" className={`${btn} !border-indigo-200 !text-indigo-700 hover:!bg-indigo-50`} onClick={() => void save()} disabled={state === 'saving'}>
        {state === 'saving' ? <Loader2 size={11} className="animate-spin" /> : <Network size={11} />} Save to Mind Maps &amp; open <ExternalLink size={10} />
      </button>
      {state === 'error' && <span className="text-[10px] font-semibold text-red-600">Could not save: {err}</span>}
    </>} />
  );
}

export function DiagramView({ spec }: { spec: DiagramSpec }) {
  const { svg, W, H } = diagramSvg(spec);
  return <PictureCard title={spec.title} svg={svg} W={W} H={H} />;
}

export function TableView({ spec }: { spec: TableSpec }) {
  const csv = () => {
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [spec.columns, ...spec.rows].map((r) => r.map(cell).join(','));
    saveBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), fileName(spec.title, 'csv'));
  };
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <p className="border-b border-slate-100 px-2.5 py-1.5 text-[12px] font-bold text-slate-800">{spec.title}</p>
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full text-[11.5px]">
          {spec.columns.length > 0 && (
            <thead className="sticky top-0 bg-slate-800 text-white"><tr>{spec.columns.map((c, i) => <th key={i} className="whitespace-nowrap px-2 py-1 text-left font-semibold">{c}</th>)}</tr></thead>
          )}
          <tbody>
            {spec.rows.map((r, i) => (
              <tr key={i} className={i % 2 ? 'bg-slate-50' : ''}>{r.map((c, k) => <td key={k} className="border-t border-slate-100 px-2 py-1 text-slate-700">{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1.5 border-t border-slate-100 bg-slate-50 px-2 py-1.5">
        <button type="button" className={btn} onClick={csv}><Download size={11} /> Excel (CSV)</button>
        <span className="text-[10px] text-slate-400">{spec.rows.length} rows</span>
      </div>
    </div>
  );
}
