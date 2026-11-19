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
  rgb: [number, number, number];
}

export type PdfThemeId = 'orange' | 'blue' | 'green' | 'slate' | 'purple';

export const PDF_THEMES: Record<string, PdfThemeColor> = {
  orange: {
    id: 'orange',
    name: 'Warm Executive Orange',
    label: 'Orange',
    primaryColor: [249, 115, 22],
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
    accentTextHex: '#c2410c',
    rgb: [249, 115, 22],
  },
  blue: {
    id: 'blue',
    name: 'Modern Executive Blue',
    label: 'Blue',
    primaryColor: [2, 132, 199],
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
    accentTextHex: '#0369a1',
    rgb: [2, 132, 199],
  },
  green: {
    id: 'green',
    name: 'Emerald Business Green',
    label: 'Green',
    primaryColor: [5, 150, 105],
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
    accentTextHex: '#047857',
    rgb: [5, 150, 105],
  },
  slate: {
    id: 'slate',
    name: 'Classic Charcoal Slate',
    label: 'Slate',
    primaryColor: [51, 65, 85],
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
    accentTextHex: '#1e293b',
    rgb: [51, 65, 85],
  },
  purple: {
    id: 'purple',
    name: 'Royal Executive Purple',
    label: 'Purple',
    primaryColor: [124, 58, 237],
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
    accentTextHex: '#6d28d9',
    rgb: [124, 58, 237],
  },
};

export const TEMPLATE_COLORS: PdfThemeColor[] = Object.values(PDF_THEMES);

export interface PdfTemplateDefinition {
  id: string;
  name: string;
  layoutType: string;
  tagline: string;
}

export const PDF_TEMPLATES: PdfTemplateDefinition[] = [
  { id: 'template-1', name: 'Template 1', layoutType: 'template-1', tagline: 'Dual-card quotation layout with authorized signature block and clean terms.' },
  { id: 'template-2', name: 'Template 2', layoutType: 'template-2', tagline: 'Dual-card quotation layout with electronic generation disclaimer notice.' },
  { id: 'template-3', name: 'Template 3', layoutType: 'template-3', tagline: 'Centered header, split bank details, and authorized signature with appreciation note.' },
  { id: 'template-4', name: 'Template 4', layoutType: 'template-4', tagline: 'Centered header, split bank details, and electronic generation disclaimer notice.' },
  { id: 'template-5', name: 'Template 5', layoutType: 'template-5', tagline: 'Classic quotation with logo header, bill-to section, bank details with UPI QR, and authorized signature.' },
  { id: 'template-6', name: 'Template 6', layoutType: 'template-6', tagline: 'Classic quotation with logo header, bill-to section, bank details with UPI QR, and electronic disclaimer.' },
  { id: 'template-7', name: 'Template 7', layoutType: 'template-7', tagline: 'Industrial quote layout with right-aligned logo & bold quote title, and customer signature line.' },
  { id: 'template-8', name: 'Template 8', layoutType: 'template-8', tagline: 'Industrial quote layout with right-aligned logo & bold quote title, and electronic generation notice.' },
  { id: 'template-9', name: 'Template 9', layoutType: 'template-9', tagline: 'Modern invoice-style quote with dual summary cards, bank QR block, and authorized signature.' },
  { id: 'template-10', name: 'Template 10', layoutType: 'template-10', tagline: 'Modern invoice-style quote with dual summary cards, bank QR block, and electronic generation notice.' },
];

export type PdfTemplateId = string;

export function formatNumber(value: number | string, decimals = 2): string {
  const num = typeof value === 'number' ? value : (parseFloat(String(value)) || 0);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const inr = (n: number) => 'Rs. ' + formatNumber(n, 2);
const dmy = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

export function formatQuoteDisplayNumber(quoteNum: string): string {
  if (!quoteNum) return '001';
  const str = String(quoteNum).trim();
  const match = str.match(/\d+$/) || str.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (!isNaN(num)) return String(num).padStart(3, '0');
  }
  return str;
}

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

export function parseQuoteTermsList(termsText: string): { num: string; text: string }[] {
  if (!termsText || !termsText.trim()) return [];
  const lines = termsText.split('\n').map(l => l.trim()).filter(Boolean);
  const result: { num: string; text: string }[] = [];

  lines.forEach((l, idx) => {
    const numMatch = l.match(/^(\d+)[.)\-]\s*(.+)$/);
    if (numMatch) {
      result.push({ num: `${numMatch[1]}.`, text: numMatch[2].trim() });
    } else {
      const bulletMatch = l.match(/^[•*\-]\s*(.+)$/);
      if (bulletMatch) {
        result.push({ num: `${idx + 1}.`, text: bulletMatch[1].trim() });
      } else {
        result.push({ num: `${idx + 1}.`, text: l });
      }
    }
  });

  return result;
}

export function renderQuoteTermsWithHangingIndent(
  doc: any,
  termsText: string,
  startX: number,
  startY: number,
  maxWidth: number,
  options: {
    fontSize?: number;
    numWidth?: number;
    lineHeight?: number;
    itemGap?: number;
    numColor?: [number, number, number];
    bodyColor?: [number, number, number];
  } = {}
): number {
  const items = parseQuoteTermsList(termsText);
  if (!items.length) return startY;

  const fontSize = options.fontSize || 6.4;
  const numWidth = options.numWidth || 5.2;
  const textX = startX + numWidth;
  const textWidth = Math.max(20, maxWidth - numWidth);
  const lineHeight = options.lineHeight || 2.9;
  const itemGap = options.itemGap !== undefined ? options.itemGap : 1.1;

  let curY = startY;

  items.forEach(item => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    if (options.numColor) {
      doc.setTextColor(options.numColor[0], options.numColor[1], options.numColor[2]);
    } else {
      doc.setTextColor(30, 41, 59);
    }
    doc.text(item.num, startX, curY);

    doc.setFont('helvetica', 'normal');
    if (options.bodyColor) {
      doc.setTextColor(options.bodyColor[0], options.bodyColor[1], options.bodyColor[2]);
    } else {
      doc.setTextColor(71, 85, 105);
    }
    const wrappedLines = doc.splitTextToSize(item.text, textWidth);
    doc.text(wrappedLines, textX, curY);

    curY += (wrappedLines.length * lineHeight) + itemGap;
  });

  return curY;
}

export interface BankDetailsObj {
  accountHolder?: string;
  bankName?: string;
  accountNumber?: string;
  branch?: string;
  ifscCode?: string;
  upiId?: string;
  qrCode?: string;
}

export function parseBankDetailsFromSeller(seller?: QuoteSeller, defaultName = 'Argus Technologies'): BankDetailsObj {
  const result: BankDetailsObj = {
    accountHolder: seller?.name || defaultName,
    bankName: 'CANARA BANK',
    accountNumber: '61381400000639',
    branch: 'PANKAJAMILLS',
    ifscCode: 'CNRB0016138',
    upiId: '',
    qrCode: seller?.qrCode || '',
  };

  if (seller?.bankLines && seller.bankLines.length > 0) {
    seller.bankLines.forEach(l => {
      const line = l.trim();
      const mBank = line.match(/^Bank\s*:\s*(.+)$/i);
      if (mBank) result.bankName = mBank[1].trim();
      const mAcc = line.match(/^(?:Account\s*(?:number|no)|A\/c\s*No)\s*:\s*(.+)$/i);
      if (mAcc) result.accountNumber = mAcc[1].trim();
      const mBranch = line.match(/^Branch\s*:\s*(.+)$/i);
      if (mBranch) result.branch = mBranch[1].trim();
      const mIfsc = line.match(/^IFSC(?:\s*code)?\s*:\s*(.+)$/i);
      if (mIfsc) result.ifscCode = mIfsc[1].trim();
      const mUpi = line.match(/^UPI(?:\s*ID)?\s*:\s*(.+)$/i);
      if (mUpi) result.upiId = mUpi[1].trim();
      const mHolder = line.match(/^Account\s*holder\s*:\s*(.+)$/i);
      if (mHolder) result.accountHolder = mHolder[1].trim();
    });
  }

  return result;
}

export function renderCompanyBankDetailsBox(
  doc: any,
  bankDetails: BankDetailsObj,
  displayCompanyName: string,
  roundedGrandTotal: number,
  startX: number,
  startY: number,
  boxWidth: number,
  colorPalette: PdfThemeColor,
  options: { rounded?: boolean; title?: string } = {}
): { bankBoxH: number } {
  const bFields = [
    { label: 'Account holder:', value: bankDetails.accountHolder || displayCompanyName },
    { label: 'Account number:', value: bankDetails.accountNumber || '' },
    { label: 'Bank:', value: bankDetails.bankName || '' },
    { label: 'Branch:', value: bankDetails.branch || '' },
    { label: 'IFSC code:', value: bankDetails.ifscCode || '' },
    { label: 'UPI ID:', value: bankDetails.upiId || '' },
  ];

  const activeBFields = bFields.filter(f => Boolean(f.value));
  const hasQr = Boolean(bankDetails.qrCode);

  const titleH = 8.5;
  const fieldsH = activeBFields.length * 3.6;
  const qrH = hasQr ? 16 : 4;
  const bankBoxH = Math.max(hasQr ? 42 : 28, titleH + fieldsH + qrH);

  const borderColor = colorPalette.cardBorder || [226, 232, 240];
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.setLineWidth(0.3);
  if (options.rounded !== false) {
    doc.roundedRect(startX, startY, boxWidth, bankBoxH, 1.5, 1.5);
  } else {
    doc.rect(startX, startY, boxWidth, bankBoxH);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  const headerColor = colorPalette.cardHeaderText || [15, 23, 42];
  doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
  doc.text(options.title || 'Bank Details', startX + 3, startY + 5);

  let curBankY = startY + 9.5;

  activeBFields.forEach(f => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(30, 41, 59);
    doc.text(f.label, startX + 3, curBankY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const valLines = doc.splitTextToSize(f.value, boxWidth - 32);
    doc.text(valLines[0] || '', startX + 28, curBankY);
    curBankY += 3.6;
  });

  if (hasQr && bankDetails.qrCode) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(30, 41, 59);
    doc.text('UPI QR:', startX + 3, curBankY + 2);

    const qrSize = 13;
    try {
      const format = bankDetails.qrCode.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(bankDetails.qrCode, format, startX + 28, curBankY - 2, qrSize, qrSize, undefined, 'FAST');
    } catch {
      // Ignored if invalid
    }
  }

  return { bankBoxH };
}

export function getQuotePdfFilename(
  doc: QuoteDoc,
  withWorkings: boolean,
  targetClient?: QuoteClient
): string {
  const primaryClient = targetClient || doc.clients[0] || { name: 'Client' };
  const cleanClientName = (primaryClient.name || 'Client').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const rawNum = String(doc.quoteNo || '001').trim();
  const quoteNum = formatQuoteDisplayNumber(rawNum);
  const filePrefix = withWorkings ? 'Quotation_With_Workings' : 'Quotation';
  return `${filePrefix}_${cleanClientName}_${quoteNum}.pdf`;
}

export async function buildQuotePdf(
  doc: QuoteDoc,
  withWorkings: boolean,
  themeId: PdfThemeId | string = 'orange',
  seller?: QuoteSeller,
  templateId: string = 'template-1',
  targetClient?: QuoteClient
): Promise<any> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const pdf = new JsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const selectedThemeId = templateId || 'template-1';
  const colorPalette: PdfThemeColor = PDF_THEMES[themeId] || PDF_THEMES.orange;

  const frameX = 14;
  const frameWidth = 182;
  const frameEndX = frameX + frameWidth; // 196
  const topY = 12;

  const displayCompanyName = (seller?.name || doc.sellerName || 'ARGUS TECHNOLOGIES').trim().toUpperCase();
  const orgGstin = seller?.gstin || '33CZEPS8675J1ZN';
  const orgPhones = seller?.phones && seller.phones.length > 0 ? seller.phones : ['9092992995', '99444 84944'];
  const orgAddress = seller?.address || 'SF NO.515, Bharathiyar Road, Maniyakaranpalayam, Ganapathy (PO), Coimbatore - 641 006.';
  const orgEmail = (seller?.emails && seller.emails.length > 0 ? seller.emails[0] : '') || 'info@arguscnc.com';
  const orgWebsite = seller?.website || 'https://www.arguscnc.com';
  const orgLogo = seller?.logo || '';
  const orgSignature = seller?.signature || '';
  const bankDetails = parseBankDetailsFromSeller(seller, displayCompanyName);

  const activeQuoteTerms = doc.terms || '';
  const activeQuoteNotes = doc.notes || '';
  const dateStr = dmy(doc.date) || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const rawNum = String(doc.quoteNo || '001').trim();
  const quoteNum = formatQuoteDisplayNumber(rawNum);

  const primaryClient = targetClient || doc.clients[0] || {
    name: 'Valued Client',
    address: '',
    gstin: '',
    email: '',
    phone: '',
  };

  const clientPhoneStr = primaryClient.phone || '';
  const clientEmailStr = primaryClient.email || '';
  const clientContactLine = [clientPhoneStr ? `Ph: ${clientPhoneStr}` : '', clientEmailStr ? `Email: ${clientEmailStr}` : ''].filter(Boolean).join(' | ');

  const t = calcTotals(doc.lines, doc.tax);
  const subtotalAll = t.subtotal;
  const halfTaxAmount = t.cgst || (subtotalAll * (doc.tax.cgst || 9) / 100);
  const taxAmount = (t.cgst + t.sgst + t.igst) || (halfTaxAmount * 2);
  const exactGrandTotal = subtotalAll + taxAmount;
  const roundedGrandTotal = Math.round(t.total || exactGrandTotal);
  const roundOff = t.roundOff !== undefined ? t.roundOff : (roundedGrandTotal - exactGrandTotal);

  const hasAnyDiscount = doc.lines.some(l => {
    const d = Number((l.discount || '').replace(/,/g, ''));
    return !Number.isNaN(d) && d > 0;
  });

  let tableHeaders: string[][];
  let tableRows: string[][];
  let columnStyles: Record<number, any>;

  if (hasAnyDiscount) {
    tableHeaders = [['SL.NO', 'HSN/SAC CODE', 'DESCRIPTION', 'QTY', 'UNIT', 'UNIT PRICE', 'DISCOUNT %', 'DISC. PRICE', 'AMOUNT']];
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
    tableRows = doc.lines.filter(l => calcLine(l).active).map((l, i) => {
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
    tableHeaders = [['SL.NO', 'HSN/SAC CODE', 'DESCRIPTION', 'QTY', 'UNIT', 'UNIT PRICE', 'AMOUNT']];
    columnStyles = {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'left', cellWidth: 66 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'center', cellWidth: 14 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'right', cellWidth: 30 },
    };
    tableRows = doc.lines.filter(l => calcLine(l).active).map((l, i) => {
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

  // =========================================================================
  // --- PAGE 1: COMMERCIAL QUOTATION LAYOUT ---
  // =========================================================================
  const isTemplate3or4 = (selectedThemeId === 'template-3' || selectedThemeId === 'template-4');
  const isTemplate5or6 = (selectedThemeId === 'template-5' || selectedThemeId === 'template-6');
  const isTemplate7or8 = (selectedThemeId === 'template-7' || selectedThemeId === 'template-8');
  const isTemplate9or10 = (selectedThemeId === 'template-9' || selectedThemeId === 'template-10');

  if (isTemplate9or10) {
    // -----------------------------------------------------------------------
    // TEMPLATE 9 & TEMPLATE 10: Modern Invoice-Style Quotation
    // -----------------------------------------------------------------------
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(colorPalette.primaryColor[0], colorPalette.primaryColor[1], colorPalette.primaryColor[2]);
    pdf.text('Quotation', 105, topY + 4, { align: 'center' });

    let curLogoY = topY + 9;
    let logoOffset = 0;
    if (orgLogo && typeof orgLogo === 'string' && orgLogo.startsWith('data:image')) {
      try {
        const format = orgLogo.includes('image/png') ? 'PNG' : 'JPEG';
        pdf.addImage(orgLogo, format, frameX, curLogoY, 18, 12, undefined, 'FAST');
        logoOffset = 21;
      } catch {
        logoOffset = 0;
      }
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    const compHeaderLines = pdf.splitTextToSize(displayCompanyName, 120 - logoOffset);
    pdf.text(compHeaderLines, frameX + logoOffset, curLogoY + 7);

    const cardY = Math.max(curLogoY + (logoOffset ? 14 : (compHeaderLines.length * 5 + 3)), topY + 22);
    const cardW = 88;
    const innerW = cardW - 8;
    const clientCardX = frameEndX - cardW;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.2);
    const byCompLines = pdf.splitTextToSize(displayCompanyName, innerW);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const byAddrLines = pdf.splitTextToSize(orgAddress || '', innerW);

    const byContactLine = [orgEmail, (orgPhones && orgPhones[0]), orgWebsite ? orgWebsite.replace(/^https?:\/\//i, '') : ''].filter(Boolean).join(' | ');
    pdf.setFontSize(6.5);
    const byContactLines = byContactLine ? pdf.splitTextToSize(byContactLine, innerW) : [];

    const leftContentH = 5 + (byCompLines.length * 3.4) + 1.2 + (byAddrLines.length * 3.0) + 1.2 + 3.2 + (byContactLines.length ? (1.2 + byContactLines.length * 2.8) : 0) + 3;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.2);
    const toClientLines = pdf.splitTextToSize((primaryClient.name || 'Valued Client').toUpperCase(), innerW);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const toAddrLines = pdf.splitTextToSize(primaryClient.address || 'Address on record', innerW);

    const toGstin = primaryClient.gstin || '-';
    pdf.setFontSize(6.5);
    const toContactLines = clientContactLine ? pdf.splitTextToSize(clientContactLine, innerW) : [];
    const rightContentH = 5 + (toClientLines.length * 3.4) + 1.2 + (toAddrLines.length * 3.0) + 1.2 + 3.2 + (toContactLines.length ? (1.2 + toContactLines.length * 2.8) : 0) + 3;

    const cardH = Math.max(leftContentH, rightContentH, 27);

    pdf.setFillColor(colorPalette.cardBg[0], colorPalette.cardBg[1], colorPalette.cardBg[2]);
    pdf.setDrawColor(colorPalette.cardBorder[0], colorPalette.cardBorder[1], colorPalette.cardBorder[2]);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(frameX, cardY, cardW, cardH, 2, 2, 'FD');

    let curByY = cardY + 4.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.8);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Quotation by', frameX + 3.5, curByY);

    curByY += 4.0;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.2);
    pdf.setTextColor(15, 23, 42);
    pdf.text(byCompLines, frameX + 3.5, curByY);
    curByY += (byCompLines.length * 3.4) + 1.2;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    pdf.text(byAddrLines, frameX + 3.5, curByY);
    curByY += (byAddrLines.length * 3.0) + 1.2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`GSTIN: ${orgGstin}`, frameX + 3.5, curByY);
    curByY += 3.2;

    if (byContactLines.length) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(byContactLines, frameX + 3.5, curByY);
    }

    pdf.setFillColor(colorPalette.cardBg[0], colorPalette.cardBg[1], colorPalette.cardBg[2]);
    pdf.setDrawColor(colorPalette.cardBorder[0], colorPalette.cardBorder[1], colorPalette.cardBorder[2]);
    pdf.roundedRect(clientCardX, cardY, cardW, cardH, 2, 2, 'FD');

    let curToY = cardY + 4.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.8);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Quotation to', clientCardX + 3.5, curToY);

    curToY += 4.0;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.2);
    pdf.setTextColor(15, 23, 42);
    pdf.text(toClientLines, clientCardX + 3.5, curToY);
    curToY += (toClientLines.length * 3.4) + 1.2;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    pdf.text(toAddrLines, clientCardX + 3.5, curToY);
    curToY += (toAddrLines.length * 3.0) + 1.2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`GSTIN: ${toGstin}`, clientCardX + 3.5, curToY);
    curToY += 3.2;

    if (toContactLines.length) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(toContactLines, clientCardX + 3.5, curToY);
    }

    const quoteBarY = cardY + cardH + 2.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Quotation # : ${quoteNum}`, frameX, quoteBarY + 3.5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Quotation Date : ${dateStr}`, frameEndX, quoteBarY + 3.5, { align: 'right' });

    autoTable(pdf, {
      head: tableHeaders,
      body: tableRows,
      startY: quoteBarY + 6.5,
      margin: { left: frameX, right: frameX, bottom: 25 },
      tableWidth: frameWidth,
      headStyles: {
        fillColor: colorPalette.headerFill,
        textColor: colorPalette.headerText,
        fontStyle: 'bold',
        fontSize: 6.8,
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 2.0, bottom: 2.0, left: 1.0, right: 1.0 },
      },
      bodyStyles: {
        fontSize: 7.0,
        textColor: [15, 23, 42],
        cellPadding: 1.8,
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: colorPalette.altRow,
      },
      columnStyles,
      theme: 'grid',
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
    });

    // @ts-expect-error lastAutoTable is injected by plugin
    let afterTableY = pdf.lastAutoTable.finalY + 4;
    const requiredBottomH9_10 = 66;
    if (afterTableY + requiredBottomH9_10 > 270) {
      pdf.addPage();
      afterTableY = topY + 6;
    }

    const leftColW = 98;
    const rightColW = frameWidth - leftColW - 6;
    const rightColX = frameEndX - rightColW;

    let curTermsY = afterTableY;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.8);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Terms and Conditions', frameX, curTermsY + 2);
    curTermsY += 5.5;

    curTermsY = renderQuoteTermsWithHangingIndent(pdf, activeQuoteTerms, frameX, curTermsY, leftColW, {
      fontSize: 6.4,
      numWidth: 5.2,
      lineHeight: 2.9,
      itemGap: 1.1,
      numColor: [30, 41, 59],
      bodyColor: [71, 85, 105],
    });

    const bankBoxY = curTermsY + 2;
    const bankBoxRes = renderCompanyBankDetailsBox(pdf, bankDetails, displayCompanyName, roundedGrandTotal, frameX, bankBoxY, leftColW, colorPalette, { rounded: false });
    const bankBoxH = bankBoxRes.bankBoxH;

    let curTotalsY = afterTableY + 2;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.8);
    pdf.setTextColor(71, 85, 105);
    pdf.text('TOTAL AMOUNT BEFORE TAX :', rightColX, curTotalsY);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Rs. ${formatNumber(subtotalAll)}`, frameEndX, curTotalsY, { align: 'right' });
    curTotalsY += 4.5;

    pdf.setFont('helvetica', 'normal');
    pdf.text(`Add: CGST ${doc.tax.cgst || 9}% :`, rightColX, curTotalsY);
    pdf.text(`Rs. ${formatNumber(halfTaxAmount)}`, frameEndX, curTotalsY, { align: 'right' });
    curTotalsY += 4.5;

    pdf.text(`Add: SGST ${doc.tax.sgst || 9}% :`, rightColX, curTotalsY);
    pdf.text(`Rs. ${formatNumber(halfTaxAmount)}`, frameEndX, curTotalsY, { align: 'right' });
    curTotalsY += 4.5;

    pdf.text(`Add: IGST ${doc.tax.igst || 0}% :`, rightColX, curTotalsY);
    pdf.text(`Rs. ${formatNumber(t.igst || 0)}`, frameEndX, curTotalsY, { align: 'right' });
    curTotalsY += 4.5;

    pdf.text('Round Off :', rightColX, curTotalsY);
    pdf.text(`Rs. ${roundOff >= 0 ? '+' : ''}${formatNumber(roundOff)}`, frameEndX, curTotalsY, { align: 'right' });
    curTotalsY += 4.5;

    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.15);
    pdf.line(rightColX, curTotalsY - 1, frameEndX, curTotalsY - 1);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.8);
    pdf.setTextColor(colorPalette.totalText[0], colorPalette.totalText[1], colorPalette.totalText[2]);
    pdf.text('TOTAL AMOUNT AFTER TAX :', rightColX, curTotalsY + 3.5);
    pdf.text(`Rs. ${formatNumber(roundedGrandTotal)}`, frameEndX, curTotalsY + 3.5, { align: 'right' });
    curTotalsY += 8;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Invoice Total (in words)', rightColX, curTotalsY);
    curTotalsY += 3.8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.8);
    pdf.setTextColor(30, 41, 59);
    const wordsLines = pdf.splitTextToSize(`${numberToWordsINR(roundedGrandTotal)}`, rightColW);
    pdf.text(wordsLines, rightColX, curTotalsY);
    curTotalsY += (wordsLines.length * 3.2) + 4;

    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.15);
    pdf.line(rightColX, curTotalsY, frameEndX, curTotalsY);
    curTotalsY += 3;

    if (selectedThemeId === 'template-9') {
      const sigLineY = Math.max(curTotalsY + 16, bankBoxY + bankBoxH - 5);
      if (orgSignature && orgSignature.startsWith('data:image')) {
        try {
          const sigFormat = orgSignature.includes('image/png') ? 'PNG' : 'JPEG';
          pdf.addImage(orgSignature, sigFormat, frameEndX - 42, sigLineY - 14, 36, 12, undefined, 'FAST');
        } catch {}
      }
      pdf.setDrawColor(148, 163, 184);
      pdf.setLineWidth(0.35);
      pdf.line(frameEndX - 48, sigLineY, frameEndX, sigLineY);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Authorized Signature', frameEndX - 24, sigLineY + 4.2, { align: 'center' });
    } else {
      const discY = Math.max(curTotalsY + 6, bankBoxY + bankBoxH - 8);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7.0);
      pdf.setTextColor(100, 116, 139);
      const discLines = pdf.splitTextToSize('This quotation was generated electronically through Argus and requires no physical signature.', rightColW);
      pdf.text(discLines, rightColX, discY);
    }
  } else if (isTemplate7or8) {
    // -----------------------------------------------------------------------
    // TEMPLATE 7 & TEMPLATE 8: Industrial Machine Shop Quote
    // -----------------------------------------------------------------------
    let curLeftY = topY + 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    const compNameLines = pdf.splitTextToSize(displayCompanyName, 95);
    pdf.text(compNameLines, frameX, curLeftY);
    curLeftY += (compNameLines.length * 4.2);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    pdf.setTextColor(71, 85, 105);
    const compAddrLines = pdf.splitTextToSize(orgAddress, 95);
    pdf.text(compAddrLines, frameX, curLeftY);
    curLeftY += (compAddrLines.length * 3.2);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`GSTIN: ${orgGstin}`, frameX, curLeftY);
    curLeftY += 3.2;

    const contactParts = [
      (orgPhones && orgPhones.length > 0) ? `Ph: ${orgPhones.join(', ')}` : '',
      orgEmail ? `Email: ${orgEmail}` : '',
      orgWebsite ? `Web: ${orgWebsite.replace(/^https?:\/\//i, '')}` : ''
    ].filter(Boolean).join('  |  ');
    if (contactParts) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);
      const contactLines = pdf.splitTextToSize(contactParts, 95);
      pdf.text(contactLines, frameX, curLeftY);
      curLeftY += (contactLines.length * 3.0);
    }

    let curRightY = topY;
    if (orgLogo && orgLogo.startsWith('data:image')) {
      try {
        const format = orgLogo.includes('image/png') ? 'PNG' : 'JPEG';
        pdf.addImage(orgLogo, format, frameEndX - 26, curRightY, 26, 13, undefined, 'FAST');
        curRightY += 16;
      } catch {
        curRightY += 4;
      }
    } else {
      curRightY += 4;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(colorPalette.primaryColor[0], colorPalette.primaryColor[1], colorPalette.primaryColor[2]);
    pdf.text('QUOTE', frameEndX, curRightY + 6, { align: 'right' });
    curRightY += 12;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.2);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Quotation : ${quoteNum}`, frameEndX, curRightY, { align: 'right' });
    curRightY += 4.2;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Quotation Date : ${dateStr}`, frameEndX, curRightY, { align: 'right' });
    curRightY += 4.5;

    const headerDividerY = Math.max(curLeftY, curRightY) + 3;
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    pdf.line(frameX, headerDividerY, frameEndX, headerDividerY);

    const billToY = headerDividerY + 3;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Quotation to:', frameX, billToY + 3);

    let curCustY = billToY + 7;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text((primaryClient.name || 'Valued Client').toUpperCase(), frameX, curCustY);
    curCustY += 4.0;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    pdf.setTextColor(71, 85, 105);
    const clientAddrLines = pdf.splitTextToSize(primaryClient.address || 'Address on record', 120);
    pdf.text(clientAddrLines, frameX, curCustY);
    curCustY += (clientAddrLines.length * 3.2);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`GSTIN: ${primaryClient.gstin || '-'}`, frameX, curCustY);
    curCustY += 3.2;

    if (clientContactLine) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(clientContactLine, frameX, curCustY);
      curCustY += 3.0;
    }

    autoTable(pdf, {
      head: tableHeaders,
      body: tableRows,
      startY: curCustY + 2,
      margin: { left: frameX, right: frameX, bottom: 25 },
      tableWidth: frameWidth,
      headStyles: {
        fillColor: colorPalette.headerFill,
        textColor: colorPalette.headerText,
        fontStyle: 'bold',
        fontSize: 6.8,
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 2.0, bottom: 2.0, left: 1.0, right: 1.0 },
      },
      bodyStyles: {
        fontSize: 7.0,
        textColor: [15, 23, 42],
        cellPadding: 1.8,
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: colorPalette.altRow,
      },
      columnStyles,
      theme: 'grid',
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
    });

    // @ts-expect-error lastAutoTable is injected by plugin
    let afterTableY = pdf.lastAutoTable.finalY + 4;
    const requiredBottomH7_8 = (selectedThemeId === 'template-7') ? 78 : 70;
    if (afterTableY + requiredBottomH7_8 > 270) {
      pdf.addPage();
      afterTableY = topY + 6;
    }

    const totalsBoxW = 74;
    const totalsBoxX = frameEndX - totalsBoxW;
    let curTotalsY = afterTableY + 2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.8);
    pdf.setTextColor(71, 85, 105);
    pdf.text('TOTAL AMOUNT BEFORE TAX :', totalsBoxX, curTotalsY);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Rs. ${formatNumber(subtotalAll)}`, frameEndX, curTotalsY, { align: 'right' });
    curTotalsY += 4.5;

    pdf.setFont('helvetica', 'normal');
    pdf.text(`Add: CGST ${doc.tax.cgst || 9}% :`, totalsBoxX, curTotalsY);
    pdf.text(`Rs. ${formatNumber(halfTaxAmount)}`, frameEndX, curTotalsY, { align: 'right' });
    curTotalsY += 4.5;

    pdf.text(`Add: SGST ${doc.tax.sgst || 9}% :`, totalsBoxX, curTotalsY);
    pdf.text(`Rs. ${formatNumber(halfTaxAmount)}`, frameEndX, curTotalsY, { align: 'right' });
    curTotalsY += 4.5;

    pdf.text(`Add: IGST ${doc.tax.igst || 0}% :`, totalsBoxX, curTotalsY);
    pdf.text(`Rs. ${formatNumber(t.igst || 0)}`, frameEndX, curTotalsY, { align: 'right' });
    curTotalsY += 4.5;

    pdf.text('Round Off :', totalsBoxX, curTotalsY);
    pdf.text(`Rs. ${roundOff >= 0 ? '+' : ''}${formatNumber(roundOff)}`, frameEndX, curTotalsY, { align: 'right' });
    curTotalsY += 4.5;

    const totalBarH = 7.5;
    pdf.setFillColor(colorPalette.cardBg[0], colorPalette.cardBg[1], colorPalette.cardBg[2]);
    pdf.setDrawColor(colorPalette.cardBorder[0], colorPalette.cardBorder[1], colorPalette.cardBorder[2]);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(totalsBoxX - 2, curTotalsY, totalsBoxW + 2, totalBarH, 1.5, 1.5, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.8);
    pdf.setTextColor(colorPalette.totalText[0], colorPalette.totalText[1], colorPalette.totalText[2]);
    pdf.text('TOTAL AMOUNT AFTER TAX :', totalsBoxX + 1, curTotalsY + 5);
    pdf.text(`Rs. ${formatNumber(roundedGrandTotal)}`, frameEndX - 1, curTotalsY + 5, { align: 'right' });

    let curTermsY = afterTableY + 2;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Terms and Conditions', frameX, curTermsY);
    curTermsY += 4.2;

    curTermsY = renderQuoteTermsWithHangingIndent(pdf, activeQuoteTerms, frameX, curTermsY, frameWidth * 0.52, {
      fontSize: 6.4,
      numWidth: 5.2,
      lineHeight: 2.9,
      itemGap: 1.1,
      numColor: [30, 41, 59],
      bodyColor: [71, 85, 105],
    });

    if (activeQuoteNotes) {
      curTermsY += 2;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
      pdf.text('Additional Notes', frameX, curTermsY);
      curTermsY += 3.8;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);
      const noteLines = pdf.splitTextToSize(activeQuoteNotes.replace(/\n+/g, ' '), frameWidth * 0.52);
      pdf.text(noteLines, frameX, curTermsY);
      curTermsY += (noteLines.length * 3.1);
    }

    const t7BankY = curTermsY + 3;
    const t7BankWidth = frameWidth * 0.52;
    const t7BankRes = renderCompanyBankDetailsBox(pdf, bankDetails, displayCompanyName, roundedGrandTotal, frameX, t7BankY, t7BankWidth, colorPalette, { rounded: true });
    const t7BankBoxH = t7BankRes.bankBoxH;

    if (selectedThemeId === 'template-7') {
      const custSigY = Math.max(curTotalsY + totalBarH + 22, t7BankY + t7BankBoxH - 6);
      if (orgSignature && orgSignature.startsWith('data:image')) {
        try {
          const sigFormat = orgSignature.includes('image/png') ? 'PNG' : 'JPEG';
          pdf.addImage(orgSignature, sigFormat, frameEndX - 42, custSigY - 14, 36, 12, undefined, 'FAST');
        } catch {}
      }
      pdf.setDrawColor(148, 163, 184);
      pdf.setLineWidth(0.35);
      pdf.line(frameEndX - 48, custSigY, frameEndX, custSigY);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Customer Signature', frameEndX - 24, custSigY + 4.2, { align: 'center' });
    } else {
      const discY = Math.max(curTotalsY + totalBarH + 12, t7BankY + t7BankBoxH - 8);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7.0);
      pdf.setTextColor(100, 116, 139);
      const discLines = pdf.splitTextToSize('This quotation was generated electronically through Argus and requires no physical signature.', totalsBoxW);
      pdf.text(discLines, totalsBoxX, discY);
    }
  } else if (isTemplate5or6) {
    // -----------------------------------------------------------------------
    // TEMPLATE 5 & TEMPLATE 6: Classic Quotation with Logo Header, Bill To
    // -----------------------------------------------------------------------
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(colorPalette.primaryColor[0], colorPalette.primaryColor[1], colorPalette.primaryColor[2]);
    pdf.text('Quotation', frameX, topY + 2);

    let curY = topY + 7;
    let logoOffset = 0;
    if (orgLogo && orgLogo.startsWith('data:image')) {
      try {
        const format = orgLogo.includes('image/png') ? 'PNG' : 'JPEG';
        pdf.addImage(orgLogo, format, frameX, curY, 16, 12, undefined, 'FAST');
        logoOffset = 19;
      } catch {}
    }

    const companyTextX = frameX + logoOffset;
    const maxCompW = 95 - logoOffset;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(colorPalette.primaryColor[0], colorPalette.primaryColor[1], colorPalette.primaryColor[2]);
    const compNameLines = pdf.splitTextToSize(displayCompanyName, maxCompW);
    let curCompY = curY + 4;
    pdf.text(compNameLines, companyTextX, curCompY);
    curCompY += (compNameLines.length * 4.0);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    const compAddrLines = pdf.splitTextToSize(orgAddress, maxCompW);
    pdf.text(compAddrLines, companyTextX, curCompY);
    curCompY += (compAddrLines.length * 3.1);

    const companyPhoneLine = orgPhones.length > 0 ? `Phone: ${orgPhones.join(', ')}` : '';
    if (companyPhoneLine) {
      pdf.text(companyPhoneLine, companyTextX, curCompY);
      curCompY += 3.2;
    }

    const emailLine = orgEmail ? `Email: ${orgEmail}` : '';
    if (emailLine) {
      pdf.text(emailLine, companyTextX, curCompY);
      curCompY += 3.2;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`GSTIN: ${orgGstin}`, companyTextX, curCompY);

    let curRightMetaY = topY + 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Quotation #', frameEndX, curRightMetaY, { align: 'right' });
    curRightMetaY += 4;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(quoteNum, frameEndX, curRightMetaY, { align: 'right' });
    curRightMetaY += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Quotation Date', frameEndX, curRightMetaY, { align: 'right' });
    curRightMetaY += 4;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(dateStr, frameEndX, curRightMetaY, { align: 'right' });

    const billToY = Math.max(curCompY + 4, curRightMetaY + 6);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Quotation to', frameX, billToY);

    let curClientY = billToY + 4.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text((primaryClient.name || 'Valued Client').toUpperCase(), frameX, curClientY);
    curClientY += 4.0;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    const clientAddressLines = pdf.splitTextToSize(primaryClient.address || 'Address on record', 120);
    pdf.text(clientAddressLines, frameX, curClientY);
    curClientY += (clientAddressLines.length * 3.1);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`GSTIN: ${primaryClient.gstin || '-'}`, frameX, curClientY);
    curClientY += 3.2;

    if (clientContactLine) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(clientContactLine, frameX, curClientY);
      curClientY += 3.0;
    }

    autoTable(pdf, {
      head: tableHeaders,
      body: tableRows,
      startY: curClientY + 2,
      margin: { left: frameX, right: frameX, bottom: 25 },
      tableWidth: frameWidth,
      headStyles: {
        fillColor: colorPalette.headerFill,
        textColor: colorPalette.headerText,
        fontStyle: 'bold',
        fontSize: 6.8,
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 2.0, bottom: 2.0, left: 1.0, right: 1.0 },
      },
      bodyStyles: {
        fontSize: 7.0,
        textColor: [15, 23, 42],
        cellPadding: 1.8,
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: colorPalette.altRow,
      },
      columnStyles,
      theme: 'grid',
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
    });

    // @ts-expect-error lastAutoTable is injected by plugin
    let afterTableY = pdf.lastAutoTable.finalY + 3;
    const requiredBottomH5_6 = 68;
    if (afterTableY + requiredBottomH5_6 > 270) {
      pdf.addPage();
      afterTableY = topY + 6;
    }

    const bottomSplitY = afterTableY;
    const bankBoxWidth = frameWidth * 0.48;
    const taxBoxWidth = frameWidth - bankBoxWidth - 2;
    const taxBoxX = frameX + bankBoxWidth + 2;

    const bankBoxRes = renderCompanyBankDetailsBox(pdf, bankDetails, displayCompanyName, roundedGrandTotal, frameX, bottomSplitY, bankBoxWidth, colorPalette, { rounded: false });
    const bankBoxH = bankBoxRes.bankBoxH;

    let curTaxY = bottomSplitY + 2;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.8);
    pdf.setTextColor(71, 85, 105);
    pdf.text('TOTAL AMOUNT BEFORE TAX :', taxBoxX, curTaxY);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Rs. ${formatNumber(subtotalAll)}`, taxBoxX + taxBoxWidth - 2, curTaxY, { align: 'right' });

    curTaxY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Add: CGST ${doc.tax.cgst || 9}% :`, taxBoxX, curTaxY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Rs. ${formatNumber(halfTaxAmount)}`, taxBoxX + taxBoxWidth - 2, curTaxY, { align: 'right' });

    curTaxY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Add: SGST ${doc.tax.sgst || 9}% :`, taxBoxX, curTaxY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Rs. ${formatNumber(halfTaxAmount)}`, taxBoxX + taxBoxWidth - 2, curTaxY, { align: 'right' });

    curTaxY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Add: IGST ${doc.tax.igst || 0}% :`, taxBoxX, curTaxY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Rs. ${formatNumber(t.igst || 0)}`, taxBoxX + taxBoxWidth - 2, curTaxY, { align: 'right' });

    curTaxY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Round Off :', taxBoxX, curTaxY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Rs. ${roundOff >= 0 ? '+' : ''}${formatNumber(roundOff)}`, taxBoxX + taxBoxWidth - 2, curTaxY, { align: 'right' });

    curTaxY += 4;
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.15);
    pdf.line(taxBoxX, curTaxY, taxBoxX + taxBoxWidth, curTaxY);

    curTaxY += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.8);
    pdf.setTextColor(colorPalette.totalText[0], colorPalette.totalText[1], colorPalette.totalText[2]);
    pdf.text('TOTAL AMOUNT AFTER TAX :', taxBoxX, curTaxY);
    pdf.text(`Rs. ${formatNumber(roundedGrandTotal)}`, taxBoxX + taxBoxWidth - 2, curTaxY, { align: 'right' });

    if (selectedThemeId === 'template-5') {
      const sigLineY = Math.max(curTaxY + 16, bottomSplitY + bankBoxH - 6);
      if (orgSignature && orgSignature.startsWith('data:image')) {
        try {
          const sigFormat = orgSignature.includes('image/png') ? 'PNG' : 'JPEG';
          pdf.addImage(orgSignature, sigFormat, frameEndX - 38, sigLineY - 13, 34, 11, undefined, 'FAST');
        } catch {}
      }
      pdf.setDrawColor(148, 163, 184);
      pdf.setLineWidth(0.35);
      pdf.line(frameEndX - 44, sigLineY, frameEndX, sigLineY);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.2);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Authorized Signature', frameEndX - 22, sigLineY + 3.8, { align: 'center' });
    } else {
      const discY = Math.max(curTaxY + 8, bottomSplitY + bankBoxH - 8);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7.0);
      pdf.setTextColor(100, 116, 139);
      const discLines = pdf.splitTextToSize('This quotation was generated electronically through Argus and requires no physical signature.', taxBoxWidth);
      pdf.text(discLines, taxBoxX, discY);
    }

    let curTermsBottomY = Math.max(bottomSplitY + bankBoxH + 4, curTaxY + 18);
    if (activeQuoteTerms) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
      pdf.text('Terms and Conditions', frameX, curTermsBottomY);
      curTermsBottomY += 4.0;
      curTermsBottomY = renderQuoteTermsWithHangingIndent(pdf, activeQuoteTerms, frameX, curTermsBottomY, frameWidth, {
        fontSize: 6.4,
        numWidth: 5.2,
        lineHeight: 2.8,
        itemGap: 1.0,
      });
    }
  } else if (isTemplate3or4) {
    // -----------------------------------------------------------------------
    // TEMPLATE 3 & TEMPLATE 4: Centered Header, Split Bank & Contact Layout
    // -----------------------------------------------------------------------
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(colorPalette.primaryColor[0], colorPalette.primaryColor[1], colorPalette.primaryColor[2]);
    pdf.text('QUOTATION', 105, topY + 3.5, { align: 'center' });

    pdf.setDrawColor(colorPalette.primaryColor[0], colorPalette.primaryColor[1], colorPalette.primaryColor[2]);
    pdf.setLineWidth(0.4);
    pdf.line(frameX, topY + 5.5, frameEndX, topY + 5.5);

    let curHeaderY = topY + 11.5;
    if (orgLogo && orgLogo.startsWith('data:image')) {
      try {
        const format = orgLogo.includes('image/png') ? 'PNG' : 'JPEG';
        pdf.addImage(orgLogo, format, 105 - 8, curHeaderY, 16, 9.5, undefined, 'FAST');
        curHeaderY += 12;
      } catch {
        curHeaderY += 2;
      }
    } else {
      curHeaderY += 3;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(colorPalette.primaryColor[0], colorPalette.primaryColor[1], colorPalette.primaryColor[2]);
    pdf.text(displayCompanyName, 105, curHeaderY, { align: 'center' });

    curHeaderY += 4.2;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    pdf.setTextColor(71, 85, 105);
    pdf.text(orgAddress, 105, curHeaderY, { align: 'center', maxWidth: frameWidth });

    curHeaderY += 3.6;
    const headerContactLine = [
      orgPhones.length > 0 ? `Phone: ${orgPhones.join(', ')}` : '',
      orgEmail ? `Email: ${orgEmail}` : '',
      orgWebsite ? `Web: ${orgWebsite.replace(/^https?:\/\//i, '')}` : ''
    ].filter(Boolean).join('  |  ');
    if (headerContactLine) {
      pdf.text(headerContactLine, 105, curHeaderY, { align: 'center', maxWidth: frameWidth });
      curHeaderY += 3.6;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`GSTIN: ${orgGstin}`, 105, curHeaderY, { align: 'center' });
    curHeaderY += 4.5;

    const clientBoxY = curHeaderY;
    const clientBoxSplitX = frameX + (frameWidth * 0.62);
    const clientInnerW = (frameWidth * 0.62) - 6;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.2);
    const t3ClientNameLines = pdf.splitTextToSize((primaryClient.name || 'Valued Client').toUpperCase(), clientInnerW);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const t3ClientAddrLines = pdf.splitTextToSize(primaryClient.address || 'Address on record', clientInnerW);

    const t3ContactLines = clientContactLine ? pdf.splitTextToSize(clientContactLine, clientInnerW) : [];
    const t3LeftH = 6 + (t3ClientNameLines.length * 3.4) + 1.2 + (t3ClientAddrLines.length * 3.0) + 1.2 + 3.2 + (t3ContactLines.length ? (1.2 + t3ContactLines.length * 2.8) : 0) + 3;
    const clientBoxH = Math.max(t3LeftH, 24);

    pdf.setDrawColor(colorPalette.cardBorder[0], colorPalette.cardBorder[1], colorPalette.cardBorder[2]);
    pdf.setLineWidth(0.3);
    pdf.rect(frameX, clientBoxY, frameWidth, clientBoxH);
    pdf.line(clientBoxSplitX, clientBoxY, clientBoxSplitX, clientBoxY + clientBoxH);

    let curT3ClientY = clientBoxY + 4.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Quotation to :', frameX + 3, curT3ClientY);

    curT3ClientY += 4.0;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.2);
    pdf.setTextColor(15, 23, 42);
    pdf.text(t3ClientNameLines, frameX + 3, curT3ClientY);
    curT3ClientY += (t3ClientNameLines.length * 3.4) + 1.2;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    pdf.text(t3ClientAddrLines, frameX + 3, curT3ClientY);
    curT3ClientY += (t3ClientAddrLines.length * 3.0) + 1.2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`GSTIN: ${primaryClient.gstin || '-'}`, frameX + 3, curT3ClientY);
    curT3ClientY += 3.2;

    if (t3ContactLines.length) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(t3ContactLines, frameX + 3, curT3ClientY);
    }

    let curQuoteInfoY = clientBoxY + 5.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Quotation # :', clientBoxSplitX + 3, curQuoteInfoY);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(quoteNum, frameEndX - 3, curQuoteInfoY, { align: 'right' });

    curQuoteInfoY += 5.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text('Quotation Date :', clientBoxSplitX + 3, curQuoteInfoY);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(71, 85, 105);
    pdf.text(dateStr, frameEndX - 3, curQuoteInfoY, { align: 'right' });

    autoTable(pdf, {
      head: tableHeaders,
      body: tableRows,
      startY: clientBoxY + clientBoxH + 2,
      margin: { left: frameX, right: frameX, bottom: 25 },
      tableWidth: frameWidth,
      headStyles: {
        fillColor: colorPalette.headerFill,
        textColor: colorPalette.headerText,
        fontStyle: 'bold',
        fontSize: 6.8,
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 2.0, bottom: 2.0, left: 1.0, right: 1.0 },
      },
      bodyStyles: {
        fontSize: 7.0,
        textColor: [15, 23, 42],
        cellPadding: 1.8,
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: colorPalette.altRow,
      },
      columnStyles,
      theme: 'grid',
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
    });

    // @ts-expect-error lastAutoTable is injected by plugin
    let afterTableY = pdf.lastAutoTable.finalY + 3;
    const requiredBottomH3_4 = (selectedThemeId === 'template-3') ? 85 : 76;
    if (afterTableY + requiredBottomH3_4 > 270) {
      pdf.addPage();
      afterTableY = topY + 6;
    }

    const midBoxY = afterTableY;
    const midBoxH = 36;
    const midBoxSplitX = frameX + (frameWidth * 0.52);

    pdf.setDrawColor(colorPalette.cardBorder[0], colorPalette.cardBorder[1], colorPalette.cardBorder[2]);
    pdf.setLineWidth(0.3);
    pdf.rect(frameX, midBoxY, frameWidth, midBoxH);
    pdf.line(midBoxSplitX, midBoxY, midBoxSplitX, midBoxY + midBoxH);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Rupees (in words) :', frameX + 3, midBoxY + 5);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(30, 41, 59);
    pdf.text(numberToWordsINR(roundedGrandTotal), frameX + 3, midBoxY + 11, { maxWidth: (frameWidth * 0.52) - 6 });

    let curBreakdownY = midBoxY + 4.5;
    const breakdownValX = frameEndX - 3;
    const breakdownLblX = midBoxSplitX + 3;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.8);
    pdf.setTextColor(71, 85, 105);
    pdf.text('TOTAL AMOUNT BEFORE TAX :', breakdownLblX, curBreakdownY);
    pdf.text(`Rs. ${formatNumber(subtotalAll)}`, breakdownValX, curBreakdownY, { align: 'right' });

    curBreakdownY += 4.5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Add: CGST ${doc.tax.cgst || 9}% :`, breakdownLblX, curBreakdownY);
    pdf.text(`Rs. ${formatNumber(halfTaxAmount)}`, breakdownValX, curBreakdownY, { align: 'right' });

    curBreakdownY += 4.5;
    pdf.text(`Add: SGST ${doc.tax.sgst || 9}% :`, breakdownLblX, curBreakdownY);
    pdf.text(`Rs. ${formatNumber(halfTaxAmount)}`, breakdownValX, curBreakdownY, { align: 'right' });

    curBreakdownY += 4.5;
    pdf.text(`Add: IGST ${doc.tax.igst || 0}% :`, breakdownLblX, curBreakdownY);
    pdf.text(`Rs. ${formatNumber(t.igst || 0)}`, breakdownValX, curBreakdownY, { align: 'right' });

    curBreakdownY += 4.5;
    pdf.text('Round Off :', breakdownLblX, curBreakdownY);
    pdf.text(`Rs. ${roundOff >= 0 ? '+' : ''}${formatNumber(roundOff)}`, breakdownValX, curBreakdownY, { align: 'right' });

    curBreakdownY += 3;
    pdf.line(midBoxSplitX, curBreakdownY, frameEndX, curBreakdownY);

    curBreakdownY += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.8);
    pdf.setTextColor(colorPalette.totalText[0], colorPalette.totalText[1], colorPalette.totalText[2]);
    pdf.text('TOTAL AMOUNT AFTER TAX :', breakdownLblX, curBreakdownY);
    pdf.text(`Rs. ${formatNumber(roundedGrandTotal)}`, breakdownValX, curBreakdownY, { align: 'right' });

    const bankBoxY = midBoxY + midBoxH + 2.5;
    const bankBoxSplitX = frameX + (frameWidth * 0.52);
    const termsColWidth = (frameWidth * 0.52) - 6;

    const t3BankRes = renderCompanyBankDetailsBox(pdf, bankDetails, displayCompanyName, roundedGrandTotal, frameX, bankBoxY, frameWidth * 0.52, colorPalette, { rounded: true });
    const bankDetailsH = t3BankRes.bankBoxH;

    let curT3TermsY = bankBoxY + bankDetailsH + 2.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Terms and Conditions :', frameX, curT3TermsY);
    curT3TermsY += 3.8;

    curT3TermsY = renderQuoteTermsWithHangingIndent(pdf, activeQuoteTerms, frameX, curT3TermsY, termsColWidth, {
      fontSize: 6.2,
      numWidth: 5.0,
      lineHeight: 2.8,
      itemGap: 0.9,
    });

    const declBoxW = frameWidth - (frameWidth * 0.52) - 3;
    const declBoxX = bankBoxSplitX + 3;

    if (selectedThemeId === 'template-3') {
      let curDeclY = bankBoxY + 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.0);
      pdf.setTextColor(71, 85, 105);
      pdf.text('Thank you for choosing Argus Technologies!', declBoxX, curDeclY);
      curDeclY += 12;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text(`For ${displayCompanyName}`, declBoxX, curDeclY);
      curDeclY += 14;

      if (orgSignature && orgSignature.startsWith('data:image')) {
        try {
          const sigFormat = orgSignature.includes('image/png') ? 'PNG' : 'JPEG';
          pdf.addImage(orgSignature, sigFormat, frameEndX - 38, curDeclY - 14, 34, 11, undefined, 'FAST');
        } catch {}
      }

      pdf.setDrawColor(148, 163, 184);
      pdf.setLineWidth(0.35);
      pdf.line(frameEndX - 44, curDeclY, frameEndX, curDeclY);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.2);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Authorized Signatory', frameEndX - 22, curDeclY + 4, { align: 'center' });
    } else {
      let curDeclY = bankBoxY + 5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
      pdf.text('Electronic Notice :', declBoxX, curDeclY);
      curDeclY += 4.5;

      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);
      const discLines = pdf.splitTextToSize('This quotation was generated electronically through Argus and requires no physical signature.', declBoxW);
      pdf.text(discLines, declBoxX, curDeclY);
    }
  } else {
    // -----------------------------------------------------------------------
    // TEMPLATE 1 & TEMPLATE 2: Dual Card / Executive Banner (Default)
    // -----------------------------------------------------------------------
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(colorPalette.primaryColor[0], colorPalette.primaryColor[1], colorPalette.primaryColor[2]);
    pdf.text('QUOTATION', 105, topY + 4, { align: 'center' });

    let logoOffset = 0;
    if (orgLogo && orgLogo.startsWith('data:image')) {
      try {
        const format = orgLogo.includes('image/png') ? 'PNG' : 'JPEG';
        let logoW = 18;
        let logoH = 12;
        const imgProps = pdf.getImageProperties(orgLogo);
        if (imgProps && imgProps.width && imgProps.height) {
          const aspect = imgProps.width / imgProps.height;
          logoW = 20;
          logoH = logoW / aspect;
          if (logoH > 13) {
            logoH = 13;
            logoW = logoH * aspect;
          }
        }
        pdf.addImage(orgLogo, format, frameX, topY + 5, logoW, logoH, undefined, 'FAST');
        logoOffset = Math.round(logoW + 3);
      } catch {
        logoOffset = 0;
      }
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(colorPalette.primaryColor[0], colorPalette.primaryColor[1], colorPalette.primaryColor[2]);
    pdf.text(displayCompanyName, frameX + logoOffset, topY + 11, { maxWidth: 85 - logoOffset });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Quotation : ${quoteNum}`, frameEndX, topY + 9, { align: 'right' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Quotation Date : ${dateStr}`, frameEndX, topY + 14, { align: 'right' });

    const cardY = topY + 19;
    const cardW = 88;
    const innerW = cardW - 7;
    const clientCardX = frameEndX - cardW;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    const byCompLines = pdf.splitTextToSize(displayCompanyName, innerW);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    const byAddrLines = pdf.splitTextToSize(orgAddress || '', innerW);

    const byContactLine = [orgEmail, (orgPhones && orgPhones[0]), orgWebsite ? orgWebsite.replace(/^https?:\/\//i, '') : ''].filter(Boolean).join(' | ');
    pdf.setFontSize(6.8);
    const byContactLines = byContactLine ? pdf.splitTextToSize(byContactLine, innerW) : [];

    const leftContentH = 5 + (byCompLines.length * 3.6) + 1.5 + (byAddrLines.length * 3.1) + 1.5 + 3.2 + (byContactLines.length ? (1.5 + byContactLines.length * 3.0) : 0) + 3;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    const toClientLines = pdf.splitTextToSize((primaryClient.name || 'Valued Client').toUpperCase(), innerW);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    const toAddrLines = pdf.splitTextToSize(primaryClient.address || 'Address on record', innerW);

    const toGstin = primaryClient.gstin || '-';
    pdf.setFontSize(6.8);
    const toContactLines = clientContactLine ? pdf.splitTextToSize(clientContactLine, innerW) : [];
    const rightContentH = 5 + (toClientLines.length * 3.6) + 1.5 + (toAddrLines.length * 3.1) + 1.5 + 3.2 + (toContactLines.length ? (1.5 + toContactLines.length * 3.0) : 0) + 3;

    const cardH = Math.max(leftContentH, rightContentH, 30);

    pdf.setFillColor(colorPalette.cardBg[0], colorPalette.cardBg[1], colorPalette.cardBg[2]);
    pdf.setDrawColor(colorPalette.cardBorder[0], colorPalette.cardBorder[1], colorPalette.cardBorder[2]);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(frameX, cardY, cardW, cardH, 2, 2, 'FD');

    let curByY = cardY + 4.8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Quotation by', frameX + 3.5, curByY);

    curByY += 4.2;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(byCompLines, frameX + 3.5, curByY);
    curByY += (byCompLines.length * 3.6) + 1.5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    pdf.setTextColor(71, 85, 105);
    pdf.text(byAddrLines, frameX + 3.5, curByY);
    curByY += (byAddrLines.length * 3.1) + 1.5;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.2);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`GSTIN: ${orgGstin}`, frameX + 3.5, curByY);
    curByY += 3.2;

    if (byContactLines.length) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(byContactLines, frameX + 3.5, curByY);
    }

    pdf.setFillColor(colorPalette.cardBg[0], colorPalette.cardBg[1], colorPalette.cardBg[2]);
    pdf.setDrawColor(colorPalette.cardBorder[0], colorPalette.cardBorder[1], colorPalette.cardBorder[2]);
    pdf.roundedRect(clientCardX, cardY, cardW, cardH, 2, 2, 'FD');

    let curToY = cardY + 4.8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Quotation to', clientCardX + 3.5, curToY);

    curToY += 4.2;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text(toClientLines, clientCardX + 3.5, curToY);
    curToY += (toClientLines.length * 3.6) + 1.5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.2);
    pdf.setTextColor(71, 85, 105);
    pdf.text(toAddrLines, clientCardX + 3.5, curToY);
    curToY += (toAddrLines.length * 3.1) + 1.5;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.2);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`GSTIN: ${toGstin}`, clientCardX + 3.5, curToY);
    curToY += 3.2;

    if (toContactLines.length) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(toContactLines, clientCardX + 3.5, curToY);
    }

    autoTable(pdf, {
      head: tableHeaders,
      body: tableRows,
      startY: cardY + cardH + 3,
      margin: { left: frameX, right: frameX, bottom: 25 },
      tableWidth: frameWidth,
      headStyles: {
        fillColor: colorPalette.headerFill,
        textColor: colorPalette.headerText,
        fontStyle: 'bold',
        fontSize: 6.8,
        halign: 'center',
        valign: 'middle',
        cellPadding: { top: 2.0, bottom: 2.0, left: 1.0, right: 1.0 },
      },
      bodyStyles: {
        fontSize: 7.0,
        textColor: [15, 23, 42],
        cellPadding: 1.8,
        valign: 'middle',
      },
      alternateRowStyles: {
        fillColor: colorPalette.altRow,
      },
      columnStyles,
      theme: 'grid',
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
    });

    // @ts-expect-error lastAutoTable is injected by plugin
    let afterTableY = pdf.lastAutoTable.finalY + 4;
    const requiredBottomH1_2 = (selectedThemeId === 'template-1') ? 66 : 56;
    if (afterTableY + requiredBottomH1_2 > 270) {
      pdf.addPage();
      afterTableY = topY + 6;
    }

    const termsW = frameWidth - 84;
    let curTermY = afterTableY + 2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
    pdf.text('Terms and Conditions', frameX, curTermY);
    curTermY += 4.5;

    curTermY = renderQuoteTermsWithHangingIndent(pdf, activeQuoteTerms, frameX, curTermY, termsW, {
      fontSize: 6.4,
      numWidth: 5.2,
      lineHeight: 2.9,
      itemGap: 1.1,
      numColor: [30, 41, 59],
      bodyColor: [71, 85, 105],
    });

    if (activeQuoteNotes) {
      curTermY += 2;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(colorPalette.cardHeaderText[0], colorPalette.cardHeaderText[1], colorPalette.cardHeaderText[2]);
      pdf.text('Additional Notes', frameX, curTermY);

      curTermY += 3.8;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      pdf.setTextColor(100, 116, 139);
      const noteLines = pdf.splitTextToSize(activeQuoteNotes.replace(/\n+/g, ' '), termsW);
      pdf.text(noteLines, frameX, curTermY);
      curTermY += (noteLines.length * 3.1);
    }

    const totalBoxW = 78;
    const totalBoxX = frameEndX - totalBoxW;
    const totalBoxY = afterTableY;
    const totalBoxH = 43;

    pdf.setFillColor(colorPalette.totalBg[0], colorPalette.totalBg[1], colorPalette.totalBg[2]);
    pdf.setDrawColor(colorPalette.cardBorder[0], colorPalette.cardBorder[1], colorPalette.cardBorder[2]);
    pdf.roundedRect(totalBoxX, totalBoxY, totalBoxW, totalBoxH, 2, 2, 'FD');

    let curTotalRowY = totalBoxY + 4.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.8);
    pdf.setTextColor(71, 85, 105);
    pdf.text('TOTAL AMOUNT BEFORE TAX :', totalBoxX + 3.5, curTotalRowY);
    pdf.text(`Rs. ${formatNumber(subtotalAll)}`, frameEndX - 3.5, curTotalRowY, { align: 'right' });

    curTotalRowY += 4.5;
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Add: CGST ${doc.tax.cgst || 9}% :`, totalBoxX + 3.5, curTotalRowY);
    pdf.text(`Rs. ${formatNumber(halfTaxAmount)}`, frameEndX - 3.5, curTotalRowY, { align: 'right' });

    curTotalRowY += 4.5;
    pdf.text(`Add: SGST ${doc.tax.sgst || 9}% :`, totalBoxX + 3.5, curTotalRowY);
    pdf.text(`Rs. ${formatNumber(halfTaxAmount)}`, frameEndX - 3.5, curTotalRowY, { align: 'right' });

    curTotalRowY += 4.5;
    pdf.text(`Add: IGST ${doc.tax.igst || 0}% :`, totalBoxX + 3.5, curTotalRowY);
    pdf.text(`Rs. ${formatNumber(t.igst || 0)}`, frameEndX - 3.5, curTotalRowY, { align: 'right' });

    curTotalRowY += 4.5;
    pdf.text('Round Off :', totalBoxX + 3.5, curTotalRowY);
    pdf.text(`Rs. ${roundOff >= 0 ? '+' : ''}${formatNumber(roundOff)}`, frameEndX - 3.5, curTotalRowY, { align: 'right' });

    curTotalRowY += 3;
    pdf.setDrawColor(colorPalette.cardBorder[0], colorPalette.cardBorder[1], colorPalette.cardBorder[2]);
    pdf.line(totalBoxX + 3, curTotalRowY, frameEndX - 3, curTotalRowY);

    curTotalRowY += 5.5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.8);
    pdf.setTextColor(colorPalette.totalText[0], colorPalette.totalText[1], colorPalette.totalText[2]);
    pdf.text('TOTAL AMOUNT AFTER TAX :', totalBoxX + 3.5, curTotalRowY);
    pdf.text(`Rs. ${formatNumber(roundedGrandTotal)}`, frameEndX - 3.5, curTotalRowY, { align: 'right' });

    let curWordsY = totalBoxY + totalBoxH + 4;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.2);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Invoice Total (in words):', totalBoxX, curWordsY);

    curWordsY += 3.6;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.8);
    pdf.setTextColor(71, 85, 105);
    const wordsLines = pdf.splitTextToSize(`${numberToWordsINR(roundedGrandTotal)}`, totalBoxW);
    pdf.text(wordsLines, totalBoxX, curWordsY);
    curWordsY += (wordsLines.length * 3.2);

    if (selectedThemeId === 'template-2') {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(
        'This quotation was generated electronically through Argus and requires no physical signature.',
        105,
        278,
        { align: 'center', maxWidth: frameWidth }
      );
    } else {
      const sigLineY = Math.min(270, Math.max(curWordsY + 15, curTermY + 10));
      if (orgSignature && orgSignature.startsWith('data:image')) {
        try {
          const sigFormat = orgSignature.includes('image/png') ? 'PNG' : 'JPEG';
          pdf.addImage(orgSignature, sigFormat, frameEndX - 44, sigLineY - 14, 38, 13, undefined, 'FAST');
        } catch {}
      }

      pdf.setDrawColor(148, 163, 184);
      pdf.setLineWidth(0.35);
      pdf.line(frameEndX - 50, sigLineY, frameEndX, sigLineY);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(30, 41, 59);
      pdf.text('Authorized Signature', frameEndX - 25, sigLineY + 4.5, { align: 'center' });
    }
  }

  // =========================================================================
  // --- SUBSEQUENT PAGES: DETAILED WORKINGS (1 DEDICATED PAGE PER PRODUCT) ---
  // =========================================================================
  if (withWorkings) {
    const productsWithWorkings = doc.lines.filter(l => calcLine(l).active && hasWorkings(l.workings));

    productsWithWorkings.forEach((prod, pIdx) => {
      pdf.addPage();
      const prodY = topY;
      const w = prod.workings!;
      const r = calcWorkings(w);
      const prodQty = Math.max(1, Number((prod.qty || '1').replace(/,/g, '')) || 1);

      // Header Bar on workings pages
      pdf.setDrawColor(30, 41, 59);
      pdf.setLineWidth(0.35);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`${displayCompanyName}  |  GSTIN : ${orgGstin}`, frameX + 2, prodY + 4.5);
      pdf.text(`Cell : ${orgPhones.join(', ')}`, frameEndX - 2, prodY + 4.5, { align: 'right' });

      pdf.line(frameX, prodY + 6.5, frameEndX, prodY + 6.5);

      // Product Header Banner
      pdf.setFillColor(218, 232, 248);
      pdf.rect(frameX, prodY + 6.5, frameWidth, 8.5, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`PRODUCT ${pIdx + 1}: ${(prod.description || 'QUOTED PRODUCT').toUpperCase()} (QTY: ${prodQty}) - DETAILED WORKINGS`, 105, prodY + 12, { align: 'center' });

      pdf.line(frameX, prodY + 15, frameEndX, prodY + 15);
      let currWorkingsY = prodY + 18;

      // Table 1: Metal Components & Raw Material (BOM)
      const validMaterials = (w.materials || []).filter(m => m.description.trim() || m.qty.trim() || m.rate.trim());
      if (validMaterials.length > 0) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(30, 41, 59);
        pdf.text('• Metal Components & Raw Material (BOM)', frameX + 2, currWorkingsY);
        currWorkingsY += 3;

        const bomHeaders = [['#', 'Component Description', 'Specification Details', 'Qty', 'Unit Rate', 'Total Cost']];
        const bomRows = validMaterials.map((x, idx) => {
          const q = Number((x.qty || '0').replace(/,/g, '')) || 0;
          const rateVal = Number((x.rate || '0').replace(/,/g, '')) || 0;
          const cost = rowCost(x) || 0;
          return [
            String(idx + 1),
            x.description || 'Metal Component',
            'Raw Material',
            `${q * prodQty} kg`,
            rateVal > 0 ? `Rs. ${formatNumber(rateVal)} / kg` : '-',
            cost > 0 ? `Rs. ${formatNumber(cost * prodQty)}` : '-',
          ];
        });

        autoTable(pdf, {
          head: bomHeaders,
          body: bomRows,
          startY: currWorkingsY,
          margin: { left: frameX, right: frameX },
          tableWidth: frameWidth,
          styles: { fontSize: 7, cellPadding: 1.8, lineColor: [30, 41, 59], lineWidth: 0.2 },
          headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7, lineColor: [30, 41, 59], lineWidth: 0.25 },
          theme: 'grid',
        });

        // @ts-expect-error lastAutoTable is injected by plugin
        currWorkingsY = pdf.lastAutoTable.finalY + 6;
      }

      // Table 2: Manufacturing & Machining Operations
      const validProcesses = (w.processes || []).filter(p => p.description.trim() || p.qty.trim() || p.rate.trim());
      if (validProcesses.length > 0) {
        if (currWorkingsY > 230) { pdf.addPage(); currWorkingsY = topY + 10; }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(30, 41, 59);
        pdf.text('• Manufacturing & Machining Operations', frameX + 2, currWorkingsY);
        currWorkingsY += 3;

        const processHeaders = [['#', 'Process / Operation Name', 'Duration / Quantity', 'Rate (Rs/unit)', 'Total Process Cost']];
        const processRows = validProcesses.map((pItem, idx) => {
          const q = Number((pItem.qty || '0').replace(/,/g, '')) || 0;
          const rateVal = Number((pItem.rate || '0').replace(/,/g, '')) || 0;
          const cost = rowCost(pItem) || 0;
          return [
            String(idx + 1),
            pItem.description || 'Operation',
            `${q * prodQty} units`,
            rateVal > 0 ? `Rs. ${formatNumber(rateVal)}` : '-',
            cost > 0 ? `Rs. ${formatNumber(cost * prodQty)}` : '-',
          ];
        });

        autoTable(pdf, {
          head: processHeaders,
          body: processRows,
          startY: currWorkingsY,
          margin: { left: frameX, right: frameX },
          tableWidth: frameWidth,
          styles: { fontSize: 7, cellPadding: 1.8, lineColor: [30, 41, 59], lineWidth: 0.2 },
          headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7, lineColor: [30, 41, 59], lineWidth: 0.25 },
          theme: 'grid',
        });

        // @ts-expect-error lastAutoTable is injected by plugin
        currWorkingsY = pdf.lastAutoTable.finalY + 6;
      }

      // Table 3: Bought-Out Hardware & Other Expenses
      const validOthers = (w.others || []).filter(o => o.description.trim() || o.qty.trim() || o.rate.trim());
      if (validOthers.length > 0) {
        if (currWorkingsY > 230) { pdf.addPage(); currWorkingsY = topY + 10; }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(30, 41, 59);
        pdf.text('• Bought-Out Hardware & Other Expenses', frameX + 2, currWorkingsY);
        currWorkingsY += 3;

        const miscHeaders = [['#', 'Expense / Hardware Item', 'Quantity', 'Unit Rate (Rs)', 'Total Amount']];
        const miscRows = validOthers.map((m, idx) => {
          const q = Number((m.qty || '0').replace(/,/g, '')) || 0;
          const rateVal = Number((m.rate || '0').replace(/,/g, '')) || 0;
          const cost = rowCost(m) || 0;
          return [
            String(idx + 1),
            m.description || 'Hardware Item',
            `${q * prodQty} pcs`,
            rateVal > 0 ? `Rs. ${formatNumber(rateVal)}` : '-',
            cost > 0 ? `Rs. ${formatNumber(cost * prodQty)}` : '-',
          ];
        });

        autoTable(pdf, {
          head: miscHeaders,
          body: miscRows,
          startY: currWorkingsY,
          margin: { left: frameX, right: frameX },
          tableWidth: frameWidth,
          styles: { fontSize: 7, cellPadding: 1.8, lineColor: [30, 41, 59], lineWidth: 0.2 },
          headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7, lineColor: [30, 41, 59], lineWidth: 0.25 },
          theme: 'grid',
        });

        // @ts-expect-error lastAutoTable is injected by plugin
        currWorkingsY = pdf.lastAutoTable.finalY + 6;
      }

      // Workings Summary Box
      const uMat = r.materials;
      const uProc = r.processes;
      const uMisc = r.others;
      const uProf = r.profit;
      const pGrand = r.total * prodQty;

      const sBoxW = 90;
      const sBoxH = 36;
      const sBoxX = frameEndX - sBoxW;
      const sBoxY = currWorkingsY;

      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(30, 41, 59);
      pdf.rect(sBoxX, sBoxY, sBoxW, sBoxH, 'FD');

      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(51, 65, 85);
      pdf.text('Materials (BOM):', sBoxX + 4, sBoxY + 6);
      pdf.text(`Rs. ${formatNumber(uMat * prodQty)}`, sBoxX + sBoxW - 4, sBoxY + 6, { align: 'right' });

      pdf.text('Processes / Machining:', sBoxX + 4, sBoxY + 11.5);
      pdf.text(`Rs. ${formatNumber(uProc * prodQty)}`, sBoxX + sBoxW - 4, sBoxY + 11.5, { align: 'right' });

      pdf.text('Other / Hardware Expenses:', sBoxX + 4, sBoxY + 17);
      pdf.text(`Rs. ${formatNumber(uMisc * prodQty)}`, sBoxX + sBoxW - 4, sBoxY + 17, { align: 'right' });

      pdf.text(`Profit Margin (${w.marginPct || 0}%):`, sBoxX + 4, sBoxY + 22.5);
      pdf.text(`Rs. ${formatNumber(uProf * prodQty)}`, sBoxX + sBoxW - 4, sBoxY + 22.5, { align: 'right' });

      pdf.line(sBoxX + 4, sBoxY + 25.5, sBoxX + sBoxW - 4, sBoxY + 25.5);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`Product Total (${prodQty} pcs):`, sBoxX + 4, sBoxY + 31.5);
      pdf.text(`Rs. ${formatNumber(pGrand)}`, sBoxX + sBoxW - 4, sBoxY + 31.5, { align: 'right' });

      // Outer border for workings page
      pdf.rect(frameX, topY, frameWidth, Math.max(sBoxY + sBoxH + 4, 260) - topY, 'S');
    });
  }

  // Footer on all pages
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text('Thank you for your business!', 105, 283.5, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text('Powered by arguscnc.com', 105, 288, { align: 'center' });

    pdf.setFontSize(7);
    pdf.text(`Page ${i} of ${pageCount}`, frameEndX, 288, { align: 'right' });
  }

  return pdf;
}

export async function downloadQuotePdf(
  doc: QuoteDoc,
  withWorkings: boolean,
  themeId: PdfThemeId | string = 'orange',
  seller?: QuoteSeller,
  templateId: string = 'template-1',
  targetClient?: QuoteClient
): Promise<string> {
  const filename = getQuotePdfFilename(doc, withWorkings, targetClient);
  const pdf = await buildQuotePdf(doc, withWorkings, themeId, seller, templateId, targetClient);
  pdf.save(filename);
  return filename;
}

export function exportQuoteCsv(doc: QuoteDoc) {
  const hasWorkingsItems = doc.lines.some(l => calcLine(l).active && hasWorkings(l.workings));
  const t = calcTotals(doc.lines, doc.tax);

  let rows: unknown[][] = [];

  if (hasWorkingsItems) {
    rows = [
      ['Product', 'Product Qty', 'Category', 'Item Label', 'Details', 'Line Qty/Duration', 'Unit Rate (INR)', 'Total Cost (INR)'],
    ];

    doc.lines.filter(l => calcLine(l).active).forEach(l => {
      const pQty = Math.max(1, Number((l.qty || '1').replace(/,/g, '')) || 1);
      const w = l.workings;

      if (w && hasWorkings(w)) {
        (w.materials || []).forEach(item => {
          const rateVal = Number((item.rate || '0').replace(/,/g, '')) || 0;
          const cost = (rowCost(item) || 0) * pQty;
          const qty = (Number((item.qty || '1').replace(/,/g, '')) || 1) * pQty;
          rows.push([
            l.description,
            pQty,
            'Metal Component',
            item.description || 'Raw Material',
            'Raw Material',
            `${qty} kg`,
            rateVal > 0 ? `Rs. ${formatNumber(rateVal)}/kg` : '-',
            `Rs. ${formatNumber(cost)}`,
          ]);
        });

        (w.processes || []).forEach(proc => {
          const rateVal = Number((proc.rate || '0').replace(/,/g, '')) || 0;
          const cost = (rowCost(proc) || 0) * pQty;
          const duration = (Number((proc.qty || '0').replace(/,/g, '')) || 0) * pQty;
          rows.push([
            l.description,
            pQty,
            'Process Operation',
            proc.description || 'Operation',
            'Labor/Machining',
            `${duration} units`,
            rateVal > 0 ? `Rs. ${formatNumber(rateVal)}/unit` : '-',
            `Rs. ${formatNumber(cost)}`,
          ]);
        });

        (w.others || []).forEach(item => {
          const rateVal = Number((item.rate || '0').replace(/,/g, '')) || 0;
          const cost = (rowCost(item) || 0) * pQty;
          const qty = (Number((item.qty || '1').replace(/,/g, '')) || 1) * pQty;
          rows.push([
            l.description,
            pQty,
            'Other Expense',
            item.description || 'Hardware Item',
            'Consumables/Other',
            `${qty} pcs`,
            rateVal > 0 ? `Rs. ${formatNumber(rateVal)}` : '-',
            `Rs. ${formatNumber(cost)}`,
          ]);
        });
      } else {
        const r = calcLine(l);
        rows.push([
          l.description,
          pQty,
          'Commercial Line',
          l.description,
          `HSN: ${l.hsn || '-'}`,
          `${pQty} ${l.unit || 'Nos'}`,
          `Rs. ${formatNumber(l.unitPrice || '0')}`,
          `Rs. ${formatNumber(r.amount)}`,
        ]);
      }
    });

    rows.push([]);
    rows.push(['', '', '', '', '', '', 'Total before tax', `Rs. ${formatNumber(t.subtotal)}`]);
    if (t.cgst) rows.push(['', '', '', '', '', '', `CGST ${doc.tax.cgst}%`, `Rs. ${formatNumber(t.cgst)}`]);
    if (t.sgst) rows.push(['', '', '', '', '', '', `SGST ${doc.tax.sgst}%`, `Rs. ${formatNumber(t.sgst)}`]);
    if (t.igst) rows.push(['', '', '', '', '', '', `IGST ${doc.tax.igst}%`, `Rs. ${formatNumber(t.igst)}`]);
    if (t.roundOff) rows.push(['', '', '', '', '', '', 'Round off', `Rs. ${t.roundOff >= 0 ? '+' : ''}${formatNumber(t.roundOff)}`]);
    rows.push(['', '', '', '', '', '', 'TOTAL AMOUNT', `Rs. ${formatNumber(t.total)}`]);
  } else {
    rows = [
      ['Quotation', doc.quoteNo],
      ['Date', dmy(doc.date)],
      ['Clients', doc.clients.map(c => c.name).join('; ')],
      [],
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
  }

  const primaryClient = doc.clients[0] || { name: 'Client' };
  const cleanClientName = (primaryClient.name || 'Client').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const rawNum = String(doc.quoteNo || '001').trim();
  const quoteNum = formatQuoteDisplayNumber(rawNum);
  exportCsv(`Quotation_${cleanClientName}_${quoteNum}`, rows);
}

export function quoteSummaryText(doc: QuoteDoc): string {
  const t = calcTotals(doc.lines, doc.tax);
  const items = doc.lines.filter(l => calcLine(l).active).map((l, i) => `${i + 1}. ${l.description || 'Item'} - ${l.qty} ${l.unit} x ${inr(calcLine(l).discountedUnit)} = ${inr(calcLine(l).amount)}`);
  return [`Quotation ${doc.quoteNo} (${dmy(doc.date)}) from ${doc.sellerName}`, '', ...items, '', `Total before tax: ${inr(t.subtotal)}`, `Total amount: ${inr(t.total)}`].join('\n');
}
