import { jsPDF } from 'jspdf';
import type { CanvasSettings, MindMapEdge, MindMapNode } from './types';

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if ((cur + ' ' + w).length <= maxChars) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

/** Computes a clean connector path between two nodes */
export function buildConnectorPath(
  from: MindMapNode,
  to: MindMapNode,
  style: CanvasSettings['connectorStyle'] = 'curved',
): string {
  const fx = from.position_x;
  const fy = from.position_y;
  const tx = to.position_x;
  const ty = to.position_y;

  const dx = tx - fx;
  const sx = dx >= 0 ? fx + from.width / 2 : fx - from.width / 2;
  const ex = dx >= 0 ? tx - to.width / 2 : tx + to.width / 2;

  if (style === 'straight') {
    return `M ${sx} ${fy} L ${ex} ${ty}`;
  }
  if (style === 'elbow') {
    const midX = (sx + ex) / 2;
    return `M ${sx} ${fy} L ${midX} ${fy} L ${midX} ${ty} L ${ex} ${ty}`;
  }
  const cx = (sx + ex) / 2;
  return `M ${sx} ${fy} C ${cx} ${fy}, ${cx} ${ty}, ${ex} ${ty}`;
}

/** Collects visible nodes (excluding descendants of collapsed nodes) */
export function getVisibleNodes(nodes: MindMapNode[]): MindMapNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.filter((n) => {
    let cur = n.parent_node_id ? byId.get(n.parent_node_id) : undefined;
    let guard = 0;
    while (cur && guard++ < 150) {
      if (cur.is_collapsed) return false;
      cur = cur.parent_node_id ? byId.get(cur.parent_node_id) : undefined;
    }
    return true;
  });
}

/** Builds a clean standalone vector SVG of the entire mind map */
export function buildMindMapSvg(
  nodes: MindMapNode[],
  edges: MindMapEdge[],
  settings: CanvasSettings,
): { svg: string; width: number; height: number } {
  const visible = getVisibleNodes(nodes);
  const byId = new Map(visible.map((n) => [n.id, n]));

  const pad = 72;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const n of visible) {
    minX = Math.min(minX, n.position_x - n.width / 2);
    maxX = Math.max(maxX, n.position_x + n.width / 2);
    minY = Math.min(minY, n.position_y - n.height / 2);
    maxY = Math.max(maxY, n.position_y + n.height / 2);
  }
  if (!Number.isFinite(minX)) {
    minX = -200;
    maxX = 200;
    minY = -120;
    maxY = 120;
  }

  const width = Math.max(480, Math.round(maxX - minX + pad * 2));
  const height = Math.max(320, Math.round(maxY - minY + pad * 2));
  const ox = -minX + pad;
  const oy = -minY + pad;

  const font = `font-family="'Segoe UI', Inter, Arial, sans-serif"`;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs>`,
    `<marker id="mm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">`,
    `<path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />`,
    `</marker>`,
    `</defs>`,
    `<rect width="${width}" height="${height}" fill="${escXml(settings.background || '#f8fbff')}" />`,
    `<g transform="translate(${ox}, ${oy})">`,
  ];

  // 1. Hierarchical parent -> child connectors
  for (const n of visible) {
    if (!n.parent_node_id) continue;
    const parent = byId.get(n.parent_node_id);
    if (!parent) continue;
    const d = buildConnectorPath(parent, n, settings.connectorStyle);
    const stroke = n.style.lineColor || n.style.borderColor || '#3b82f6';
    const thick = !parent.parent_node_id ? 2.8 : 2;
    parts.push(
      `<path d="${d}" fill="none" stroke="${escXml(stroke)}" stroke-width="${thick}" stroke-opacity="0.72" stroke-linecap="round" />`,
    );
  }

  // 2. Custom non-hierarchical edges
  for (const e of edges) {
    const src = byId.get(e.source_node_id);
    const tgt = byId.get(e.target_node_id);
    if (!src || !tgt) continue;
    const midX = (src.position_x + tgt.position_x) / 2;
    const midY = (src.position_y + tgt.position_y) / 2 - 42;
    const d = `M ${src.position_x} ${src.position_y} Q ${midX} ${midY}, ${tgt.position_x} ${tgt.position_y}`;
    const stroke = e.style?.strokeColor || '#6366f1';
    const sw = e.style?.strokeWidth || 2;
    const dash = e.style?.dashed !== false ? ' stroke-dasharray="6 4"' : '';
    const marker = e.style?.arrow !== false ? ' marker-end="url(#mm-arrow)"' : '';
    parts.push(
      `<path d="${d}" fill="none" stroke="${escXml(stroke)}" stroke-width="${sw}"${dash}${marker} stroke-linecap="round" />`,
    );
    if (e.label) {
      parts.push(
        `<rect x="${midX - 44}" y="${midY - 11}" width="88" height="20" rx="8" fill="#ffffff" stroke="${escXml(stroke)}" stroke-width="1" />`,
        `<text x="${midX}" y="${midY + 3}" text-anchor="middle" font-size="10" font-weight="600" fill="#334155" ${font}>${escXml(e.label)}</text>`,
      );
    }
  }

  // 3. Nodes
  for (const n of visible) {
    const x = n.position_x - n.width / 2;
    const y = n.position_y - n.height / 2;
    const w = n.width;
    const h = n.height;
    const shape = n.style.shape || 'rounded';
    const bg = n.style.backgroundColor || (n.parent_node_id ? '#ffffff' : '#0f172a');
    const border = n.style.borderColor || '#3b82f6';
    const bw = n.style.borderWidth ?? 2;
    const fg = n.style.fontColor || (n.parent_node_id ? '#0f172a' : '#ffffff');
    const fs = n.style.fontSize || (n.parent_node_id ? 13 : 16);
    const fw = n.style.fontWeight === 'normal' ? '400' : n.style.fontWeight === 'semibold' ? '600' : '700';
    const fst = n.style.fontStyle === 'italic' ? 'italic' : 'normal';

    if (shape === 'ellipse') {
      parts.push(
        `<ellipse cx="${n.position_x}" cy="${n.position_y}" rx="${w / 2}" ry="${h / 2}" fill="${escXml(bg)}" stroke="${escXml(border)}" stroke-width="${bw}" />`,
      );
    } else if (shape === 'diamond') {
      const pts = `${n.position_x},${y} ${x + w},${n.position_y} ${n.position_x},${y + h} ${x},${n.position_y}`;
      parts.push(
        `<polygon points="${pts}" fill="${escXml(bg)}" stroke="${escXml(border)}" stroke-width="${bw}" stroke-linejoin="round" />`,
      );
    } else if (shape === 'underline') {
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${escXml(bg)}" fill-opacity="0.7" />`,
        `<line x1="${x + 6}" y1="${y + h - 2}" x2="${x + w - 6}" y2="${y + h - 2}" stroke="${escXml(border)}" stroke-width="${Math.max(2.5, bw)}" stroke-linecap="round" />`,
      );
    } else {
      const rx = shape === 'pill' ? h / 2 : shape === 'rectangle' ? 4 : 14;
      parts.push(
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${escXml(bg)}" stroke="${escXml(border)}" stroke-width="${bw}" />`,
      );
    }

    const maxChars = Math.max(10, Math.floor((w - 22) / (fs * 0.56)));
    const lines = wrapLines(n.title || 'Topic', maxChars);
    const lh = fs * 1.28;
    const totalH = lines.length * lh + (n.description ? 14 : 0);
    let ty = n.position_y - totalH / 2 + fs * 0.92;

    for (const line of lines) {
      parts.push(
        `<text x="${n.position_x}" y="${ty}" text-anchor="middle" font-size="${fs}" font-weight="${fw}" font-style="${fst}" fill="${escXml(fg)}" ${font}>${escXml(line)}</text>`,
      );
      ty += lh;
    }
    if (n.description) {
      const desc = n.description.length > maxChars + 6 ? `${n.description.slice(0, maxChars + 5)}…` : n.description;
      parts.push(
        `<text x="${n.position_x}" y="${ty + 2}" text-anchor="middle" font-size="10" fill="${escXml(fg)}" fill-opacity="0.72" ${font}>${escXml(desc)}</text>`,
      );
    }
  }

  parts.push(`</g></svg>`);
  return { svg: parts.join(''), width, height };
}

function safeFileName(title: string, ext: string): string {
  const base = (title || 'mind-map')
    .replace(/[^\w\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return `${base || 'mind_map'}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function svgToDataUrl(svg: string, width: number, height: number, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(4800, Math.round(width * scale));
      canvas.height = Math.min(4800, Math.round(height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png', 1));
    };
    img.onerror = () => reject(new Error('Could not render SVG for export'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export function exportMindMapSvg(
  title: string,
  nodes: MindMapNode[],
  edges: MindMapEdge[],
  settings: CanvasSettings,
): void {
  const { svg } = buildMindMapSvg(nodes, edges, settings);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, safeFileName(title, 'svg'));
}

export async function exportMindMapPng(
  title: string,
  nodes: MindMapNode[],
  edges: MindMapEdge[],
  settings: CanvasSettings,
): Promise<void> {
  const { svg, width, height } = buildMindMapSvg(nodes, edges, settings);
  const pngUrl = await svgToDataUrl(svg, width, height, 2);
  const res = await fetch(pngUrl);
  const blob = await res.blob();
  triggerDownload(blob, safeFileName(title, 'png'));
}

export async function exportMindMapPdf(
  title: string,
  description: string | null,
  nodes: MindMapNode[],
  edges: MindMapEdge[],
  settings: CanvasSettings,
): Promise<void> {
  const { svg, width, height } = buildMindMapSvg(nodes, edges, settings);
  const pngUrl = await svgToDataUrl(svg, width, height, 2);
  const landscape = width >= height;
  const doc = new jsPDF({
    orientation: landscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Header band matching Argus BI styling
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text((title || 'Mind Map').replace(/[^\x20-\x7E]/g, '').trim() || 'Mind Map', margin, 9.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const sub = [
    description ? description.replace(/[^\x20-\x7E]/g, '').trim().slice(0, 90) : '',
    `Exported ${new Date().toLocaleString('en-IN')}`,
  ]
    .filter(Boolean)
    .join('  •  ');
  doc.text(sub, margin, 15.5);

  const availW = pageW - margin * 2;
  const availH = pageH - 26 - margin;
  const ratio = Math.min(availW / width, availH / height);
  const drawW = width * ratio;
  const drawH = height * ratio;
  const dx = margin + (availW - drawW) / 2;
  const dy = 24 + (availH - drawH) / 2;

  doc.addImage(pngUrl, 'PNG', dx, dy, drawW, drawH);
  doc.save(safeFileName(title, 'pdf'));
}
