// Files and pictures made by the Adviser. The AI adds blocks at the END of its answer:
//   [[FILE {"type":"docx|xlsx|pdf|csv|txt|md|html","title":"...","content":"# Heading\n\nText, - bullets, | tables |","sheets":[{"name":"Sheet1","columns":["A"],"rows":[["1"]]}]}]]
//   [[IMAGE {"prompt":"what the picture shows","size":"1024x1024|1536x1024|1024x1536"}]]
// Word and Excel files are real .docx / .xlsx files (built here, no extra library); PDF uses the report maker.

/* eslint-disable @typescript-eslint/no-explicit-any -- the AI's JSON is read loosely and checked field by field */
import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, FileText, ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { saveReportPdf } from './charts';
import { serverImage } from './serverAi';

export interface Sheet { name: string; columns: string[]; rows: string[][] }
export interface FileSpec { type: 'docx' | 'xlsx' | 'pdf' | 'csv' | 'txt' | 'md' | 'html'; title: string; content: string; sheets: Sheet[] }
export interface ImageSpec { prompt: string; size: string }

const TYPES = ['docx', 'xlsx', 'pdf', 'csv', 'txt', 'md', 'html'] as const;
const ALIAS: Record<string, FileSpec['type']> = { word: 'docx', doc: 'docx', excel: 'xlsx', xls: 'xlsx', sheet: 'xlsx', spreadsheet: 'xlsx', text: 'txt', markdown: 'md', web: 'html' };

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

export function parseFiles(text: string): { files: FileSpec[]; images: ImageSpec[] } {
  const files: FileSpec[] = [];
  const images: ImageSpec[] = [];
  const re = /\[\[\s*(FILE|IMAGE)\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = text.indexOf('{', m.index + m[0].length - 1);
    if (start < 0) break;
    const end = matchBrace(text, start);
    if (end < 0) break;   // still streaming
    re.lastIndex = end + 1;
    try {
      const j = JSON.parse(text.slice(start, end + 1));
      if (m[1] === 'IMAGE') {
        const prompt = String(j.prompt || j.description || '').trim();
        if (prompt) images.push({ prompt, size: ['1024x1024', '1536x1024', '1024x1536'].includes(j.size) ? j.size : '1024x1024' });
        continue;
      }
      const raw = String(j.type || 'docx').toLowerCase().replace(/^\./, '');
      const type = (TYPES as readonly string[]).includes(raw) ? raw as FileSpec['type'] : ALIAS[raw] ?? 'docx';
      const sheets: Sheet[] = (Array.isArray(j.sheets) ? j.sheets : []).slice(0, 12).map((s: any, i: number) => ({
        name: String(s?.name || `Sheet${i + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Sheet${i + 1}`,
        columns: (Array.isArray(s?.columns) ? s.columns : []).map((c: unknown) => String(c ?? '')),
        rows: (Array.isArray(s?.rows) ? s.rows : []).slice(0, 5000).map((r: unknown) => (Array.isArray(r) ? r : [r]).map((c) => (c == null ? '' : String(c)))),
      }));
      if (!sheets.length && Array.isArray(j.columns)) sheets.push({ name: 'Sheet1', columns: j.columns.map(String), rows: (Array.isArray(j.rows) ? j.rows : []).map((r: unknown[]) => (Array.isArray(r) ? r : [r]).map((c) => String(c ?? ''))) });
      files.push({ type, title: String(j.title || j.name || 'Document'), content: String(j.content ?? j.body ?? j.text ?? ''), sheets });
    } catch { /* a broken block is skipped */ }
  }
  return { files, images };
}

// ------------------------------------------------------------------ a tiny ZIP writer (stored, no compression): enough for .docx / .xlsx
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files: { name: string; data: string }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true); cen.setUint16(28, name.length, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cenSize = central.reduce((a, p) => a + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[]);
}

// eslint-disable-next-line no-control-regex -- control characters are not allowed in Office XML and are removed
const x = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

// ------------------------------------------------------------------ markdown -> simple blocks
type Block = { k: 'h'; level: number; text: string } | { k: 'p'; text: string } | { k: 'li'; text: string; ordered: boolean } | { k: 'table'; rows: string[][] };
function blocks(md: string): Block[] {
  const out: Block[] = [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trimEnd();
    if (!l.trim()) continue;
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      out.push({ k: 'table', rows });
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) { out.push({ k: 'h', level: h[1].length, text: h[2] }); continue; }
    const li = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(l);
    if (li) { out.push({ k: 'li', text: li[2], ordered: !!li[1] }); continue; }
    out.push({ k: 'p', text: l.trim() });
  }
  return out;
}
/** "**bold**" and "*italic*" pieces of a line. */
function runs(text: string): { t: string; b?: boolean; i?: boolean }[] {
  const out: { t: string; b?: boolean; i?: boolean }[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) });
    out.push(m[1] != null ? { t: m[1], b: true } : { t: m[2], i: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last) });
  return out;
}
const plain = (t: string) => t.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');

// ------------------------------------------------------------------ Word (.docx)
function docx(title: string, md: string): Blob {
  const rPr = (r: { b?: boolean; i?: boolean }, size?: number, color?: string) =>
    `<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Latha"/>${r.b ? '<w:b/>' : ''}${r.i ? '<w:i/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}${size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : ''}</w:rPr>`;
  const para = (text: string, opts: { size?: number; bold?: boolean; color?: string; spaceAfter?: number; indent?: number; prefix?: string } = {}) =>
    `<w:p><w:pPr><w:spacing w:after="${opts.spaceAfter ?? 120}"/>${opts.indent ? `<w:ind w:left="${opts.indent}" w:hanging="260"/>` : ''}</w:pPr>${opts.prefix ? `<w:r>${rPr({}, opts.size)}<w:t xml:space="preserve">${x(opts.prefix)}</w:t></w:r>` : ''}${runs(text).map((r) => `<w:r>${rPr({ b: r.b || opts.bold, i: r.i }, opts.size, opts.color)}<w:t xml:space="preserve">${x(r.t)}</w:t></w:r>`).join('')}</w:p>`;
  const body: string[] = [para(title, { size: 36, bold: true, color: '1E3A8A', spaceAfter: 240 })];
  let n = 0;
  for (const b of blocks(md)) {
    if (b.k !== 'li' || !b.ordered) n = b.k === 'li' ? n : 0;
    if (b.k === 'h') body.push(para(b.text, { size: [0, 32, 28, 24, 22][b.level], bold: true, color: '312E81', spaceAfter: 100 }));
    else if (b.k === 'p') body.push(para(b.text, { size: 22 }));
    else if (b.k === 'li') body.push(para(b.text, { size: 22, indent: 520, prefix: b.ordered ? `${++n}. ` : '•  ', spaceAfter: 60 }));
    else if (b.rows.length) {
      const cols = Math.max(...b.rows.map((r) => r.length));
      const cell = (t: string, head: boolean) => `<w:tc><w:tcPr><w:tcW w:w="${Math.floor(9000 / cols)}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="1E293B"/>' : ''}</w:tcPr>${para(t, { size: 20, bold: head, color: head ? 'FFFFFF' : undefined, spaceAfter: 0 })}</w:tc>`;
      body.push(`<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:color="CBD5E1"/>`).join('')}</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>${b.rows.map((r, ri) => `<w:tr>${Array.from({ length: cols }, (_, ci) => cell(r[ci] ?? '', ri === 0)).join('')}</w:tr>`).join('')}</w:tbl>`, para('', { spaceAfter: 60 }));
    }
  }
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1200" w:bottom="1200" w:left="1200" w:header="600" w:footer="600" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return zip([
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/document.xml', data: doc },
  ]);
}

// ------------------------------------------------------------------ Excel (.xlsx)
function colName(i: number) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function xlsx(sheets: Sheet[]): Blob {
  const list = sheets.length ? sheets : [{ name: 'Sheet1', columns: [], rows: [] }];
  const sheetXml = (s: Sheet) => {
    const all = [...(s.columns.length ? [s.columns] : []), ...s.rows];
    const widths = Array.from({ length: Math.max(1, ...all.map((r) => r.length)) }, (_, c) => Math.min(60, Math.max(8, ...all.map((r) => String(r[c] ?? '').length + 2))));
    const rowsXml = all.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      const ref = `${colName(ci)}${ri + 1}`;
      const head = ri === 0 && s.columns.length > 0;
      const num = !head && /^-?\d+(\.\d+)?$/.test(String(v).replace(/,/g, '').trim()) && String(v).trim().length < 16;
      return num ? `<c r="${ref}"><v>${String(v).replace(/,/g, '').trim()}</v></c>` : `<c r="${ref}" t="inlineStr"${head ? ' s="1"' : ''}><is><t xml:space="preserve">${x(String(v))}</t></is></c>`;
    }).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${s.columns.length ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : ''}<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rowsXml}</sheetData></worksheet>`;
  };
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/></cellXfs></styleSheet>';
  return zip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${list.map((s, i) => `<sheet name="${x(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: styles },
    ...list.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ]);
}

/** Tables written in the text (| a | b |) become sheets when an Excel file has no sheets of its own. */
function sheetsFrom(f: FileSpec): Sheet[] {
  if (f.sheets.length) return f.sheets;
  const tables = blocks(f.content).filter((b): b is Extract<Block, { k: 'table' }> => b.k === 'table' && b.rows.length > 0);
  return tables.map((t, i) => ({ name: `Sheet${i + 1}`, columns: t.rows[0], rows: t.rows.slice(1) }));
}

function html(title: string, md: string): string {
  const inline = (t: string) => runs(t).map((r) => (r.b ? `<b>${x(r.t)}</b>` : r.i ? `<i>${x(r.t)}</i>` : x(r.t))).join('');
  const parts = blocks(md).map((b) => b.k === 'h' ? `<h${b.level + 1}>${inline(b.text)}</h${b.level + 1}>` : b.k === 'p' ? `<p>${inline(b.text)}</p>` : b.k === 'li' ? `<li>${inline(b.text)}</li>` : `<table>${b.rows.map((r, i) => `<tr>${r.map((c) => (i === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join('')}</tr>`).join('')}</table>`);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${x(title)}</title><style>body{font-family:Segoe UI,Noto Sans Tamil,Arial,sans-serif;max-width:820px;margin:32px auto;padding:0 16px;color:#0f172a;line-height:1.55}h1{color:#312e81}table{border-collapse:collapse;width:100%;margin:12px 0}th{background:#1e293b;color:#fff;text-align:left}th,td{border:1px solid #cbd5e1;padding:6px 8px}</style></head><body><h1>${x(title)}</h1>${parts.join('')}</body></html>`;
}

const safeName = (t: string) => (t || 'document').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'document';
function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function downloadFile(f: FileSpec, company = '') {
  const name = safeName(f.title);
  if (f.type === 'docx') return save(docx(f.title, f.content), `${name}.docx`);
  if (f.type === 'xlsx') return save(xlsx(sheetsFrom(f)), `${name}.xlsx`);
  if (f.type === 'pdf') return saveReportPdf(f.title, blocks(f.content).map((b) => b.k === 'table' ? b.rows.map((r) => r.join('  |  ')).join('\n') : b.k === 'li' ? `• ${plain(b.text)}` : plain(b.text)).join('\n'), [], company);
  if (f.type === 'csv') {
    const sh = sheetsFrom(f)[0];
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const text = sh ? [sh.columns, ...sh.rows].filter((r) => r.length).map((r) => r.map(cell).join(',')).join('\r\n') : f.content;
    return save(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
  }
  if (f.type === 'html') return save(new Blob([html(f.title, f.content)], { type: 'text/html;charset=utf-8' }), `${name}.html`);
  return save(new Blob([f.type === 'md' ? f.content : plain(f.content)], { type: 'text/plain;charset=utf-8' }), `${name}.${f.type}`);
}

const LABEL: Record<FileSpec['type'], string> = { docx: 'Word', xlsx: 'Excel', pdf: 'PDF', csv: 'CSV', txt: 'Text', md: 'Markdown', html: 'Web page' };

export function FileCard({ file, company }: { file: FileSpec; company: string }) {
  const [busy, setBusy] = useState(false);
  const Icon = file.type === 'xlsx' || file.type === 'csv' ? FileSpreadsheet : FileText;
  const tone = file.type === 'xlsx' || file.type === 'csv' ? 'from-emerald-500 to-teal-500' : file.type === 'pdf' ? 'from-rose-500 to-orange-500' : 'from-indigo-500 to-violet-500';
  const preview = file.type === 'xlsx' && file.sheets.length
    ? `${file.sheets.length} sheet${file.sheets.length > 1 ? 's' : ''} · ${file.sheets.reduce((a, s) => a + s.rows.length, 0)} rows`
    : plain(file.content).replace(/[#|*-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110);
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${tone} text-white shadow`}><Icon size={19} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-bold text-slate-800">{file.title}</p>
        <p className="truncate text-[10.5px] text-slate-500">{LABEL[file.type]} file{preview ? ` · ${preview}` : ''}</p>
      </div>
      <button type="button" disabled={busy}
        onClick={async () => { setBusy(true); try { await downloadFile(file, company); } finally { setBusy(false); } }}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow hover:brightness-110 disabled:opacity-60">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Download {LABEL[file.type]}
      </button>
    </div>
  );
}

// pictures already made in this visit, so re-drawing the chat does not make them again
const madeImages = new Map<string, string>();

export function ImageCard({ spec, auto = true }: { spec: ImageSpec; auto?: boolean }) {
  const key = `${spec.size}|${spec.prompt}`;
  const [img, setImg] = useState(madeImages.get(key) ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(auto && !madeImages.has(key));
  // an older answer (e.g. a chat opened from History) waits for a click, so pictures are not made again by themselves
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (madeImages.has(key) && round === 0) { setBusy(false); return; }
    if (!auto && round === 0) return;
    let off = false;
    setBusy(true); setErr('');
    serverImage(spec.prompt, spec.size)
      .then((u) => { if (off) return; madeImages.set(key, u); setImg(u); })
      .catch((e) => { if (!off) setErr(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!off) setBusy(false); });
    return () => { off = true; };
  }, [key, round, auto, spec.prompt, spec.size]);
  const download = async () => {
    try {
      const blob = await (await fetch(img)).blob();
      save(blob, `${safeName(spec.prompt.slice(0, 40))}.png`);
    } catch { window.open(img, '_blank'); }
  };
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {busy ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 bg-gradient-to-br from-indigo-50 via-fuchsia-50 to-orange-50 text-[12px] font-semibold text-indigo-700">
          <Loader2 size={22} className="animate-spin" /> Making the picture… (up to a minute)
        </div>
      ) : !img && !err ? (
        <button type="button" onClick={() => setRound((n) => n + 1)}
          className="flex h-32 w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-indigo-50 via-fuchsia-50 to-orange-50 text-[12px] font-bold text-indigo-700 hover:brightness-95">
          <ImageIcon size={20} /> Make this picture
        </button>
      ) : err ? (
        <div className="flex items-start gap-2 p-3 text-[12px] font-semibold text-red-700"><ImageIcon size={16} className="mt-0.5 shrink-0" />{err}</div>
      ) : (
        <img src={img} alt={spec.prompt} className="block max-h-[420px] w-full bg-slate-50 object-contain" />
      )}
      <div className="flex items-center gap-1.5 border-t border-slate-100 bg-slate-50 px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-500" title={spec.prompt}>{spec.prompt}</span>
        {img && !busy && <button type="button" onClick={() => void download()} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100"><Download size={11} /> PNG</button>}
        {!busy && <button type="button" onClick={() => { madeImages.delete(key); setRound((n) => n + 1); }} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100"><RefreshCw size={11} /> {err ? 'Try again' : 'New one'}</button>}
      </div>
    </div>
  );
}
