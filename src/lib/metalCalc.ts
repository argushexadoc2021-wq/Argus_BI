// Metal weight & material cost calculator — pure functions, no UI or database.
//
//   weight (kg) = cross-section area (mm²) × length (mm) ÷ 1,000,000 × density (g/cm³)
//
// Cross-section areas are theoretical (sharp corners): mill fillets, corner radii and rolling
// tolerances are not included, so a rolled section's real weight is usually slightly higher.

export type Unit = 'mm' | 'cm' | 'm' | 'in' | 'ft';
export const UNITS: Unit[] = ['mm', 'cm', 'm', 'in', 'ft'];
export const UNIT_TO_MM: Record<Unit, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };

export type PriceUnit = 'kg' | 'g' | 'tonne' | 'lb';
export const PRICE_UNITS: { id: PriceUnit; label: string }[] = [
  { id: 'kg', label: '/ kg' },
  { id: 'g', label: '/ g' },
  { id: 'tonne', label: '/ tonne' },
  { id: 'lb', label: '/ lb' },
];

export const LB_PER_KG = 2.2046226218;
/** Multiply a price quoted per <unit> by this to get the price per kg. */
const PRICE_TO_PER_KG: Record<PriceUnit, number> = { kg: 1, g: 1000, tonne: 1 / 1000, lb: LB_PER_KG };

export interface Material { id: string; name: string; density: number }
/** Standard engineering densities in g/cm³. */
export const MATERIALS: Material[] = [
  { id: 'steel', name: 'Steel (default)', density: 7.85 },
  { id: 'aluminum-1100', name: 'Aluminum 1100', density: 2.72 },
  { id: 'aluminum-2011', name: 'Aluminum 2011', density: 2.83 },
  { id: 'aluminum-2014', name: 'Aluminum 2014', density: 2.80 },
  { id: 'aluminum-2017', name: 'Aluminum 2017', density: 2.80 },
  { id: 'aluminum-2024', name: 'Aluminum 2024', density: 2.77 },
  { id: 'aluminum-3003', name: 'Aluminum 3003', density: 2.75 },
  { id: 'aluminum-5005', name: 'Aluminum 5005', density: 2.72 },
  { id: 'aluminum-5052', name: 'Aluminum 5052', density: 2.69 },
  { id: 'aluminum-5056', name: 'Aluminum 5056', density: 2.63 },
  { id: 'aluminum-5083', name: 'Aluminum 5083', density: 2.66 },
  { id: 'aluminum-5086', name: 'Aluminum 5086', density: 2.66 },
  { id: 'aluminum-6061', name: 'Aluminum 6061', density: 2.72 },
  { id: 'aluminum-6063', name: 'Aluminum 6063', density: 2.72 },
  { id: 'aluminum-7050', name: 'Aluminum 7050', density: 2.80 },
  { id: 'aluminum-7075', name: 'Aluminum 7075', density: 2.80 },
  { id: 'aluminum-7178', name: 'Aluminum 7178', density: 2.83 },
  { id: 'aluminium', name: 'Aluminium (General)', density: 2.70 },
  { id: 'stainless-300', name: 'Stainless 300 Series', density: 8.09 },
  { id: 'stainless-304', name: 'Stainless Steel 304', density: 7.93 },
  { id: 'stainless-316', name: 'Stainless Steel 316', density: 8.00 },
  { id: 'stainless-400', name: 'Stainless 400 Series', density: 7.93 },
  { id: 'nickel-200', name: 'Nickel 200', density: 8.89 },
  { id: 'nickel-400', name: 'Nickel 400', density: 8.83 },
  { id: 'nickel-r405', name: 'Nickel R-405', density: 8.80 },
  { id: 'nickel-k500', name: 'Nickel K-500', density: 8.44 },
  { id: 'nickel-600', name: 'Nickel 600', density: 8.42 },
  { id: 'nickel-625', name: 'Nickel 625', density: 8.44 },
  { id: 'nickel-800h', name: 'Nickel 800H', density: 7.94 },
  { id: 'nickel-800at', name: 'Nickel 800AT', density: 7.94 },
  { id: 'nickel-825', name: 'Nickel 825', density: 8.14 },
  { id: 'nickel-330', name: 'Nickel 330', density: 7.94 },
  { id: 'nickel-20', name: 'Nickel 20', density: 8.09 },
  { id: 'nickel-c276', name: 'Nickel C-276', density: 8.89 },
  { id: 'nickel-254smo', name: 'Nickel 254SMO', density: 7.94 },
  { id: 'nickel', name: 'Nickel (General)', density: 8.90 },
  { id: 'magnesium', name: 'Magnesium', density: 1.80 },
  { id: 'beryllium', name: 'Beryllium', density: 1.85 },
  { id: 'titanium', name: 'Titanium', density: 4.51 },
  { id: 'zirconium', name: 'Zirconium', density: 6.37 },
  { id: 'cast-iron', name: 'Cast Iron', density: 7.15 },
  { id: 'zinc', name: 'Zinc', density: 7.15 },
  { id: 'brass', name: 'Brass', density: 8.51 },
  { id: 'bronze', name: 'Bronze', density: 8.80 },
  { id: 'columbium', name: 'Columbium', density: 8.60 },
  { id: 'copper', name: 'Copper', density: 8.98 },
  { id: 'molybdenum', name: 'Molybdenum', density: 10.23 },
  { id: 'silver', name: 'Silver', density: 10.51 },
  { id: 'lead', name: 'Lead', density: 11.37 },
  { id: 'tantalum', name: 'Tantalum', density: 16.64 },
  { id: 'carbide-tungsten', name: 'Carbide / Tungsten Carbide (WC)', density: 14.80 },
  { id: 'carbide-silicon', name: 'Silicon Carbide (SiC)', density: 3.21 },
  { id: 'carbide-titanium', name: 'Titanium Carbide (TiC)', density: 4.93 },
  { id: 'tungsten', name: 'Tungsten', density: 19.33 },
  { id: 'gold', name: 'Gold', density: 19.36 },
  { id: 'platinum', name: 'Platinum', density: 21.45 },
  { id: 'palladium', name: 'Palladium', density: 12.02 },
];

/** Market benchmark rates in INR / kg (LME / MCX industry reference benchmarks) */
export const BENCHMARK_RATES_INR_KG: Record<string, number> = {
  'steel': 68.50,
  'aluminum-1100': 215.00,
  'aluminum-2011': 215.00,
  'aluminum-2014': 215.00,
  'aluminum-2017': 215.00,
  'aluminum-2024': 215.00,
  'aluminum-3003': 215.00,
  'aluminum-5005': 215.00,
  'aluminum-5052': 215.00,
  'aluminum-5056': 215.00,
  'aluminum-5083': 215.00,
  'aluminum-5086': 215.00,
  'aluminum-6061': 215.00,
  'aluminum-6063': 215.00,
  'aluminum-7050': 215.00,
  'aluminum-7075': 215.00,
  'aluminum-7178': 215.00,
  'aluminium': 215.00,
  'stainless-300': 320.00,
  'stainless-304': 285.00,
  'stainless-316': 395.00,
  'stainless-400': 190.00,
  'nickel-200': 1480.00,
  'nickel-400': 1480.00,
  'nickel-r405': 1480.00,
  'nickel-k500': 1480.00,
  'nickel-600': 1480.00,
  'nickel-625': 1480.00,
  'nickel-800h': 1480.00,
  'nickel-800at': 1480.00,
  'nickel-825': 1480.00,
  'nickel-330': 1480.00,
  'nickel-20': 1480.00,
  'nickel-c276': 1480.00,
  'nickel-254smo': 1480.00,
  'nickel': 1480.00,
  'magnesium': 260.00,
  'beryllium': 9500.00,
  'titanium': 850.00,
  'zirconium': 3100.00,
  'cast-iron': 55.00,
  'zinc': 235.00,
  'brass': 620.00,
  'bronze': 680.00,
  'columbium': 4200.00,
  'copper': 760.00,
  'molybdenum': 3200.00,
  'silver': 88000.00,
  'lead': 185.00,
  'tantalum': 18500.00,
  'carbide-tungsten': 3400.00,
  'carbide-silicon': 850.00,
  'carbide-titanium': 1200.00,
  'tungsten': 2900.00,
  'gold': 7450000.00,
  'platinum': 2850000.00,
  'palladium': 2650000.00,
};

/** Default machine shop process operations and rates from Quotation Suite */
export const DEFAULT_PROCESS_RATES = [
  { name: 'Laser Cutting', rate: 15.00, unit: 'Minute' },
  { name: 'CNC Milling / VMC', rate: 18.00, unit: 'Minute' },
  { name: 'CNC Turning / Lathe', rate: 12.00, unit: 'Minute' },
  { name: 'CNC Wirecut', rate: 15.00, unit: 'Minute' },
  { name: 'Welding (TIG/MIG)', rate: 14.00, unit: 'Minute' },
  { name: 'Bending / Press Brake', rate: 8.00, unit: 'Minute' },
  { name: 'Powder Coating / Paint', rate: 10.00, unit: 'Minute' },
  { name: 'Drilling / Tapping', rate: 10.00, unit: 'Minute' },
  { name: 'Surface Grinding', rate: 12.00, unit: 'Minute' }
];

/** Get the benchmark rate for a material, converted to the requested price unit */
export function getMaterialBenchmarkRate(materialId: string, unit: PriceUnit = 'kg'): number | null {
  const perKg = BENCHMARK_RATES_INR_KG[materialId];
  if (perKg == null) return null;
  switch (unit) {
    case 'kg': return perKg;
    case 'g': return Math.round((perKg / 1000) * 100) / 100;
    case 'tonne': return Math.round(perKg * 1000);
    case 'lb': return Math.round((perKg / LB_PER_KG) * 100) / 100;
    default: return perKg;
  }
}

export type ProfileId =
  | 'round-bar' | 'square-bar' | 'flat-bar' | 'hex-bar' | 'octagonal-bar'
  | 'round-tube' | 'square-tube' | 'rect-tube'
  | 'angle' | 'channel' | 't-profile' | 'i-beam' | 'ring';

export interface FieldSpec {
  key: string;
  label: string;
  /** Short tag used on the preview drawing. */
  short: string;
  /** Starting value, in mm. */
  default: string;
}

export interface ProfileSpec {
  id: ProfileId;
  name: string;
  /** Tag shown beside the picker. */
  chip: string;
  fields: FieldSpec[];
  lengthLabel: string;
  lengthDefault: string;
  /** Dimensions (all mm) drawn as the horizontal / vertical dimension lines of the preview. */
  dimLines: { horizontal?: string; vertical?: string };
  /** Cross-section area in mm² for dimensions already converted to mm. */
  area: (d: Record<string, number>) => number;
  /** A message when the dimensions cannot form this shape (e.g. wall thicker than the tube). */
  check: (d: Record<string, number>) => { key?: string; message: string } | null;
}

const PI = Math.PI;
const f = (key: string, label: string, short: string, def: string): FieldSpec => ({ key, label, short, default: def });

export const PROFILES: ProfileSpec[] = [
  {
    id: 'round-bar', name: 'Round Bar', chip: 'Round Bar',
    fields: [f('d', 'Diameter (D)', 'Ø', '50')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { horizontal: 'd' }, area: d => (PI / 4) * d.d ** 2, check: () => null,
  },
  {
    id: 'square-bar', name: 'Square Bar', chip: 'Square Bar',
    fields: [f('a', 'Side (A)', 'A', '50')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { horizontal: 'a', vertical: 'a' }, area: d => d.a ** 2, check: () => null,
  },
  {
    id: 'flat-bar', name: 'Flat Bar', chip: 'Flat Bar',
    fields: [f('w', 'Width (W)', 'W', '50'), f('t', 'Thickness (T)', 'T', '6')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { horizontal: 'w', vertical: 't' }, area: d => d.w * d.t, check: () => null,
  },
  {
    id: 'hex-bar', name: 'Hexagonal Bar', chip: 'Hexagonal Bar',
    fields: [f('s', 'Across Flats (S)', 'S', '30')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { vertical: 's' }, area: d => (Math.sqrt(3) / 2) * d.s ** 2, check: () => null,
  },
  {
    id: 'octagonal-bar', name: 'Octagonal Bar', chip: 'Octagonal Bar',
    fields: [f('s', 'Across Flats (S)', 'S', '30')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { horizontal: 's', vertical: 's' }, area: d => 2 * (Math.SQRT2 - 1) * d.s ** 2, check: () => null,
  },
  {
    id: 'round-tube', name: 'Round Tube', chip: 'Round Tube',
    fields: [f('d', 'Outer Diameter (D)', 'Ø', '60'), f('t', 'Wall Thickness (t)', 't', '3')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { horizontal: 'd' }, area: d => (PI / 4) * (d.d ** 2 - (d.d - 2 * d.t) ** 2),
    check: d => (2 * d.t >= d.d ? { key: 't', message: 'Wall thickness must be less than half the outer diameter' } : null),
  },
  {
    id: 'square-tube', name: 'Square Tube', chip: 'Square Tube',
    fields: [f('a', 'Side (A)', 'A', '50'), f('t', 'Wall Thickness (t)', 't', '3')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { horizontal: 'a', vertical: 'a' }, area: d => d.a ** 2 - (d.a - 2 * d.t) ** 2,
    check: d => (2 * d.t >= d.a ? { key: 't', message: 'Wall thickness must be less than half the side' } : null),
  },
  {
    id: 'rect-tube', name: 'Rectangular Tube', chip: 'Rectangular Tube',
    fields: [f('h', 'Height (H)', 'H', '60'), f('b', 'Width (B)', 'B', '40'), f('t', 'Wall Thickness (t)', 't', '3')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { horizontal: 'b', vertical: 'h' }, area: d => d.h * d.b - (d.h - 2 * d.t) * (d.b - 2 * d.t),
    check: d => (2 * d.t >= Math.min(d.h, d.b) ? { key: 't', message: 'Wall thickness must be less than half the shorter side' } : null),
  },
  {
    id: 'angle', name: 'Angle (L-profile)', chip: 'Angle (L-profile)',
    fields: [f('a', 'Leg A (horizontal)', 'A', '50'), f('b', 'Leg B (vertical)', 'B', '50'), f('t', 'Thickness (t)', 't', '5')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { horizontal: 'a', vertical: 'b' }, area: d => d.t * (d.a + d.b - d.t),
    check: d => (d.t >= Math.min(d.a, d.b) ? { key: 't', message: 'Thickness must be less than the shorter leg' } : null),
  },
  {
    id: 'channel', name: 'Channel (U-profile)', chip: 'Channel (U-profile)',
    fields: [f('h', 'Height (H)', 'H', '100'), f('b', 'Flange Width (B)', 'B', '50'), f('tf', 'Flange Thickness (Tf)', 'Tf', '8'), f('tw', 'Web Thickness (Tw)', 'Tw', '5')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { horizontal: 'b', vertical: 'h' }, area: d => 2 * d.b * d.tf + (d.h - 2 * d.tf) * d.tw,
    check: d =>
      2 * d.tf >= d.h ? { key: 'tf', message: 'Two flange thicknesses must be less than the height' }
      : d.tw >= d.b ? { key: 'tw', message: 'Web thickness must be less than the flange width' } : null,
  },
  {
    id: 't-profile', name: 'T-profile', chip: 'T-profile',
    fields: [f('b', 'Flange Width (B)', 'B', '50'), f('h', 'Height (H)', 'H', '50'), f('tf', 'Flange Thickness (Tf)', 'Tf', '6'), f('tw', 'Web Thickness (Tw)', 'Tw', '6')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { horizontal: 'b', vertical: 'h' }, area: d => d.b * d.tf + (d.h - d.tf) * d.tw,
    check: d =>
      d.tf >= d.h ? { key: 'tf', message: 'Flange thickness must be less than the height' }
      : d.tw >= d.b ? { key: 'tw', message: 'Web thickness must be less than the flange width' } : null,
  },
  {
    id: 'i-beam', name: 'I-beam', chip: 'I-beam / H-beam',
    fields: [f('h', 'Height (H)', 'H', '150'), f('w', 'Flange Width (W)', 'W', '75'), f('tf', 'Flange Thickness (Tf)', 'Tf', '8'), f('tw', 'Web Thickness (Tw)', 'Tw', '6')], lengthLabel: 'Length (L)', lengthDefault: '1000',
    dimLines: { horizontal: 'w', vertical: 'h' }, area: d => 2 * d.w * d.tf + (d.h - 2 * d.tf) * d.tw,
    check: d =>
      2 * d.tf >= d.h ? { key: 'tf', message: 'Two flange thicknesses must be less than the height' }
      : d.tw >= d.w ? { key: 'tw', message: 'Web thickness must be less than the flange width' } : null,
  },
  {
    id: 'ring', name: 'Ring', chip: 'Ring',
    fields: [f('od', 'Outer Diameter (OD)', 'OD', '100'), f('id', 'Inner Diameter (ID)', 'ID', '60')], lengthLabel: 'Thickness (T)', lengthDefault: '20',
    dimLines: { horizontal: 'od' }, area: d => (PI / 4) * (d.od ** 2 - d.id ** 2),
    check: d => (d.id >= d.od ? { key: 'id', message: 'Inner diameter must be less than the outer diameter' } : null),
  },
];

export const PROFILE_BY_ID: Record<ProfileId, ProfileSpec> = Object.fromEntries(PROFILES.map(p => [p.id, p])) as Record<ProfileId, ProfileSpec>;

export const LENGTH_KEY = 'length';

export interface DimValue { value: string; unit: Unit }
export type DimMap = Record<string, DimValue>;

export function defaultDims(profile: ProfileSpec, unit: Unit = 'mm'): DimMap {
  const m: DimMap = {};
  for (const fl of profile.fields) m[fl.key] = { value: fl.default, unit: 'mm' };
  m[LENGTH_KEY] = { value: profile.lengthDefault, unit: 'mm' };
  return unit === 'mm' ? m : convertDims(m, unit);
}

/**
 * Converting into inches or feet keeps 6 decimals so that converting back to mm returns the
 * original number (e.g. 8 mm -> 0.314961 in -> 8 mm) instead of drifting to 8.001.
 */
const trimFor = (n: number, to: Unit) => String(Number(n.toFixed(to === 'mm' || to === 'cm' ? 4 : 6)));

/** Re-express every filled-in dimension in another unit, keeping the physical size. */
export function convertDims(dims: DimMap, to: Unit): DimMap {
  const out: DimMap = {};
  for (const [k, v] of Object.entries(dims)) {
    const n = Number(v.value.trim().replace(/,/g, ''));
    out[k] = v.value.trim() !== '' && Number.isFinite(n)
      ? { value: trimFor((n * UNIT_TO_MM[v.unit]) / UNIT_TO_MM[to], to), unit: to }
      : { value: v.value, unit: to };
  }
  return out;
}

export interface CalcInput {
  profile: ProfileId;
  dims: DimMap;
  density: string;
  qty: string;
  price: string;
  priceUnit: PriceUnit;
}

export interface CalcResult {
  qty: number;
  areaMm2: number;
  volumeCm3Piece: number;
  volumeCm3Total: number;
  weightKgPiece: number;
  weightKgTotal: number;
  weightLbs: number;
  weightG: number;
  weightTonnes: number;
  density: number;
  /** Present only when a price was entered. */
  cost?: { perKgRate: number; piece: number; total: number };
}

export interface FieldIssue { key?: string; message: string }
export type CalcOutcome =
  | { status: 'incomplete'; missing: string[] }
  | { status: 'error'; issues: FieldIssue[] }
  | { status: 'ok'; result: CalcResult };

type Parsed = { kind: 'empty' } | { kind: 'bad' } | { kind: 'num'; n: number };
function parse(s: string): Parsed {
  const t = s.trim().replace(/,/g, '');
  if (t === '') return { kind: 'empty' };
  const n = Number(t);
  return Number.isFinite(n) ? { kind: 'num', n } : { kind: 'bad' };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calculate(input: CalcInput): CalcOutcome {
  const profile = PROFILE_BY_ID[input.profile];
  const issues: FieldIssue[] = [];
  const missing: string[] = [];
  const mm: Record<string, number> = {};

  const positive = (key: string, label: string, raw: string, factor = 1): number | null => {
    const p = parse(raw);
    if (p.kind === 'empty') { missing.push(label); return null; }
    if (p.kind === 'bad' || p.n <= 0) { issues.push({ key, message: `${label} must be a number greater than 0` }); return null; }
    return p.n * factor;
  };

  for (const fl of profile.fields) {
    const dv = input.dims[fl.key] ?? { value: '', unit: 'mm' as Unit };
    const v = positive(fl.key, fl.label, dv.value, UNIT_TO_MM[dv.unit]);
    if (v !== null) mm[fl.key] = v;
  }
  const lv = input.dims[LENGTH_KEY] ?? { value: '', unit: 'mm' as Unit };
  const lengthMm = positive(LENGTH_KEY, profile.lengthLabel, lv.value, UNIT_TO_MM[lv.unit]);
  const density = positive('density', 'Density', input.density);

  let qty = 1;
  const qp = parse(input.qty);
  if (qp.kind === 'empty') missing.push('Quantity');
  else if (qp.kind === 'bad' || qp.n < 1 || !Number.isInteger(qp.n)) issues.push({ key: 'qty', message: 'Quantity must be a whole number, 1 or more' });
  else if (qp.n > 1e9) issues.push({ key: 'qty', message: 'Quantity is too large' });
  else qty = qp.n;

  let ratePerKg: number | null = null;
  const pp = parse(input.price);
  if (pp.kind === 'bad' || (pp.kind === 'num' && pp.n < 0)) issues.push({ key: 'price', message: 'Price must be a number, 0 or more' });
  else if (pp.kind === 'num' && pp.n > 0) ratePerKg = pp.n * PRICE_TO_PER_KG[input.priceUnit];

  if (issues.length) return { status: 'error', issues };
  if (missing.length) return { status: 'incomplete', missing };

  const logical = profile.check(mm);
  if (logical) return { status: 'error', issues: [logical] };

  const areaMm2 = profile.area(mm);
  const volumeCm3Piece = (areaMm2 * (lengthMm as number)) / 1000;
  const weightKgPiece = (volumeCm3Piece * (density as number)) / 1000;
  if (!(areaMm2 > 0) || !Number.isFinite(weightKgPiece)) {
    return { status: 'error', issues: [{ message: 'These dimensions do not give a valid cross-section' }] };
  }
  const weightKgTotal = weightKgPiece * qty;

  return {
    status: 'ok',
    result: {
      qty, areaMm2, volumeCm3Piece, volumeCm3Total: volumeCm3Piece * qty,
      weightKgPiece, weightKgTotal,
      weightLbs: weightKgTotal * LB_PER_KG, weightG: weightKgTotal * 1000, weightTonnes: weightKgTotal / 1000,
      density: density as number,
      cost: ratePerKg === null ? undefined : {
        perKgRate: ratePerKg,
        piece: round2(weightKgPiece * ratePerKg),
        total: round2(weightKgTotal * ratePerKg),
      },
    },
  };
}
