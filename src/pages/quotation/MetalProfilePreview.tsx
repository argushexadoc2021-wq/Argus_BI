import { PROFILE_BY_ID, type DimMap, type ProfileId, type ProfileSpec } from '@/lib/metalCalc';
import { buildShape } from '@/lib/metalShapes';

/**
 * Exact 3D isometric SVG Component Previews matching the reference
 * Metal-Calculator-And-Quotation-Suite repository (viewBox 0 0 200 200).
 */
export function ProfilePreview({ profile }: { profile: ProfileSpec; dims: DimMap }) {
  const id = profile.id;

  return (
    <div className="w-full max-w-[205px] max-h-[205px] aspect-square flex items-center justify-center my-auto">
      {id === 'round-bar' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="Round Bar preview" xmlns="http://www.w3.org/2000/svg">
          <path d="M 40,60 L 140,60 M 40,140 L 140,140" className="stroke-slate-300" strokeWidth="1.5" strokeDasharray="4,4" />
          <path d="M 40,60 C 20,60 20,140 40,140 C 60,140 60,60 40,60" className="fill-slate-100 stroke-slate-400" strokeWidth="2" />
          <path d="M 40,60 L 160,60 M 40,140 L 160,140" className="stroke-slate-600" strokeWidth="2" />
          <path d="M 160,60 C 145,60 145,140 160,140 C 175,140 175,60 160,60 Z" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="160" y1="60" x2="160" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="180" y1="60" x2="180" y2="140" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="180,60 177,66 183,66" className="fill-orange-500" />
            <polygon points="180,140 177,134 183,134" className="fill-orange-500" />
            <text x="188" y="104" className="fill-orange-600 font-bold text-xs" textAnchor="start">d</text>
          </g>
          <g>
            <line x1="40" y1="140" x2="40" y2="165" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="140" x2="160" y2="165" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="40" y1="160" x2="160" y2="160" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="40,160 46,157 46,163" className="fill-orange-500" />
            <polygon points="160,160 154,157 154,163" className="fill-orange-500" />
            <text x="100" y="176" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 'square-bar' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="Square Bar preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="45,65 145,45 145,125 45,145" className="fill-slate-100 stroke-slate-500" strokeWidth="1.5" />
          <polygon points="145,45 165,55 165,135 145,125" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="45,145 145,125 165,135 65,155" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="45" y1="145" x2="30" y2="138" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="65" y1="155" x2="50" y2="148" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="33" y1="140" x2="49" y2="148" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="33,140 39,139 37,144" className="fill-orange-500" />
            <polygon points="49,148 43,149 45,144" className="fill-orange-500" />
            <text x="32" y="160" className="fill-orange-600 font-bold text-xs" textAnchor="middle">w</text>
          </g>
          <g>
            <line x1="45" y1="65" x2="35" y2="61" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="145" y1="45" x2="135" y2="41" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="38" y1="62" x2="138" y2="42" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="38,62 44,59 45,64" className="fill-orange-500" />
            <polygon points="138,42 132,45 131,40" className="fill-orange-500" />
            <text x="88" y="44" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 'flat-bar' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="Flat Bar preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="35,85 135,65 135,115 35,135" className="fill-slate-100 stroke-slate-500" strokeWidth="1.5" />
          <polygon points="135,65 165,75 165,125 135,115" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="35,135 135,115 165,125 65,145" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="165" y1="75" x2="178" y2="79" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="165" y1="125" x2="178" y2="129" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="174" y1="78" x2="174" y2="128" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="174,78 171,84 177,84" className="fill-orange-500" />
            <polygon points="174,128 171,122 177,122" className="fill-orange-500" />
            <text x="183" y="106" className="fill-orange-600 font-bold text-xs" textAnchor="start">t</text>
          </g>
          <g>
            <line x1="35" y1="135" x2="20" y2="128" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="65" y1="145" x2="50" y2="138" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="130" x2="49" y2="140" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="23,130 29,129 27,134" className="fill-orange-500" />
            <polygon points="49,140 43,141 45,136" className="fill-orange-500" />
            <text x="24" y="152" className="fill-orange-600 font-bold text-xs" textAnchor="middle">w</text>
          </g>
          <g>
            <line x1="35" y1="85" x2="25" y2="81" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="135" y1="65" x2="125" y2="61" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="28" y1="82" x2="128" y2="62" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="28,82 34,79 35,84" className="fill-orange-500" />
            <polygon points="128,62 122,65 121,60" className="fill-orange-500" />
            <text x="78" y="62" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 'hex-bar' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="Hexagonal Bar preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="30,85 130,55 130,105 30,135" className="fill-slate-100 stroke-slate-500" strokeWidth="1.5" strokeDasharray="3,3" />
          <polygon points="130,55 145,40 165,50 165,110 145,125 130,105" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="30,135 130,105 145,125 45,155" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="145" y1="125" x2="165" y2="110" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="145,125 151,123 148,120" className="fill-orange-500" />
            <polygon points="165,110 159,112 162,115" className="fill-orange-500" />
            <text x="160" y="128" className="fill-orange-600 font-bold text-xs" textAnchor="start">s</text>
          </g>
          <g>
            <line x1="30" y1="135" x2="20" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="130" y1="105" x2="120" y2="101" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="132" x2="123" y2="102" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="23,132 29,129 30,134" className="fill-orange-500" />
            <polygon points="123,102 117,105 116,100" className="fill-orange-500" />
            <text x="73" y="108" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 'octagonal-bar' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="Octagonal Bar preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="135,40 155,48 165,65 165,95 155,112 135,120 120,105 120,55" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <path d="M 30,70 L 120,55 M 30,120 L 120,105" className="stroke-slate-300" strokeWidth="1.5" strokeDasharray="3,3" />
          <polygon points="30,120 120,105 135,120 45,135" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="120" y1="55" x2="120" y2="105" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="120,55 117,61 123,61" className="fill-orange-500" />
            <polygon points="120,105 117,99 123,99" className="fill-orange-500" />
            <text x="112" y="84" className="fill-orange-600 font-bold text-xs" textAnchor="end">s</text>
          </g>
          <g>
            <line x1="30" y1="120" x2="20" y2="116" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="105" x2="110" y2="101" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="117" x2="113" y2="102" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="23,117 29,114 30,119" className="fill-orange-500" />
            <polygon points="113,102 107,105 106,100" className="fill-orange-500" />
            <text x="68" y="100" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 'round-tube' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="Round Tube preview" xmlns="http://www.w3.org/2000/svg">
          <path d="M 40,60 L 140,60 M 40,140 L 140,140" className="stroke-slate-300" strokeWidth="1.5" strokeDasharray="4,4" />
          <path d="M 40,60 L 160,60 M 40,140 L 160,140" className="stroke-slate-600" strokeWidth="2" />
          <path d="M 160,60 C 145,60 145,140 160,140 C 175,140 175,60 160,60 Z" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <path d="M 160,75 C 150,75 150,125 160,125 C 170,125 170,75 160,75 Z" className="fill-white stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="160" y1="60" x2="160" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="180" y1="60" x2="180" y2="140" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="180,60 177,66 183,66" className="fill-orange-500" />
            <polygon points="180,140 177,134 183,134" className="fill-orange-500" />
            <text x="187" y="105" className="fill-orange-600 font-bold text-xs" textAnchor="start">d</text>
          </g>
          <g>
            <line x1="160" y1="60" x2="140" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="75" x2="140" y2="55" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="140" y1="40" x2="140" y2="55" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="140,40 137,45 143,45" className="fill-orange-500" />
            <polygon points="140,55 137,50 143,50" className="fill-orange-500" />
            <text x="134" y="49" className="fill-orange-600 font-bold text-xs" textAnchor="end">t</text>
          </g>
          <g>
            <line x1="40" y1="140" x2="40" y2="165" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="140" x2="160" y2="165" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="40" y1="160" x2="160" y2="160" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="40,160 46,157 46,163" className="fill-orange-500" />
            <polygon points="160,160 154,157 154,163" className="fill-orange-500" />
            <text x="100" y="175" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 'square-tube' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="Square Tube preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="135,45 165,55 165,135 135,125" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="140,55 160,62 160,127 140,120" className="fill-white stroke-slate-500" strokeWidth="1.5" />
          <polygon points="45,145 135,125 165,135 65,155" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="45" y1="145" x2="30" y2="138" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="65" y1="155" x2="50" y2="148" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="33" y1="140" x2="49" y2="148" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="33,140 39,139 37,144" className="fill-orange-500" />
            <polygon points="49,148 43,149 45,144" className="fill-orange-500" />
            <text x="31" y="160" className="fill-orange-600 font-bold text-xs" textAnchor="middle">w</text>
          </g>
          <g>
            <line x1="135" y1="125" x2="135" y2="142" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="140" y1="120" x2="140" y2="137" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="135" y1="139" x2="140" y2="135" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="135,139 140,137 139,141" className="fill-orange-500" />
            <polygon points="140,135 135,137 136,133" className="fill-orange-500" />
            <text x="146" y="145" className="fill-orange-600 font-bold text-xs" textAnchor="start">t</text>
          </g>
          <g>
            <line x1="45" y1="65" x2="35" y2="61" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="135" y1="45" x2="125" y2="41" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="38" y1="62" x2="138" y2="42" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="38,62 44,59 45,64" className="fill-orange-500" />
            <polygon points="138,42 132,45 131,40" className="fill-orange-500" />
            <text x="88" y="43" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 'rect-tube' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="Rectangular Tube preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="125,35 165,55 165,145 125,125" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="130,48 160,63 160,135 130,120" className="fill-white stroke-slate-500" strokeWidth="1.5" />
          <polygon points="25,135 125,125 165,145 65,155" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="165" y1="55" x2="182" y2="55" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="165" y1="145" x2="182" y2="145" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="178" y1="55" x2="178" y2="145" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="178,55 175,61 181,61" className="fill-orange-500" />
            <polygon points="178,145 175,139 181,139" className="fill-orange-500" />
            <text x="184" y="104" className="fill-orange-600 font-bold text-xs" textAnchor="start">h</text>
          </g>
          <g>
            <line x1="125" y1="125" x2="115" y2="135" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="165" y1="145" x2="155" y2="155" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="117" y1="133" x2="157" y2="153" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="117,133 123,131 121,136" className="fill-orange-500" />
            <polygon points="157,153 151,155 153,150" className="fill-orange-500" />
            <text x="135" y="161" className="fill-orange-600 font-bold text-xs" textAnchor="start">w</text>
          </g>
          <g>
            <line x1="125" y1="125" x2="125" y2="110" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="130" y1="120" x2="130" y2="105" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="125" y1="108" x2="130" y2="108" className="stroke-orange-500" strokeWidth="1.5" />
            <text x="127" y="100" className="fill-orange-600 font-bold text-xs" textAnchor="middle">t</text>
          </g>
          <g>
            <line x1="25" y1="135" x2="15" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="125" y1="125" x2="115" y2="121" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="18" y1="132" x2="118" y2="122" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="18,132 24,129 25,134" className="fill-orange-500" />
            <polygon points="118,122 112,125 111,120" className="fill-orange-500" />
            <text x="68" y="122" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 'angle' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="Angle L-profile preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="120,40 140,40 140,110 160,110 160,125 120,125" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <polygon points="30,135 120,125 160,125 70,135" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="120" y1="40" x2="105" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="125" x2="105" y2="125" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="108" y1="40" x2="108" y2="125" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="108,40 105,46 111,46" className="fill-orange-500" />
            <polygon points="108,125 105,119 111,119" className="fill-orange-500" />
            <text x="98" y="86" className="fill-orange-600 font-bold text-xs" textAnchor="end">w</text>
          </g>
          <g>
            <line x1="120" y1="125" x2="120" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="125" x2="160" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="137" x2="160" y2="137" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="120,137 126,134 126,140" className="fill-orange-500" />
            <polygon points="160,137 154,134 154,140" className="fill-orange-500" />
            <text x="140" y="150" className="fill-orange-600 font-bold text-xs" textAnchor="middle">h</text>
          </g>
          <g>
            <line x1="120" y1="40" x2="120" y2="28" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="140" y1="40" x2="140" y2="28" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="31" x2="140" y2="31" className="stroke-orange-500" strokeWidth="1.5" />
            <text x="130" y="24" className="fill-orange-600 font-bold text-xs" textAnchor="middle">t</text>
          </g>
          <g>
            <line x1="30" y1="135" x2="20" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="125" x2="110" y2="121" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="132" x2="113" y2="122" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="23,132 29,129 30,134" className="fill-orange-500" />
            <polygon points="113,122 107,125 106,120" className="fill-orange-500" />
            <text x="68" y="122" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 'channel' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="Channel U-profile preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="120,40 160,40 160,55 135,55 135,110 160,110 160,125 120,125" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="120" y1="40" x2="105" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="125" x2="105" y2="125" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="108" y1="40" x2="108" y2="125" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="108,40 105,46 111,46" className="fill-orange-500" />
            <polygon points="108,125 105,119 111,119" className="fill-orange-500" />
            <text x="98" y="86" className="fill-orange-600 font-bold text-xs" textAnchor="end">H</text>
          </g>
          <g>
            <line x1="120" y1="125" x2="120" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="125" x2="160" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="137" x2="160" y2="137" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="120,137 126,134 126,140" className="fill-orange-500" />
            <polygon points="160,137 154,134 154,140" className="fill-orange-500" />
            <text x="140" y="150" className="fill-orange-600 font-bold text-xs" textAnchor="middle">W</text>
          </g>
          <g>
            <line x1="120" y1="40" x2="120" y2="28" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="135" y1="40" x2="135" y2="28" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="31" x2="135" y2="31" className="stroke-orange-500" strokeWidth="1.5" />
            <text x="127" y="24" className="fill-orange-600 font-bold text-xs" textAnchor="middle">T</text>
          </g>
          <g>
            <line x1="30" y1="135" x2="20" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="120" y1="125" x2="110" y2="121" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="132" x2="113" y2="122" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="23,132 29,129 30,134" className="fill-orange-500" />
            <polygon points="113,122 107,125 106,120" className="fill-orange-500" />
            <text x="68" y="122" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 't-profile' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="T-profile preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="110,40 160,40 160,55 142,55 142,125 128,125 128,55 110,55" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="110" y1="40" x2="110" y2="25" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="40" x2="160" y2="25" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="110" y1="28" x2="160" y2="28" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="110,28 116,25 116,31" className="fill-orange-500" />
            <polygon points="160,28 154,25 154,31" className="fill-orange-500" />
            <text x="135" y="21" className="fill-orange-600 font-bold text-xs" textAnchor="middle">W</text>
          </g>
          <g>
            <line x1="160" y1="40" x2="175" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="125" x2="175" y2="125" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="172" y1="40" x2="172" y2="125" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="172,40 169,46 175,46" className="fill-orange-500" />
            <polygon points="172,125 169,119 175,119" className="fill-orange-500" />
            <text x="180" y="86" className="fill-orange-600 font-bold text-xs" textAnchor="start">H</text>
          </g>
          <g>
            <line x1="110" y1="40" x2="95" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="110" y1="55" x2="95" y2="55" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="98" y1="40" x2="98" y2="55" className="stroke-orange-500" strokeWidth="1.5" />
            <text x="90" y="52" className="fill-orange-600 font-bold text-xs" textAnchor="end">T</text>
          </g>
          <g>
            <line x1="30" y1="135" x2="20" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="128" y1="125" x2="118" y2="121" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="132" x2="121" y2="122" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="23,132 29,129 30,134" className="fill-orange-500" />
            <polygon points="121,122 115,125 114,120" className="fill-orange-500" />
            <text x="68" y="122" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 'i-beam' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="I-beam preview" xmlns="http://www.w3.org/2000/svg">
          <polygon points="110,40 160,40 160,55 142,55 142,110 160,110 160,125 110,125 110,110 128,110 128,55 110,55" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <g>
            <line x1="160" y1="40" x2="175" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="125" x2="175" y2="125" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="172" y1="40" x2="172" y2="125" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="172,40 169,46 175,46" className="fill-orange-500" />
            <polygon points="172,125 169,119 175,119" className="fill-orange-500" />
            <text x="180" y="86" className="fill-orange-600 font-bold text-xs" textAnchor="start">H</text>
          </g>
          <g>
            <line x1="110" y1="125" x2="110" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="125" x2="160" y2="140" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="110" y1="137" x2="160" y2="137" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="110,137 116,134 116,140" className="fill-orange-500" />
            <polygon points="160,137 154,134 154,140" className="fill-orange-500" />
            <text x="135" y="150" className="fill-orange-600 font-bold text-xs" textAnchor="middle">W</text>
          </g>
          <g>
            <line x1="110" y1="40" x2="95" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="110" y1="55" x2="95" y2="55" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="98" y1="40" x2="98" y2="55" className="stroke-orange-500" strokeWidth="1.5" />
            <text x="90" y="51" className="fill-orange-600 font-bold text-xs" textAnchor="end">Tf</text>
          </g>
          <g>
            <line x1="128" y1="80" x2="128" y2="65" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="142" y1="80" x2="142" y2="65" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="128" y1="68" x2="142" y2="68" className="stroke-orange-500" strokeWidth="1.5" />
            <text x="135" y="62" className="fill-orange-600 font-bold text-xs" textAnchor="middle">Tw</text>
          </g>
          <g>
            <line x1="30" y1="135" x2="20" y2="131" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="110" y1="125" x2="100" y2="121" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="23" y1="132" x2="103" y2="122" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="23,132 29,129 30,134" className="fill-orange-500" />
            <polygon points="103,122 97,125 96,120" className="fill-orange-500" />
            <text x="63" y="122" className="fill-orange-600 font-bold text-xs" textAnchor="middle">L</text>
          </g>
        </svg>
      )}

      {id === 'ring' && (
        <svg className="w-full h-full" viewBox="0 0 200 200" role="img" aria-label="Ring preview" xmlns="http://www.w3.org/2000/svg">
          <path d="M 40,90 C 40,65 160,65 160,90 C 160,115 40,115 40,90" className="fill-slate-200 stroke-slate-600" strokeWidth="2" />
          <path d="M 40,90 L 40,120 C 40,145 160,145 160,120 L 160,90" className="fill-slate-300 stroke-slate-600" strokeWidth="2" />
          <path d="M 160,120 C 160,145 40,145 40,120" className="fill-none stroke-slate-600" strokeWidth="2" />
          <path d="M 75,90 C 75,75 125,75 125,90 C 125,105 75,105 75,90 Z" className="fill-white stroke-slate-500" strokeWidth="1.5" />
          <g>
            <line x1="40" y1="90" x2="40" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="90" x2="160" y2="40" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="40" y1="50" x2="160" y2="50" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="40,50 46,47 46,53" className="fill-orange-500" />
            <polygon points="160,50 154,47 154,53" className="fill-orange-500" />
            <text x="100" y="44" className="fill-orange-600 font-bold text-xs" textAnchor="middle">OD</text>
          </g>
          <g>
            <line x1="75" y1="90" x2="75" y2="162" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="125" y1="90" x2="125" y2="162" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="75" y1="158" x2="125" y2="158" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="75,158 81,155 81,161" className="fill-orange-500" />
            <polygon points="125,158 119,155 119,161" className="fill-orange-500" />
            <text x="100" y="152" className="fill-orange-600 font-bold text-xs" textAnchor="middle">ID</text>
          </g>
          <g>
            <line x1="160" y1="90" x2="182" y2="90" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="160" y1="120" x2="182" y2="120" className="stroke-slate-400" strokeWidth="1" strokeDasharray="2,2" />
            <line x1="178" y1="90" x2="178" y2="120" className="stroke-orange-500" strokeWidth="1.5" />
            <polygon points="178,90 175,96 181,96" className="fill-orange-500" />
            <polygon points="178,120 175,114 181,114" className="fill-orange-500" />
            <text x="185" y="109" className="fill-orange-600 font-bold text-xs" textAnchor="start">T</text>
          </g>
        </svg>
      )}
    </div>
  );
}

/** Small outline icon of a profile's cross-section, for the picker. Inherits the text colour. */
export function ProfileGlyph({ id, size = 22 }: { id: ProfileId; size?: number }) {
  const profile = PROFILE_BY_ID[id];
  const d: Record<string, number> = {};
  for (const f of profile.fields) d[f.key] = Number(f.default);
  const shape = buildShape(id, d);
  const box = size - 4;
  const scale = Math.min(box / shape.w, box / shape.h);
  const tx = (size - shape.w * scale) / 2;
  const ty = (size - shape.h * scale) / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
        <path d={shape.d} fillRule="evenodd" fill="currentColor" fillOpacity={0.14} stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
