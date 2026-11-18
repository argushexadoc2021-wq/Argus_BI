import {
  Circle,
  Square,
  RectangleHorizontal,
  Hexagon,
  Octagon,
  CircleDot,
  CornerDownRight,
  AlignJustify,
  Type,
  Columns,
} from 'lucide-react';
import { LENGTH_KEY, type DimMap, type ProfileId, type ProfileSpec } from '@/lib/metalCalc';

function dimText(dims: DimMap, key: string, fallbackSymbol: string): string {
  const entry = dims[key];
  if (!entry) return fallbackSymbol;
  const raw = entry.value.trim();
  const num = Number(raw.replace(/,/g, ''));
  if (raw !== '' && Number.isFinite(num) && num > 0) {
    return `${raw} ${entry.unit}`;
  }
  return fallbackSymbol;
}

/**
 * Exact 3D isometric SVG Component Previews matching Metal-Calculator-And-Quotation-Suite,
 * with live entered dimension values + units (e.g. "1000 mm", "100 mm", "10 mm")
 * and focus/hover highlighting on the active dimension group.
 */
export function ProfilePreview({
  profile,
  dims,
  activeDim = null,
}: {
  profile: ProfileSpec;
  dims: DimMap;
  activeDim?: string | null;
}) {
  const id = profile.id;

  const grpClass = (key: string) =>
    activeDim === key
      ? 'transition-all duration-150 opacity-100 drop-shadow-[0_0_4px_rgba(234,88,12,0.55)]'
      : activeDim
      ? 'transition-all duration-150 opacity-45'
      : 'transition-all duration-150 opacity-100';

  const lineCls = (key: string) => (activeDim === key ? 'stroke-orange-600' : 'stroke-orange-500');
  const lineW = (key: string) => (activeDim === key ? 2.4 : 1.5);
  const arrowCls = (key: string) => (activeDim === key ? 'fill-orange-600' : 'fill-orange-500');
  const textCls = (key: string) =>
    activeDim === key
      ? 'fill-orange-700 font-extrabold text-[11px]'
      : 'fill-orange-600 font-bold text-[10px]';

  // Slightly expanded viewBox so live value+unit labels ("1000 mm", "100 mm") never clip on edges
  const VB = '-24 -6 258 212';

  return (
    <div className="w-full max-w-[260px] h-[200px] flex items-center justify-center my-auto select-none">
      {id === 'round-bar' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="Round Bar preview" xmlns="http://www.w3.org/2000/svg">
          <path d="M 40,60 L 140,60 M 40,140 L 140,140" className="stroke-slate-300" strokeWidth="1.5" strokeDasharray="4,4" />
          <path d="M 40,60 C 20,60 20,140 40,140 C 60,140 60,60 40,60" className="fill-slate-100 stroke-slate-400" strokeWidth="2" />
          <path d="M 40,60 L 160,60 M 40,140 L 160,140" className="stroke-slate-600" strokeWidth="2" />
          <path d="M 160,60 C 145,60 145,140 160,140 C 175,140 175,60 160,60 Z" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('d')}>
            <line x1="160" y1="60" x2="160" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="180" y1="60" x2="180" y2="140" className={lineCls('d')} strokeWidth={lineW('d')} />
            <polygon points="180,60 177,66 183,66" className={arrowCls('d')} />
            <polygon points="180,140 177,134 183,134" className={arrowCls('d')} />
            <text x="186" y="104" className={textCls('d')} textAnchor="start">{dimText(dims, 'd', 'd')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="40" y1="140" x2="40" y2="165" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="140" x2="160" y2="165" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="40" y1="160" x2="160" y2="160" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="40,160 46,157 46,163" className={arrowCls(LENGTH_KEY)} />
            <polygon points="160,160 154,157 154,163" className={arrowCls(LENGTH_KEY)} />
            <text x="100" y="177" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 'square-bar' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="Square Bar preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="45,65 145,45 145,125 45,145" className="fill-slate-100 stroke-slate-500" strokeWidth="1.5" />
          <polygon points="145,45 165,55 165,135 145,125" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="45,145 145,125 165,135 65,155" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('a')}>
            <line x1="45" y1="145" x2="30" y2="138" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="65" y1="155" x2="50" y2="148" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="33" y1="140" x2="49" y2="148" className={lineCls('a')} strokeWidth={lineW('a')} />
            <polygon points="33,140 39,139 37,144" className={arrowCls('a')} />
            <polygon points="49,148 43,149 45,144" className={arrowCls('a')} />
            <text x="34" y="164" className={textCls('a')} textAnchor="middle">{dimText(dims, 'a', 'w')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="45" y1="65" x2="35" y2="61" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="145" y1="45" x2="135" y2="41" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="38" y1="62" x2="138" y2="42" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="38,62 44,59 45,64" className={arrowCls(LENGTH_KEY)} />
            <polygon points="138,42 132,45 131,40" className={arrowCls(LENGTH_KEY)} />
            <text x="88" y="40" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 'flat-bar' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="Flat Bar preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="35,85 135,65 135,115 35,135" className="fill-slate-100 stroke-slate-500" strokeWidth="1.5" />
          <polygon points="135,65 165,75 165,125 135,115" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="35,135 135,115 165,125 65,145" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('t')}>
            <line x1="165" y1="75" x2="178" y2="79" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="165" y1="125" x2="178" y2="129" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="174" y1="78" x2="174" y2="128" className={lineCls('t')} strokeWidth={lineW('t')} />
            <polygon points="174,78 171,84 177,84" className={arrowCls('t')} />
            <polygon points="174,128 171,122 177,122" className={arrowCls('t')} />
            <text x="182" y="106" className={textCls('t')} textAnchor="start">{dimText(dims, 't', 't')}</text>
          </g>
          <g className={grpClass('w')}>
            <line x1="35" y1="135" x2="20" y2="128" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="65" y1="145" x2="50" y2="138" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="130" x2="49" y2="140" className={lineCls('w')} strokeWidth={lineW('w')} />
            <polygon points="23,130 29,129 27,134" className={arrowCls('w')} />
            <polygon points="49,140 43,141 45,136" className={arrowCls('w')} />
            <text x="26" y="155" className={textCls('w')} textAnchor="middle">{dimText(dims, 'w', 'w')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="35" y1="85" x2="25" y2="81" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="135" y1="65" x2="125" y2="61" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="28" y1="82" x2="128" y2="62" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="28,82 34,79 35,84" className={arrowCls(LENGTH_KEY)} />
            <polygon points="128,62 122,65 121,60" className={arrowCls(LENGTH_KEY)} />
            <text x="78" y="58" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 'hex-bar' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="Hexagonal Bar preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="30,85 130,55 130,105 30,135" className="fill-slate-100 stroke-slate-500" strokeWidth="1.5" strokeDasharray="3,3" />
          <polygon points="130,55 145,40 165,50 165,110 145,125 130,105" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="30,135 130,105 145,125 45,155" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('s')}>
            <line x1="145" y1="125" x2="165" y2="110" className={lineCls('s')} strokeWidth={lineW('s')} />
            <polygon points="145,125 151,123 148,120" className={arrowCls('s')} />
            <polygon points="165,110 159,112 162,115" className={arrowCls('s')} />
            <text x="162" y="131" className={textCls('s')} textAnchor="start">{dimText(dims, 's', 's')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="30" y1="135" x2="20" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="130" y1="105" x2="120" y2="101" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="132" x2="123" y2="102" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="23,132 29,129 30,134" className={arrowCls(LENGTH_KEY)} />
            <polygon points="123,102 117,105 116,100" className={arrowCls(LENGTH_KEY)} />
            <text x="73" y="106" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 'octagonal-bar' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="Octagonal Bar preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="135,40 155,48 165,65 165,95 155,112 135,120 120,105 120,55" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <path d="M 30,70 L 120,55 M 30,120 L 120,105" className="stroke-slate-300" strokeWidth="1.5" strokeDasharray="3,3" />
          <polygon points="30,120 120,105 135,120 45,135" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('s')}>
            <line x1="120" y1="55" x2="120" y2="105" className={lineCls('s')} strokeWidth={lineW('s')} />
            <polygon points="120,55 117,61 123,61" className={arrowCls('s')} />
            <polygon points="120,105 117,99 123,99" className={arrowCls('s')} />
            <text x="112" y="84" className={textCls('s')} textAnchor="end">{dimText(dims, 's', 's')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="30" y1="120" x2="20" y2="116" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="105" x2="110" y2="101" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="117" x2="113" y2="102" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="23,117 29,114 30,119" className={arrowCls(LENGTH_KEY)} />
            <polygon points="113,102 107,105 106,100" className={arrowCls(LENGTH_KEY)} />
            <text x="68" y="99" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 'round-tube' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="Round Tube preview" xmlns="http://www.w3.org/2000/svg">
          <path d="M 40,60 L 140,60 M 40,140 L 140,140" className="stroke-slate-300" strokeWidth="1.5" strokeDasharray="4,4" />
          <path d="M 40,60 L 160,60 M 40,140 L 160,140" className="stroke-slate-600" strokeWidth="2" />
          <path d="M 160,60 C 145,60 145,140 160,140 C 175,140 175,60 160,60 Z" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <path d="M 160,75 C 150,75 150,125 160,125 C 170,125 170,75 160,75 Z" className="fill-white stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('d')}>
            <line x1="160" y1="60" x2="160" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="180" y1="60" x2="180" y2="140" className={lineCls('d')} strokeWidth={lineW('d')} />
            <polygon points="180,60 177,66 183,66" className={arrowCls('d')} />
            <polygon points="180,140 177,134 183,134" className={arrowCls('d')} />
            <text x="186" y="104" className={textCls('d')} textAnchor="start">{dimText(dims, 'd', 'd')}</text>
          </g>
          <g className={grpClass('t')}>
            <line x1="160" y1="60" x2="140" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="75" x2="140" y2="55" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="140" y1="40" x2="140" y2="55" className={lineCls('t')} strokeWidth={lineW('t')} />
            <polygon points="140,40 137,45 143,45" className={arrowCls('t')} />
            <polygon points="140,55 137,50 143,50" className={arrowCls('t')} />
            <text x="134" y="49" className={textCls('t')} textAnchor="end">{dimText(dims, 't', 't')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="40" y1="140" x2="40" y2="165" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="140" x2="160" y2="165" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="40" y1="160" x2="160" y2="160" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="40,160 46,157 46,163" className={arrowCls(LENGTH_KEY)} />
            <polygon points="160,160 154,157 154,163" className={arrowCls(LENGTH_KEY)} />
            <text x="100" y="177" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 'square-tube' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="Square Tube preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="135,45 165,55 165,135 135,125" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="140,55 160,62 160,127 140,120" className="fill-white stroke-slate-500" strokeWidth="1.5" />
          <polygon points="45,145 135,125 165,135 65,155" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('a')}>
            <line x1="45" y1="145" x2="30" y2="138" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="65" y1="155" x2="50" y2="148" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="33" y1="140" x2="49" y2="148" className={lineCls('a')} strokeWidth={lineW('a')} />
            <polygon points="33,140 39,139 37,144" className={arrowCls('a')} />
            <polygon points="49,148 43,149 45,144" className={arrowCls('a')} />
            <text x="31" y="164" className={textCls('a')} textAnchor="middle">{dimText(dims, 'a', 'w')}</text>
          </g>
          <g className={grpClass('t')}>
            <line x1="135" y1="125" x2="135" y2="142" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="140" y1="120" x2="140" y2="137" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="135" y1="139" x2="140" y2="135" className={lineCls('t')} strokeWidth={lineW('t')} />
            <polygon points="135,139 140,137 139,141" className={arrowCls('t')} />
            <polygon points="140,135 135,137 136,133" className={arrowCls('t')} />
            <text x="148" y="147" className={textCls('t')} textAnchor="start">{dimText(dims, 't', 't')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="45" y1="65" x2="35" y2="61" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="135" y1="45" x2="125" y2="41" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="38" y1="62" x2="138" y2="42" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="38,62 44,59 45,64" className={arrowCls(LENGTH_KEY)} />
            <polygon points="138,42 132,45 131,40" className={arrowCls(LENGTH_KEY)} />
            <text x="88" y="39" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 'rect-tube' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="Rectangular Tube preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="125,35 165,55 165,145 125,125" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="130,48 160,63 160,135 130,120" className="fill-white stroke-slate-500" strokeWidth="1.5" />
          <polygon points="25,135 125,125 165,145 65,155" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('h')}>
            <line x1="165" y1="55" x2="182" y2="55" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="165" y1="145" x2="182" y2="145" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="178" y1="55" x2="178" y2="145" className={lineCls('h')} strokeWidth={lineW('h')} />
            <polygon points="178,55 175,61 181,61" className={arrowCls('h')} />
            <polygon points="178,145 175,139 181,139" className={arrowCls('h')} />
            <text x="184" y="104" className={textCls('h')} textAnchor="start">{dimText(dims, 'h', 'h')}</text>
          </g>
          <g className={grpClass('b')}>
            <line x1="125" y1="125" x2="115" y2="135" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="165" y1="145" x2="155" y2="155" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="117" y1="133" x2="157" y2="153" className={lineCls('b')} strokeWidth={lineW('b')} />
            <polygon points="117,133 123,131 121,136" className={arrowCls('b')} />
            <polygon points="157,153 151,155 153,150" className={arrowCls('b')} />
            <text x="135" y="167" className={textCls('b')} textAnchor="start">{dimText(dims, 'b', 'w')}</text>
          </g>
          <g className={grpClass('t')}>
            <line x1="125" y1="125" x2="125" y2="110" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="130" y1="120" x2="130" y2="105" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="125" y1="108" x2="130" y2="108" className={lineCls('t')} strokeWidth={lineW('t')} />
            <text x="122" y="100" className={textCls('t')} textAnchor="end">{dimText(dims, 't', 't')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="25" y1="135" x2="15" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="125" y1="125" x2="115" y2="121" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="18" y1="132" x2="118" y2="122" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="18,132 24,129 25,134" className={arrowCls(LENGTH_KEY)} />
            <polygon points="118,122 112,125 111,120" className={arrowCls(LENGTH_KEY)} />
            <text x="64" y="120" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 'angle' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="Angle L-profile preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="120,40 140,40 140,110 160,110 160,125 120,125" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="30,135 120,125 160,125 70,135" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('a')}>
            <line x1="120" y1="40" x2="105" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="125" x2="105" y2="125" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="108" y1="40" x2="108" y2="125" className={lineCls('a')} strokeWidth={lineW('a')} />
            <polygon points="108,40 105,46 111,46" className={arrowCls('a')} />
            <polygon points="108,125 105,119 111,119" className={arrowCls('a')} />
            <text x="100" y="86" className={textCls('a')} textAnchor="end">{dimText(dims, 'a', 'w')}</text>
          </g>
          <g className={grpClass('b')}>
            <line x1="120" y1="125" x2="120" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="125" x2="160" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="137" x2="160" y2="137" className={lineCls('b')} strokeWidth={lineW('b')} />
            <polygon points="120,137 126,134 126,140" className={arrowCls('b')} />
            <polygon points="160,137 154,134 154,140" className={arrowCls('b')} />
            <text x="140" y="152" className={textCls('b')} textAnchor="middle">{dimText(dims, 'b', 'h')}</text>
          </g>
          <g className={grpClass('t')}>
            <line x1="120" y1="40" x2="120" y2="28" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="140" y1="40" x2="140" y2="28" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="31" x2="140" y2="31" className={lineCls('t')} strokeWidth={lineW('t')} />
            <text x="130" y="23" className={textCls('t')} textAnchor="middle">{dimText(dims, 't', 't')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="30" y1="135" x2="20" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="125" x2="110" y2="121" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="132" x2="113" y2="122" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="23,132 29,129 30,134" className={arrowCls(LENGTH_KEY)} />
            <polygon points="113,122 107,125 106,120" className={arrowCls(LENGTH_KEY)} />
            <text x="64" y="120" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 'channel' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="Channel U-profile preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="120,40 160,40 160,55 135,55 135,110 160,110 160,125 120,125" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('h')}>
            <line x1="120" y1="40" x2="105" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="125" x2="105" y2="125" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="108" y1="40" x2="108" y2="125" className={lineCls('h')} strokeWidth={lineW('h')} />
            <polygon points="108,40 105,46 111,46" className={arrowCls('h')} />
            <polygon points="108,125 105,119 111,119" className={arrowCls('h')} />
            <text x="100" y="86" className={textCls('h')} textAnchor="end">{dimText(dims, 'h', 'H')}</text>
          </g>
          <g className={grpClass('b')}>
            <line x1="120" y1="125" x2="120" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="125" x2="160" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="137" x2="160" y2="137" className={lineCls('b')} strokeWidth={lineW('b')} />
            <polygon points="120,137 126,134 126,140" className={arrowCls('b')} />
            <polygon points="160,137 154,134 154,140" className={arrowCls('b')} />
            <text x="140" y="152" className={textCls('b')} textAnchor="middle">{dimText(dims, 'b', 'W')}</text>
          </g>
          <g className={grpClass('tf')}>
            <line x1="120" y1="40" x2="120" y2="28" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="135" y1="40" x2="135" y2="28" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="31" x2="135" y2="31" className={lineCls('tf')} strokeWidth={lineW('tf')} />
            <text x="127" y="23" className={textCls('tf')} textAnchor="middle">{dimText(dims, 'tf', 'T')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="30" y1="135" x2="20" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="125" x2="110" y2="121" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="132" x2="113" y2="122" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="23,132 29,129 30,134" className={arrowCls(LENGTH_KEY)} />
            <polygon points="113,122 107,125 106,120" className={arrowCls(LENGTH_KEY)} />
            <text x="64" y="120" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 't-profile' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="T-profile preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="110,40 160,40 160,55 142,55 142,125 128,125 128,55 110,55" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('b')}>
            <line x1="110" y1="40" x2="110" y2="25" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="40" x2="160" y2="25" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="110" y1="28" x2="160" y2="28" className={lineCls('b')} strokeWidth={lineW('b')} />
            <polygon points="110,28 116,25 116,31" className={arrowCls('b')} />
            <polygon points="160,28 154,25 154,31" className={arrowCls('b')} />
            <text x="135" y="20" className={textCls('b')} textAnchor="middle">{dimText(dims, 'b', 'W')}</text>
          </g>
          <g className={grpClass('h')}>
            <line x1="160" y1="40" x2="175" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="125" x2="175" y2="125" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="172" y1="40" x2="172" y2="125" className={lineCls('h')} strokeWidth={lineW('h')} />
            <polygon points="172,40 169,46 175,46" className={arrowCls('h')} />
            <polygon points="172,125 169,119 175,119" className={arrowCls('h')} />
            <text x="179" y="86" className={textCls('h')} textAnchor="start">{dimText(dims, 'h', 'H')}</text>
          </g>
          <g className={grpClass('tf')}>
            <line x1="110" y1="40" x2="95" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="110" y1="55" x2="95" y2="55" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="98" y1="40" x2="98" y2="55" className={lineCls('tf')} strokeWidth={lineW('tf')} />
            <text x="90" y="51" className={textCls('tf')} textAnchor="end">{dimText(dims, 'tf', 'T')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="30" y1="135" x2="20" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="128" y1="125" x2="118" y2="121" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="132" x2="121" y2="122" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="23,132 29,129 30,134" className={arrowCls(LENGTH_KEY)} />
            <polygon points="121,122 115,125 114,120" className={arrowCls(LENGTH_KEY)} />
            <text x="68" y="120" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 'i-beam' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="I-beam preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="110,40 160,40 160,55 142,55 142,110 160,110 160,125 110,125 110,110 128,110 128,55 110,55" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <g className={grpClass('h')}>
            <line x1="160" y1="40" x2="175" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="125" x2="175" y2="125" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="172" y1="40" x2="172" y2="125" className={lineCls('h')} strokeWidth={lineW('h')} />
            <polygon points="172,40 169,46 175,46" className={arrowCls('h')} />
            <polygon points="172,125 169,119 175,119" className={arrowCls('h')} />
            <text x="179" y="86" className={textCls('h')} textAnchor="start">{dimText(dims, 'h', 'H')}</text>
          </g>
          <g className={grpClass('w')}>
            <line x1="110" y1="125" x2="110" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="125" x2="160" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="110" y1="137" x2="160" y2="137" className={lineCls('w')} strokeWidth={lineW('w')} />
            <polygon points="110,137 116,134 116,140" className={arrowCls('w')} />
            <polygon points="160,137 154,134 154,140" className={arrowCls('w')} />
            <text x="135" y="152" className={textCls('w')} textAnchor="middle">{dimText(dims, 'w', 'W')}</text>
          </g>
          <g className={grpClass('tf')}>
            <line x1="110" y1="40" x2="95" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="110" y1="55" x2="95" y2="55" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="98" y1="40" x2="98" y2="55" className={lineCls('tf')} strokeWidth={lineW('tf')} />
            <text x="90" y="51" className={textCls('tf')} textAnchor="end">{dimText(dims, 'tf', 'Tf')}</text>
          </g>
          <g className={grpClass('tw')}>
            <line x1="128" y1="80" x2="128" y2="65" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="142" y1="80" x2="142" y2="65" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="128" y1="68" x2="142" y2="68" className={lineCls('tw')} strokeWidth={lineW('tw')} />
            <text x="135" y="61" className={textCls('tw')} textAnchor="middle">{dimText(dims, 'tw', 'Tw')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="30" y1="135" x2="20" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="110" y1="125" x2="100" y2="121" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="132" x2="103" y2="122" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="23,132 29,129 30,134" className={arrowCls(LENGTH_KEY)} />
            <polygon points="103,122 97,125 96,120" className={arrowCls(LENGTH_KEY)} />
            <text x="60" y="120" className={textCls(LENGTH_KEY)} textAnchor="middle">{dimText(dims, LENGTH_KEY, 'L')}</text>
          </g>
        </svg>
      )}

      {id === 'ring' && (
        <svg className="w-full h-full" viewBox={VB} role="img" aria-label="Ring preview" xmlns="http://www.w3.org/2000/svg">
          <path d="M 40,90 C 40,65 160,65 160,90 C 160,115 40,115 40,90" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <path d="M 40,90 L 40,120 C 40,145 160,145 160,120 L 160,90" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <path d="M 160,120 C 160,145 40,145 40,120" className="fill-none stroke-slate-600" strokeWidth="2" />
          <path d="M 75,90 C 75,75 125,75 125,90 C 125,105 75,105 75,90 Z" className="fill-white stroke-slate-500" strokeWidth="1.5" />
          <g className={grpClass('od')}>
            <line x1="40" y1="90" x2="40" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="90" x2="160" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="40" y1="50" x2="160" y2="50" className={lineCls('od')} strokeWidth={lineW('od')} />
            <polygon points="40,50 46,47 46,53" className={arrowCls('od')} />
            <polygon points="160,50 154,47 154,53" className={arrowCls('od')} />
            <text x="100" y="42" className={textCls('od')} textAnchor="middle">{dimText(dims, 'od', 'OD')}</text>
          </g>
          <g className={grpClass('id')}>
            <line x1="75" y1="90" x2="75" y2="162" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="125" y1="90" x2="125" y2="162" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="75" y1="158" x2="125" y2="158" className={lineCls('id')} strokeWidth={lineW('id')} />
            <polygon points="75,158 81,155 81,161" className={arrowCls('id')} />
            <polygon points="125,158 119,155 119,161" className={arrowCls('id')} />
            <text x="100" y="173" className={textCls('id')} textAnchor="middle">{dimText(dims, 'id', 'ID')}</text>
          </g>
          <g className={grpClass(LENGTH_KEY)}>
            <line x1="160" y1="90" x2="182" y2="90" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="120" x2="182" y2="120" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="178" y1="90" x2="178" y2="120" className={lineCls(LENGTH_KEY)} strokeWidth={lineW(LENGTH_KEY)} />
            <polygon points="178,90 175,96 181,96" className={arrowCls(LENGTH_KEY)} />
            <polygon points="178,120 175,114 181,114" className={arrowCls(LENGTH_KEY)} />
            <text x="184" y="109" className={textCls(LENGTH_KEY)} textAnchor="start">{dimText(dims, LENGTH_KEY, 'T')}</text>
          </g>
        </svg>
      )}
    </div>
  );
}

/** Exact Lucide profile icons matching the reference Metal-Calculator-And-Quotation-Suite shape grid. */
export function ProfileGlyph({ id, size = 16 }: { id: ProfileId; size?: number }) {
  switch (id) {
    case 'round-bar': return <Circle size={size} />;
    case 'square-bar': return <Square size={size} />;
    case 'flat-bar': return <RectangleHorizontal size={size} />;
    case 'hex-bar': return <Hexagon size={size} />;
    case 'octagonal-bar': return <Octagon size={size} />;
    case 'round-tube': return <CircleDot size={size} />;
    case 'square-tube': return <Square size={size} />;
    case 'rect-tube': return <RectangleHorizontal size={size} />;
    case 'angle': return <CornerDownRight size={size} />;
    case 'channel': return <AlignJustify size={size} />;
    case 't-profile': return <Type size={size} />;
    case 'i-beam': return <Columns size={size} />;
    case 'ring': return <CircleDot size={size} />;
    default: return <Circle size={size} />;
  }
}
