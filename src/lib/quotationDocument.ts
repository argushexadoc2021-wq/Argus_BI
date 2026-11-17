import { calcLine, calcTotals, type QuoteLine, type QuoteTaxInput } from './quotationCalc';
import { exportCsv } from './reportExport';
import type { QuoteSeller } from './companyProfile';
import { calcWorkings, hasWorkings, rowCost } from './quotationWorkings';

export interface QuoteClient {
  key: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string;
}

export interface QuoteDoc {
  quoteNo: string;
  date: string; // yyyy-mm-dd
  sellerName: string;
  /** '' = main organisation profile, else the id of a sub-company. */
  sellerRef?: string;
  clients: QuoteClient[];
  lines: QuoteLine[];
  tax: QuoteTaxInput;
  terms: string;
  notes: string;
}

export interface PdfThemeColor {
  id: string;
  name: string;
  label: string;
  primaryColor: [number, number, number];
  rgb: [number, number, number];
  cardBg: [number, number, number];
  cardBorder: [number, number, number];
  headerFill: [number, number, number];
  headerText: [number, number, number];
  cardHeaderText: [number, number, number];
  altRow: [number, number, number];
  totalBg: [number, number, number];
  totalText: [number, number, number];
  hex: string;
  borderHex: string;
  bgHex: string;
  accentTextHex: string;
}

export const PDF_THEMES: Record<string, PdfThemeColor> = {
  orange: {
    id: 'orange',
    name: 'Warm Executive Orange',
    label: 'Orange',
    primaryColor: [249, 115, 22],
    rgb: [249, 115, 22],
    cardBg: [255, 247, 237],
    cardBorder: [254, 215, 170],
    headerFill: [249, 115, 22],
    headerText: [255, 255, 255],
    cardHeaderText: [194, 65, 12],
    altRow: [255, 250, 245],
    totalBg: [255, 247, 237],
    totalText: [194, 65, 12],
    hex: '#f97316',
    borderHex: '#fb923c',
    bgHex: '#fff7ed',
    accentTextHex: '#c2410c'
  },
  blue: {
    id: 'blue',
    name: 'Modern Executive Blue',
    label: 'Blue',
    primaryColor: [2, 132, 199],
    rgb: [2, 132, 199],
    cardBg: [240, 249, 255],
    cardBorder: [186, 230, 253],
    headerFill: [2, 132, 199],
    headerText: [255, 255, 255],
    cardHeaderText: [3, 105, 161],
    altRow: [248, 252, 255],
    totalBg: [240, 249, 255],
    totalText: [3, 105, 161],
    hex: '#0284c7',
    borderHex: '#38bdf8',
    bgHex: '#f0f9ff',
    accentTextHex: '#0369a1'
  },
  green: {
    id: 'green',
    name: 'Emerald Business Green',
    label: 'Green',
    primaryColor: [5, 150, 105],
    rgb: [5, 150, 105],
    cardBg: [236, 253, 245],
    cardBorder: [167, 243, 208],
    headerFill: [5, 150, 105],
    headerText: [255, 255, 255],
    cardHeaderText: [4, 120, 87],
    altRow: [245, 253, 249],
    totalBg: [236, 253, 245],
    totalText: [4, 120, 87],
    hex: '#059669',
    borderHex: '#34d399',
    bgHex: '#ecfdf5',
    accentTextHex: '#047857'
  },
  slate: {
    id: 'slate',
    name: 'Classic Charcoal Slate',
    label: 'Slate',
    primaryColor: [51, 65, 85],
    rgb: [51, 65, 85],
    cardBg: [248, 250, 252],
    cardBorder: [226, 232, 240],
    headerFill: [51, 65, 85],
    headerText: [255, 255, 255],
    cardHeaderText: [30, 41, 59],
    altRow: [241, 245, 249],
    totalBg: [248, 250, 252],
    totalText: [30, 41, 59],
    hex: '#334155',
    borderHex: '#64748b',
    bgHex: '#f8fafc',
    accentTextHex: '#1e293b'
  },
  purple: {
    id: 'purple',
    name: 'Royal Executive Purple',
    label: 'Purple',
    primaryColor: [124, 58, 237],
    rgb: [124, 58, 237],
    cardBg: [245, 243, 255],
    cardBorder: [221, 214, 254],
    headerFill: [124, 58, 237],
    headerText: [255, 255, 255],
    cardHeaderText: [109, 40, 217],
    altRow: [250, 248, 255],
    totalBg: [245, 243, 255],
    totalText: [109, 40, 217],
    hex: '#7c3aed',
    borderHex: '#a78bfa',
    bgHex: '#f5f3ff',
    accentTextHex: '#6d28d9'
  }
};

export type PdfThemeId = keyof typeof PDF_THEMES;
export const TEMPLATE_COLORS: PdfThemeColor[] = Object.values(PDF_THEMES);

export interface PdfTemplateDefinition {
  id: string;
  name: string;
  layoutType: string;
  tagline: string;
}

export const PDF_TEMPLATES: PdfTemplateDefinition[] = [
  {
    id: 'template-1',
    name: 'Template 1',
    layoutType: 'template-1',
    tagline: 'Dual-card quotation layout with authorized signature block and clean terms.'
  },
  {
    id: 'template-2',
    name: 'Template 2',
    layoutType: 'template-2',
    tagline: 'Dual-card quotation layout with electronic generation disclaimer notice.'
  },
  {
    id: 'template-3',
    name: 'Template 3',
    layoutType: 'template-3',
    tagline: 'Centered header, split bank details, and authorized signature with appreciation note.'
  },
  {
    id: 'template-4',
    name: 'Template 4',
    layoutType: 'template-4',
    tagline: 'Centered header, split bank details, and electronic generation disclaimer notice.'
  },
  {
    id: 'template-5',
    name: 'Template 5',
    layoutType: 'template-5',
    tagline: 'Classic quotation with logo header, bill-to section, bank details with UPI QR, and authorized signature.'
  },
  {
    id: 'template-6',
    name: 'Template 6',
    layoutType: 'template-6',
    tagline: 'Classic quotation with logo header, bill-to section, bank details with UPI QR, and electronic disclaimer.'
  },
  {
    id: 'template-7',
    name: 'Template 7',
    layoutType: 'template-7',
    tagline: 'Industrial quote layout with right-aligned logo & bold quote title, and customer signature line.'
  },
  {
    id: 'template-8',
    name: 'Template 8',
    layoutType: 'template-8',
    tagline: 'Industrial quote layout with right-aligned logo & bold quote title, and electronic generation notice.'
  },
  {
    id: 'template-9',
    name: 'Template 9',
    layoutType: 'template-9',
    tagline: 'Modern invoice-style quote with dual summary cards, bank QR block, and authorized signature.'
  },
  {
    id: 'template-10',
    name: 'Template 10',
    layoutType: 'template-10',
    tagline: 'Modern invoice-style quote with dual summary cards, bank QR block, and electronic generation notice.'
  }
];

export type PdfTemplateId = string;

// jsPDF's built-in fonts have no rupee glyph.
const inr = (n: number) => 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (iso: string) => (iso ? iso.split('-').reverse().join('-') : '');

// Indian Number to words conversion
export function numberToWordsINR(amount: number): string {
  if (isNaN(amount) || amount <= 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertGroup(num: number): string {
    let str = '';
    if (num >= 100) {
      str += a[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      str += b[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + a[num % 10] : '') + ' ';
    } else if (num > 0) {
      str += a[num] + ' ';
    }
    return str.trim();
  }

  const intPart = Math.floor(amount);
  const crore = Math.floor(intPart / 10000000);
  let remainder = intPart % 10000000;
  const lakh = Math.floor(remainder / 100000);
  remainder %= 100000;
  const thousand = Math.floor(remainder / 1000);
  const hundreds = remainder % 1000;

  let result = '';
  if (crore > 0) result += convertGroup(crore) + ' Crore ';
  if (lakh > 0) result += convertGroup(lakh) + ' Lakh ';
  if (thousand > 0) result += convertGroup(thousand) + ' Thousand ';
  if (hundreds > 0) result += convertGroup(hundreds) + ' ';

  return result.trim() + ' Rupees Only';
}

// Helper: Parse and normalize Terms and Conditions text into discrete, clean items
export function parseQuoteTermsList(termsText: string): { num: string; text: string }[] {
  if (!termsText || typeof termsText !== 'string') return [];
  let t = termsText.replace(/(\d+)[\.\)]([A-Za-z])/g, '$1. $2');
  t = t.replace(/([.;]\s+)(\d+)[\.\)]\s+/g, '$1\n$2. ');

  const rawLines = t.split('\n').map(l => l.trim()).filter(Boolean);
  const items: { num: string; text: string }[] = [];

  rawLines.forEach((line) => {
    const markerMatch = line.match(/^(\d+[\.\)]|\u2022|\-|\*)\s*(.*)/);
    if (markerMatch) {
      items.push({
        num: `${items.length + 1}.`,
        text: markerMatch[2].trim(),
      });
    } else {
      if (items.length > 0) {
        items[items.length - 1].text += ' ' + line.trim();
      } else {
        items.push({
          num: `${items.length + 1}.`,
          text: line.trim(),
        });
      }
    }
  });
  return items;
}

export async function buildQuotePdf(
  doc: QuoteDoc,
  withWorkings: boolean,
  themeId: PdfThemeId | string = 'orange',
  seller?: QuoteSeller,
  templateId: string = 'template-1'
) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
  const themeObj: PdfThemeColor = PDF_THEMES[themeId] || PDF_THEMES.orange;
  const theme = themeObj.rgb;
  const W = pdf.internal.pageSize.getWidth();
  const t = calcTotals(doc.lines, doc.tax);

  const selectedThemeId = templateId || 'template-1';
  const isTemplate3or4 = (selectedThemeId === 'template-3' || selectedThemeId === 'template-4');
  const isTemplate5or6 = (selectedThemeId === 'template-5' || selectedThemeId === 'template-6');
  const isTemplate7or8 = (selectedThemeId === 'template-7' || selectedThemeId === 'template-8');
  const isTemplate9or10 = (selectedThemeId === 'template-9' || selectedThemeId === 'template-10');

  const isElectronicNotice = (
    selectedThemeId === 'template-2' ||
    selectedThemeId === 'template-4' ||
    selectedThemeId === 'template-6' ||
    selectedThemeId === 'template-8' ||
    selectedThemeId === 'template-10'
  );

  const sellerName = (seller?.name || doc.sellerName).replace(/(^|[\s.&(-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());

  const addImage = (data: string, x: number, yy: number, maxW: number, maxH: number, align: 'left' | 'right' | 'center' = 'left') => {
    try {
      const props = pdf.getImageProperties(data);
      const k = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * k, h = props.height * k;
      pdf.addImage(data, props.fileType, align === 'right' ? x - w : align === 'center' ? x - w / 2 : x, align === 'center' ? yy - h / 2 : yy, w, h);
      return { w, h };
    } catch { return null; }
  };

  // Header Rendering based on template layout
  let y = 30;
  let sellerEnd = 0;

  if (isTemplate9or10) {
    // TEMPLATE 9 & 10: Modern Invoice Style
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(...theme);
    pdf.text('Quotation', W / 2, 16, { align: 'center' });

    let curLogoY = 22;
    if (seller?.logo) {
      addImage(seller.logo, 14, curLogoY, 20, 12, 'left');
    }
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text(sellerName.toUpperCase(), seller?.logo ? 38 : 14, curLogoY + 8);

    // Dual cards: Quotation by (left) | Quotation to (right)
    const cardY = 38;
    const cardW = 88;
    const cardH = 26;

    // Left card
    pdf.setFillColor(...themeObj.cardBg);
    pdf.setDrawColor(...themeObj.cardBorder);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(14, cardY, cardW, cardH, 2, 2, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...themeObj.cardHeaderText);
    pdf.text('Quotation by', 17, cardY + 5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(sellerName, 17, cardY + 9.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    if (seller?.address) pdf.text(seller.address, 17, cardY + 14, { maxWidth: cardW - 6 });
    if (seller?.gstin) pdf.text(`GSTIN: ${seller.gstin}`, 17, cardY + 18.5);

    // Right card
    const c = doc.clients[0];
    pdf.roundedRect(W - 14 - cardW, cardY, cardW, cardH, 2, 2, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...themeObj.cardHeaderText);
    pdf.text('Quotation to', W - 14 - cardW + 3, cardY + 5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(c?.name || 'Valued Client', W - 14 - cardW + 3, cardY + 9.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    if (c?.address) pdf.text(c.address, W - 14 - cardW + 3, cardY + 14, { maxWidth: cardW - 6 });
    if (c?.gstin) pdf.text(`GSTIN: ${c.gstin}`, W - 14 - cardW + 3, cardY + 18.5);

    // Sub-bar with Quotation # and Date
    const barY = cardY + cardH + 3;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(14, barY, W - 14, barY);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Quotation #: ${doc.quoteNo}`, 14, barY + 4.5);
    pdf.text(`Quotation Date: ${dmy(doc.date)}`, W - 14, barY + 4.5, { align: 'right' });
    pdf.line(14, barY + 6.5, W - 14, barY + 6.5);

    y = barY + 9;
  } else if (isTemplate7or8) {
    // TEMPLATE 7 & 8: Industrial Machine Shop Quote
    let curLeftY = 14;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(30, 41, 59);
    pdf.text(sellerName.toUpperCase(), 14, curLeftY);
    curLeftY += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    if (seller?.address) {
      const addrLines = pdf.splitTextToSize(seller.address, 95) as string[];
      pdf.text(addrLines, 14, curLeftY);
      curLeftY += addrLines.length * 3.5;
    }
    if (seller?.gstin) {
      pdf.text(`GSTIN: ${seller.gstin}`, 14, curLeftY);
      curLeftY += 4;
    }
    if (seller?.phones?.length) {
      pdf.text(`Ph: ${seller.phones.join(', ')}`, 14, curLeftY);
      curLeftY += 4;
    }

    // Right side: QUOTE Title & Info
    let curRightY = 14;
    if (seller?.logo) {
      addImage(seller.logo, W - 14, curRightY, 28, 14, 'right');
      curRightY += 16;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(...theme);
    pdf.text('QUOTE', W - 14, curRightY + 6, { align: 'right' });
    curRightY += 12;

    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Quote #: ${doc.quoteNo}`, W - 14, curRightY, { align: 'right' });
    curRightY += 4;
    pdf.text(`Quote date: ${dmy(doc.date)}`, W - 14, curRightY, { align: 'right' });
    curRightY += 5;

    // Bill To
    y = Math.max(curLeftY, curRightY) + 3;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...themeObj.cardHeaderText);
    pdf.text('Bill To', 14, y);
    y += 4.5;

    const c = doc.clients[0];
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text((c?.name || 'Valued Client').toUpperCase(), 14, y);
    y += 4.2;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    if (c?.address) {
      const cAddr = pdf.splitTextToSize(c.address, 100) as string[];
      pdf.text(cAddr, 14, y);
      y += cAddr.length * 3.5;
    }
    if (c?.gstin) {
      pdf.text(`GSTIN: ${c.gstin}`, 14, y);
      y += 4;
    }
    y += 2;
  } else if (isTemplate3or4) {
    // TEMPLATE 3 & 4: Centered Header, Split Bank Details
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(...theme);
    pdf.text('QUOTATION', W / 2, 14, { align: 'center' });

    pdf.setDrawColor(...theme);
    pdf.setLineWidth(0.4);
    pdf.line(14, 17, W - 14, 17);

    let curHeaderY = 22;
    if (seller?.logo) {
      addImage(seller.logo, W / 2, curHeaderY + 4, 18, 10, 'center');
      curHeaderY += 13;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...theme);
    pdf.text(sellerName.toUpperCase(), W / 2, curHeaderY, { align: 'center' });
    curHeaderY += 4;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(71, 85, 105);
    if (seller?.address) {
      pdf.text(seller.address, W / 2, curHeaderY, { align: 'center' });
      curHeaderY += 3.5;
    }
    if (seller?.gstin) {
      pdf.text(`GSTIN: ${seller.gstin}`, W / 2, curHeaderY, { align: 'center' });
      curHeaderY += 4;
    }

    // Split box: Client Details (Left) + Quotation No/Date (Right)
    const boxY = curHeaderY + 2;
    const boxW = W - 28;
    const boxH = 22;
    const splitX = 14 + boxW * 0.62;

    pdf.setFillColor(...themeObj.cardBg);
    pdf.setDrawColor(...themeObj.cardBorder);
    pdf.setLineWidth(0.3);
    pdf.rect(14, boxY, boxW, boxH, 'FD');
    pdf.line(splitX, boxY, splitX, boxY + boxH);

    const c = doc.clients[0];
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.8);
    pdf.setTextColor(...themeObj.cardHeaderText);
    pdf.text('Client Details:', 17, boxY + 4.5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.2);
    pdf.setTextColor(15, 23, 42);
    pdf.text(c?.name || 'Valued Client', 17, boxY + 8.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    if (c?.address) pdf.text(c.address, 17, boxY + 12.5, { maxWidth: splitX - 20 });
    if (c?.gstin) pdf.text(`GSTIN: ${c.gstin}`, 17, boxY + 16.5);

    // Right: Quote No & Date
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Quotation No :', splitX + 4, boxY + 7);
    pdf.setFont('helvetica', 'normal');
    pdf.text(doc.quoteNo, splitX + 28, boxY + 7);

    pdf.setFont('helvetica', 'bold');
    pdf.text('Date :', splitX + 4, boxY + 14);
    pdf.setFont('helvetica', 'normal');
    pdf.text(dmy(doc.date), splitX + 28, boxY + 14);

    y = boxY + boxH + 4;
  } else if (isTemplate5or6) {
    // TEMPLATE 5 & 6: Classic with Logo Header & Bill To
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(...theme);
    pdf.text('Quotation', 14, 12);

    let curY = 16;
    if (seller?.logo) {
      addImage(seller.logo, 14, curY, 18, 12, 'left');
    }
    const compX = seller?.logo ? 36 : 14;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...theme);
    pdf.text(sellerName.toUpperCase(), compX, curY + 4);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    if (seller?.address) pdf.text(seller.address, compX, curY + 8);
    if (seller?.phones?.length) pdf.text(`Phone: ${seller.phones.join(', ')}`, compX, curY + 11.5);

    // Right info: GSTIN
    if (seller?.gstin) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text('GSTIN:', W - 14, curY + 4, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.text(seller.gstin, W - 14, curY + 8, { align: 'right' });
    }

    // Colored quotation bar
    const barY = curY + 16;
    pdf.setFillColor(...theme);
    pdf.rect(14, barY, W - 28, 7, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Quotation No: ${doc.quoteNo}`, 17, barY + 4.8);
    pdf.text(`Quotation Date: ${dmy(doc.date)}`, W - 17, barY + 4.8, { align: 'right' });

    // Bill To
    y = barY + 11;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Bill To', 14, y);
    y += 4;

    const c = doc.clients[0];
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.2);
    pdf.setTextColor(30, 41, 59);
    pdf.text(c?.name || 'Valued Client', 14, y);
    y += 3.8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    if (c?.address) {
      const cAddr = pdf.splitTextToSize(c.address, 100) as string[];
      pdf.text(cAddr, 14, y);
      y += cAddr.length * 3.2;
    }
    if (c?.gstin) {
      pdf.text(`GSTIN: ${c.gstin}`, 14, y);
      y += 3.5;
    }
    y += 2;
  } else {
    // TEMPLATE 1 & 2: Dual Card / Executive Banner (Original / Clean)
    pdf.setFillColor(...theme);
    pdf.rect(0, 0, W, 22, 'F');
    let titleX = 14;
    if (seller?.logo) {
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(10, 3, 30, 16, 1.5, 1.5, 'F');
      if (addImage(seller.logo, 25, 11, 26, 13, 'center')) titleX = 46;
    }
    pdf.setTextColor(255);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('QUOTATION', titleX, 14);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(sellerName, W - 14, 10, { align: 'right' });
    pdf.text(`No: ${doc.quoteNo}   Date: ${dmy(doc.date)}`, W - 14, 16, { align: 'right' });

    pdf.setTextColor(30);
    y = 32;
    if (seller) {
      const lines = [seller.address, seller.gstin && `GSTIN: ${seller.gstin}`, seller.phones.join(', '), seller.website].filter(Boolean) as string[];
      pdf.setFontSize(8.5);
      pdf.setTextColor(90);
      let sy = 29;
      for (const l of lines) {
        const w = pdf.splitTextToSize(l, 80) as string[];
        pdf.text(w, W - 14, sy, { align: 'right' });
        sy += 4 * w.length;
      }
      sellerEnd = sy;
      pdf.setFontSize(10);
      pdf.setTextColor(30);
    }
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('To:', 14, y);
    y += 5;
    pdf.setFont('helvetica', 'normal');
    for (const c of doc.clients) {
      const lines = [c.name, c.address, [c.phone, c.email].filter(Boolean).join('  |  '), c.gstin && `GSTIN: ${c.gstin}`].filter(Boolean) as string[];
      for (const l of lines) {
        const w = pdf.splitTextToSize(l, seller ? W - 28 - 84 : W - 28) as string[];
        pdf.text(w, 14, y);
        y += 4.6 * w.length;
      }
      y += 2;
    }
  }

  // Dynamic Discount Omission: check if any item has a positive discount
  const hasAnyDiscount = doc.lines.some(l => {
    const d = Number((l.discount || '').replace(/,/g, ''));
    return !Number.isNaN(d) && d > 0;
  });

  let head: string[][];
  let rows: string[][];
  let columnStyles: Record<number, { halign?: 'left' | 'center' | 'right'; cellWidth?: number }>;

  if (hasAnyDiscount) {
    head = [['SL.NO', 'HSN/SAC CODE', 'DESCRIPTION', 'QTY', 'UNIT', 'UNIT PRICE', 'DISCOUNT %', 'DISC. PRICE', 'AMOUNT']];
    columnStyles = {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'left', cellWidth: 43 },
      3: { halign: 'center', cellWidth: 11 },
      4: { halign: 'center', cellWidth: 11 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'right', cellWidth: 24 },
      8: { halign: 'right', cellWidth: 25 },
    };
    rows = doc.lines.filter(l => calcLine(l).active).map((l, i) => {
      const r = calcLine(l);
      const unitP = Number((l.unitPrice || '0').replace(/,/g, '')) || 0;
      const disc = Number((l.discount || '0').replace(/,/g, '')) || 0;
      return [
        String(i + 1),
        l.hsn || '-',
        l.description || `Item ${i + 1}`,
        l.qty || '1',
        l.unit || 'Nos',
        inr(unitP),
        disc > 0 ? `${disc}%` : '0%',
        inr(r.discountedUnit),
        inr(r.amount),
      ];
    });
  } else {
    head = [['SL.NO', 'HSN/SAC CODE', 'DESCRIPTION', 'QTY', 'UNIT', 'UNIT PRICE', 'AMOUNT']];
    columnStyles = {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'left', cellWidth: 66 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'right', cellWidth: 30 },
    };
    rows = doc.lines.filter(l => calcLine(l).active).map((l, i) => {
      const r = calcLine(l);
      const unitP = Number((l.unitPrice || '0').replace(/,/g, '')) || 0;
      return [
        String(i + 1),
        l.hsn || '-',
        l.description || `Item ${i + 1}`,
        l.qty || '1',
        l.unit || 'Nos',
        inr(unitP),
        inr(r.amount),
      ];
    });
  }

  autoTable(pdf, {
    startY: Math.max(y, sellerEnd) + 2,
    head,
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 7.0,
      textColor: [15, 23, 42],
      cellPadding: 1.8,
      valign: 'middle',
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: theme,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'center',
      valign: 'middle',
      cellPadding: { top: 2.0, bottom: 2.0, left: 1.0, right: 1.0 },
    },
    alternateRowStyles: {
      fillColor: themeObj.altRow || [248, 250, 252],
    },
    columnStyles,
  });

  const totalsRows: string[][] = [['Total before tax', inr(t.subtotal)]];
  if (t.cgst) totalsRows.push([`CGST @ ${doc.tax.cgst}%`, inr(t.cgst)]);
  if (t.sgst) totalsRows.push([`SGST @ ${doc.tax.sgst}%`, inr(t.sgst)]);
  if (t.igst) totalsRows.push([`IGST @ ${doc.tax.igst}%`, inr(t.igst)]);
  if (t.roundOff) totalsRows.push(['Round off', `${t.roundOff > 0 ? '+' : '-'}${inr(Math.abs(t.roundOff))}`]);
  totalsRows.push(['TOTAL AMOUNT', inr(t.total)]);

  autoTable(pdf, {
    // @ts-expect-error lastAutoTable is added by the plugin
    startY: pdf.lastAutoTable.finalY + 4,
    body: totalsRows,
    theme: 'plain',
    styles: { fontSize: 8.5 },
    margin: { left: W - 100 },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: d => {
      if (d.row.index === totalsRows.length - 1) {
        d.cell.styles.fontStyle = 'bold';
        d.cell.styles.fillColor = themeObj.cardBg || [241, 245, 249];
        d.cell.styles.textColor = themeObj.totalText || [15, 23, 42];
      }
    },
  });

  // Words breakdown
  // @ts-expect-error lastAutoTable is added by the plugin
  let yy = pdf.lastAutoTable.finalY + 4;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(71, 85, 105);
  pdf.text(`Amount in words: ${numberToWordsINR(t.total)}`, 14, yy);
  yy += 5;

  const block = (title: string, body: string) => {
    if (!body.trim()) return;
    const wrapped = pdf.splitTextToSize(body, W - 28) as string[];
    if (yy + 6 + wrapped.length * 4.4 > 285) { pdf.addPage(); yy = 16; }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text(title, 14, yy); yy += 4.5;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.text(wrapped, 14, yy); yy += wrapped.length * 3.8 + 4;
  };

  if (withWorkings) {
    for (const l of doc.lines.filter(x => calcLine(x).active && hasWorkings(x.workings))) {
      const w = l.workings!; const r = calcWorkings(w);
      const rowsList: string[][] = [];
      for (const [label, list] of [['Material', w.materials], ['Process', w.processes], ['Other', w.others]] as const) {
        for (const x of list) { const c = rowCost(x); if (!Number.isNaN(c) && c > 0) rowsList.push([label, x.description || '-', `${x.qty} x ${x.rate}`, inr(c)]); }
      }
      rowsList.push(['', 'Profit margin', `${w.marginPct || 0}%`, inr(r.profit)], ['', 'Cost of one unit', '', inr(r.total)]);
      // @ts-expect-error lastAutoTable is added by the plugin
      const startY = (yy > pdf.lastAutoTable.finalY ? yy : pdf.lastAutoTable.finalY) + 4;
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); pdf.setTextColor(30);
      if (startY > 265) { pdf.addPage(); yy = 16; } else yy = startY;
      pdf.text(`Workings: ${l.description}`, 14, yy);
      autoTable(pdf, { startY: yy + 2, head: [['Type', 'Item', 'Qty x Rate', 'Cost']], body: rowsList, theme: 'grid', styles: { fontSize: 8, cellPadding: 1.6 }, headStyles: { fillColor: theme, textColor: 255 }, columnStyles: { 3: { halign: 'right' } } });
      // @ts-expect-error lastAutoTable is added by the plugin
      yy = pdf.lastAutoTable.finalY + 6;
    }
  }

  // Render Terms & Conditions with true hanging indent
  if (doc.terms && doc.terms.trim()) {
    const termsItems = parseQuoteTermsList(doc.terms);
    if (termsItems.length) {
      if (yy + 14 > 275) { pdf.addPage(); yy = 16; }
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...themeObj.cardHeaderText);
      pdf.text('Terms & Conditions', 14, yy); yy += 4.5;

      const numWidth = 5.2;
      const textX = 14 + numWidth;
      const textWidth = W - 28 - numWidth;
      const lineHeight = 2.8;
      const itemGap = 1.0;

      termsItems.forEach(item => {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.2);
        const wrapped = pdf.splitTextToSize(item.text, textWidth) as string[];
        const itemH = (wrapped.length * lineHeight) + itemGap;
        if (yy + itemH > 280) {
          pdf.addPage();
          yy = 16;
        }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.2);
        pdf.setTextColor(30);
        pdf.text(item.num, 14, yy);

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105);
        pdf.text(wrapped, textX, yy);
        yy += itemH;
      });
      yy += 2;
    }
  }

  // Render Additional Notes
  if (doc.notes && doc.notes.trim()) {
    block('Additional Notes', doc.notes);
  }

  // Bank & Payment Details
  if (seller?.bankLines?.length || seller?.qrCode) {
    const bankBody = seller?.bankLines?.length ? seller.bankLines.join('\n') : '';
    const hasQr = !!seller?.qrCode;
    const textW = hasQr ? W - 28 - 34 : W - 28;
    const wrapped = bankBody ? (pdf.splitTextToSize(bankBody, textW) as string[]) : [];
    const blockH = Math.max(wrapped.length * 3.8 + 4, hasQr ? 26 : 0);
    if (yy + 6 + blockH > 280) { pdf.addPage(); yy = 16; }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...themeObj.cardHeaderText);
    pdf.text('Bank & Payment Details', 14, yy); yy += 4;
    const startBankY = yy;
    if (wrapped.length) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(50);
      pdf.text(wrapped, 14, yy);
    }
    if (hasQr) {
      const qrW = 20;
      const qrX = W - 14 - qrW;
      addImage(seller!.qrCode!, qrX + qrW, startBankY, qrW, qrW, 'right');
      pdf.setFontSize(6.5); pdf.setTextColor(110);
      pdf.text('Scan to Pay via UPI', qrX + qrW / 2, startBankY + qrW + 2.8, { align: 'center' });
    }
    yy += blockH;
  }

  // Signoff: Authorized Signature (odd templates) vs Electronic Disclaimer (even templates)
  if (isElectronicNotice) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7.2);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      'This quotation was generated electronically through Argus BI and requires no physical signature.',
      W / 2,
      284,
      { align: 'center', maxWidth: W - 28 }
    );
  } else if (seller) {
    const need = seller.signature ? 30 : 16;
    if (yy + need > 280) { pdf.addPage(); yy = 16; }
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(60);
    pdf.text(`For ${sellerName}`, W - 14, yy, { align: 'right' });
    if (seller.signature) addImage(seller.signature, W - 14, yy + 2, 40, 16, 'right');
    pdf.setFontSize(7.5); pdf.setTextColor(90);
    pdf.text('Authorized Signature', W - 14, yy + (seller.signature ? 22 : 8), { align: 'right' });
  }

  // Footer on every page
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(140);
    pdf.text('All rights powered by Argus TM', W / 2, 292, { align: 'center' });
  }

  return pdf;
}

export async function downloadQuotePdf(
  doc: QuoteDoc,
  withWorkings: boolean,
  themeId: PdfThemeId | string = 'orange',
  seller?: QuoteSeller,
  templateId: string = 'template-1'
) {
  (await buildQuotePdf(doc, withWorkings, themeId, seller, templateId)).save(
    `${doc.quoteNo.replace(/[^\w-]+/g, '_')}${withWorkings ? '_workings' : ''}.pdf`
  );
}

export function exportQuoteCsv(doc: QuoteDoc) {
  const t = calcTotals(doc.lines, doc.tax);
  const rows: unknown[][] = [
    ['Quotation', doc.quoteNo], ['Date', dmy(doc.date)], ['Clients', doc.clients.map(c => c.name).join('; ')], [],
    ['Sl', 'HSN/SAC', 'Description', 'Qty', 'Unit', 'Unit Price', 'Discount %', 'Discounted Unit Price', 'Amount'],
  ];
  doc.lines.filter(l => calcLine(l).active).forEach((l, i) => {
    const r = calcLine(l);
    rows.push([i + 1, l.hsn, l.description, l.qty, l.unit, l.unitPrice, l.discount || 0, r.discountedUnit, r.amount]);
  });
  rows.push([], ['', '', '', '', '', '', '', 'Total before tax', t.subtotal]);
  if (t.cgst) rows.push(['', '', '', '', '', '', '', `CGST ${doc.tax.cgst}%`, t.cgst]);
  if (t.sgst) rows.push(['', '', '', '', '', '', '', `SGST ${doc.tax.sgst}%`, t.sgst]);
  if (t.igst) rows.push(['', '', '', '', '', '', '', `IGST ${doc.tax.igst}%`, t.igst]);
  rows.push(['', '', '', '', '', '', '', 'Round off', t.roundOff], ['', '', '', '', '', '', '', 'TOTAL', t.total]);
  exportCsv(doc.quoteNo.replace(/[^\w-]+/g, '_'), rows);
}

/** Plain-text summary used for WhatsApp and e-mail bodies. */
export function quoteSummaryText(doc: QuoteDoc): string {
  const t = calcTotals(doc.lines, doc.tax);
  const items = doc.lines.filter(l => calcLine(l).active).map((l, i) => `${i + 1}. ${l.description || 'Item'} - ${l.qty} ${l.unit} x ${inr(calcLine(l).discountedUnit)} = ${inr(calcLine(l).amount)}`);
  return [`Quotation ${doc.quoteNo} (${dmy(doc.date)}) from ${doc.sellerName}`, '', ...items, '', `Total before tax: ${inr(t.subtotal)}`, `Total amount: ${inr(t.total)}`].join('\n');
}
