import React, { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Cog,
  Boxes,
  Landmark,
  Camera,
  Store,
  BarChart3,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronsUpDown,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface MindLeaf {
  id: string;
  label: string;
  route: string;
}

interface MindBranch {
  id: string;
  title: string;
  subtitle: string;
  side: 'left' | 'right';
  color: string;        // hex for SVG curves
  bgClass: string;      // badge / pill background
  borderClass: string;  // border color
  textClass: string;    // accent text color
  dotClass: string;     // dot color
  icon: React.ComponentType<{ className?: string }>;
  children: MindLeaf[];
}

const BRANCHES: MindBranch[] = [
  // LEFT SIDE (Core Operations)
  {
    id: 'sales',
    title: 'Sales & Quotations',
    subtitle: 'Enquiry to order',
    side: 'left',
    color: '#10b981',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200 hover:border-emerald-400',
    textClass: 'text-emerald-700',
    dotClass: 'bg-emerald-500',
    icon: TrendingUp,
    children: [
      { id: 'sales-pipeline', label: 'Sales Pipelines', route: '/sales/in-house' },
      { id: 'quotations', label: 'Quotations & Metal Calc', route: '/sales/quotations' },
      { id: 'sales-orders', label: 'Sales Orders', route: '/sales/orders' },
      { id: 'site-visits', label: 'Site Visit & Partner Sales', route: '/sales/site-visits' },
      { id: 'company-lib', label: 'All Company Library', route: '/sales/leads' },
    ],
  },
  {
    id: 'production',
    title: 'Production & Logistics',
    subtitle: 'Shop floor to delivery',
    side: 'left',
    color: '#f97316',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200 hover:border-orange-400',
    textClass: 'text-orange-700',
    dotClass: 'bg-orange-500',
    icon: Cog,
    children: [
      { id: 'prod-plan', label: 'Production Planning', route: '/production/planning' },
      { id: 'scheduling', label: 'Scheduling & Machine Log', route: '/production/scheduling' },
      { id: 'process-master', label: 'Process Master', route: '/production/process-master' },
      { id: 'finished-goods', label: 'Finished Goods', route: '/production/finished-goods' },
      { id: 'delivery-challan', label: 'Delivery Challan', route: '/operations/delivery' },
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory & Purchasing',
    subtitle: 'Stock, suppliers & quality',
    side: 'left',
    color: '#f59e0b',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200 hover:border-amber-400',
    textClass: 'text-amber-700',
    dotClass: 'bg-amber-500',
    icon: Boxes,
    children: [
      { id: 'stock', label: 'Inventory & Adjustments', route: '/inventory/stock' },
      { id: 'purchasing', label: 'Suppliers & Purchase Orders', route: '/purchasing/orders' },
      { id: 'grn', label: 'Goods Receipt (GRN)', route: '/purchasing/goods-receipt' },
      { id: 'cnc-vault', label: 'Products & Drawings', route: '/engineering/cnc-vault' },
      { id: 'quality-maint', label: 'Quality & Maintenance', route: '/quality/inspection-plans' },
    ],
  },
  {
    id: 'finance',
    title: 'Finance & Accounts',
    subtitle: 'Billing, books & costing',
    side: 'left',
    color: '#8b5cf6',
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-200 hover:border-violet-400',
    textClass: 'text-violet-700',
    dotClass: 'bg-violet-500',
    icon: Landmark,
    children: [
      { id: 'invoices', label: 'Commercial Invoices', route: '/finance/invoices' },
      { id: 'bank-cash', label: 'Bank Entry & Petty Cash', route: '/finance/bank-entry' },
      { id: 'ledger', label: 'Ledger & Trial Balance', route: '/accounts/ledger' },
      { id: 'pnl-bs', label: 'Profit & Loss / Balance Sheet', route: '/accounts/profit-loss' },
      { id: 'costing', label: 'Product & Material Costing', route: '/costing/job-costing' },
    ],
  },

  // RIGHT SIDE (Suites, Communication & Admin)
  {
    id: 'attendance',
    title: 'AI Face Attendance',
    subtitle: 'Biometric workforce suite',
    side: 'right',
    color: '#2563eb',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200 hover:border-blue-400',
    textClass: 'text-blue-700',
    dotClass: 'bg-blue-600',
    icon: Camera,
    children: [
      { id: 'att-dash', label: 'Attendance Dashboard', route: '/attendance/dashboard' },
      { id: 'att-kiosk', label: 'Live Kiosk Capture', route: '/attendance/kiosk' },
      { id: 'att-enroll', label: 'Face Enrollment', route: '/attendance/enroll' },
      { id: 'att-leaves', label: 'Manual Entry & Leaves', route: '/attendance/leaves' },
      { id: 'att-payslip', label: 'Payments, Payslip & Geofence', route: '/attendance/payslip' },
    ],
  },
  {
    id: 'retail',
    title: 'Retail Online Store',
    subtitle: 'Digital storefront & orders',
    side: 'right',
    color: '#e11d48',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-200 hover:border-rose-400',
    textClass: 'text-rose-700',
    dotClass: 'bg-rose-500',
    icon: Store,
    children: [
      { id: 'store-home', label: '3D Retail Storefront', route: '/store/home' },
      { id: 'digital-store', label: 'Digital Store Catalog', route: '/inventory/digital-store' },
      { id: 'retail-orders', label: 'Retail Orders', route: '/inventory/retail-orders' },
    ],
  },
  {
    id: 'insights',
    title: 'Overview & Communication',
    subtitle: 'Dashboards, chat & mail',
    side: 'right',
    color: '#06b6d4',
    bgClass: 'bg-cyan-50',
    borderClass: 'border-cyan-200 hover:border-cyan-400',
    textClass: 'text-cyan-700',
    dotClass: 'bg-cyan-500',
    icon: BarChart3,
    children: [
      { id: 'exec-dash', label: 'Executive Dashboard', route: '/dashboard' },
      { id: 'reports', label: 'Reports & Analytics', route: '/reports/production' },
      { id: 'bi-chat', label: 'BI Chat', route: '/bi-chat' },
      { id: 'mail-hub', label: 'Mail Integration', route: '/admin/email-integration' },
    ],
  },
  {
    id: 'admin',
    title: 'Admin & Support',
    subtitle: 'Users, access & helpdesk',
    side: 'right',
    color: '#4f46e5',
    bgClass: 'bg-indigo-50',
    borderClass: 'border-indigo-200 hover:border-indigo-400',
    textClass: 'text-indigo-700',
    dotClass: 'bg-indigo-500',
    icon: ShieldCheck,
    children: [
      { id: 'users-access', label: 'Users & Access Control', route: '/admin/access' },
      { id: 'companies', label: 'Company & Settings', route: '/admin/settings' },
      { id: 'jd-audit', label: 'JD Build & Audit Logs', route: '/admin/audit-logs' },
      { id: 'support', label: 'Technical & On-site Support', route: '/support/technical' },
    ],
  },
];

interface CurvePath {
  key: string;
  d: string;
  color: string;
  dashed?: boolean;
  thick?: boolean;
}

export function MindMapPage() {
  const navigate = useNavigate();

  // Track which branches are expanded (all expanded by default so full project is visible immediately)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    BRANCHES.forEach((b) => { init[b.id] = true; });
    return init;
  });

  const [zoom, setZoom] = useState(0.95);
  const [paths, setPaths] = useState<CurvePath[]>([]);
  const [svgSize, setSvgSize] = useState({ width: 1200, height: 800 });

  // Refs for measuring exact card edge anchors
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const centerRef = useRef<HTMLDivElement | null>(null);
  const branchRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const leafRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const allExpanded = BRANCHES.every((b) => expanded[b.id]);

  const toggleBranch = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = () => {
    const nextState = !allExpanded;
    const next: Record<string, boolean> = {};
    BRANCHES.forEach((b) => { next[b.id] = nextState; });
    setExpanded(next);
  };

  const computeCurves = useCallback(() => {
    const canvas = canvasRef.current;
    const center = centerRef.current;
    if (!canvas || !center) return;

    const cRect = canvas.getBoundingClientRect();
    const scale = zoom || 1;
    const width = canvas.scrollWidth;
    const height = canvas.scrollHeight;
    setSvgSize({ width, height });

    const relRect = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return {
        left: (r.left - cRect.left) / scale,
        right: (r.right - cRect.left) / scale,
        top: (r.top - cRect.top) / scale,
        bottom: (r.bottom - cRect.top) / scale,
        midY: (r.top + r.height / 2 - cRect.top) / scale,
      };
    };

    const hub = relRect(center);
    const nextPaths: CurvePath[] = [];

    BRANCHES.forEach((branch) => {
      const bEl = branchRefs.current[branch.id];
      if (!bEl) return;
      const bRect = relRect(bEl);

      // Curve from Center Hub -> Branch Card
      if (branch.side === 'left') {
        const x1 = hub.left;
        const y1 = hub.midY;
        const x2 = bRect.right;
        const y2 = bRect.midY;
        const cx = (x1 + x2) / 2;
        nextPaths.push({
          key: `hub-${branch.id}`,
          d: `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`,
          color: branch.color,
          thick: true,
        });
      } else {
        const x1 = hub.right;
        const y1 = hub.midY;
        const x2 = bRect.left;
        const y2 = bRect.midY;
        const cx = (x1 + x2) / 2;
        nextPaths.push({
          key: `hub-${branch.id}`,
          d: `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`,
          color: branch.color,
          thick: true,
        });
      }

      // Curves from Branch Card -> Leaf Items
      if (expanded[branch.id]) {
        branch.children.forEach((leaf) => {
          const lEl = leafRefs.current[leaf.id];
          if (!lEl) return;
          const lRect = relRect(lEl);
          if (branch.side === 'left') {
            const x1 = bRect.left;
            const y1 = bRect.midY;
            const x2 = lRect.right;
            const y2 = lRect.midY;
            const cx = (x1 + x2) / 2;
            nextPaths.push({
              key: `${branch.id}-${leaf.id}`,
              d: `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`,
              color: branch.color,
            });
          } else {
            const x1 = bRect.right;
            const y1 = bRect.midY;
            const x2 = lRect.left;
            const y2 = lRect.midY;
            const cx = (x1 + x2) / 2;
            nextPaths.push({
              key: `${branch.id}-${leaf.id}`,
              d: `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`,
              color: branch.color,
            });
          }
        });
      }
    });

    setPaths(nextPaths);
  }, [expanded, zoom]);

  useLayoutEffect(() => {
    computeCurves();
    const raf = requestAnimationFrame(computeCurves);
    return () => cancelAnimationFrame(raf);
  }, [computeCurves]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => computeCurves());
    ro.observe(canvas);
    window.addEventListener('resize', computeCurves);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', computeCurves);
    };
  }, [computeCurves]);

  const leftBranches = BRANCHES.filter((b) => b.side === 'left');
  const rightBranches = BRANCHES.filter((b) => b.side === 'right');

  return (
    <div
      className="min-h-full flex flex-col bg-[#f8fbff] text-slate-800"
      style={{
        backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Simple Top Bar */}
      <div className="px-4 sm:px-6 py-3.5 bg-white/95 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
              Project Mind Map
            </h1>
            <p className="text-xs text-slate-500">
              Simple visual map of the entire Argus BI platform — click any branch to fold, or click a topic to open it.
            </p>
          </div>
        </div>

        {/* Minimal Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            <ChevronsUpDown className="w-3.5 h-3.5 text-blue-600" />
            <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
          </button>

          <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.65, +(z - 0.1).toFixed(2)))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[11px] font-mono font-bold text-slate-700 select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.25, +(z + 0.1).toFixed(2)))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(0.95)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer border-l border-slate-100 ml-0.5"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mind Map Canvas */}
      <div className="flex-1 overflow-auto p-6 sm:p-10 flex items-center justify-center">
        <div
          ref={canvasRef}
          className="relative inline-flex items-center justify-center gap-16 sm:gap-24 py-6 px-4 transition-transform duration-150 origin-center"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* SVG Bezier Connectors Layer */}
          <svg
            width={svgSize.width}
            height={svgSize.height}
            className="absolute inset-0 pointer-events-none overflow-visible"
            style={{ zIndex: 0 }}
          >
            {paths.map((p) => (
              <path
                key={p.key}
                d={p.d}
                fill="none"
                stroke={p.color}
                strokeWidth={p.thick ? 2.5 : 1.75}
                strokeOpacity={p.thick ? 0.55 : 0.4}
                strokeLinecap="round"
              />
            ))}
          </svg>

          {/* LEFT BRANCHES */}
          <div className="flex flex-col gap-7 relative z-10">
            {leftBranches.map((branch) => {
              const Icon = branch.icon;
              const isOpen = !!expanded[branch.id];
              return (
                <div key={branch.id} className="flex items-center justify-end gap-10">
                  {/* Leaves on the left of the branch node */}
                  {isOpen && (
                    <div className="flex flex-col items-end gap-2">
                      {branch.children.map((leaf) => (
                        <button
                          key={leaf.id}
                          ref={(el) => { leafRefs.current[leaf.id] = el; }}
                          type="button"
                          onClick={() => navigate(leaf.route)}
                          className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 hover:shadow-sm text-xs font-semibold text-slate-700 hover:text-slate-950 transition-all cursor-pointer whitespace-nowrap"
                        >
                          <ArrowUpRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 transition-colors" />
                          <span>{leaf.label}</span>
                          <span className={`w-2 h-2 rounded-full ${branch.dotClass} shrink-0`} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Branch Card */}
                  <div
                    ref={(el) => { branchRefs.current[branch.id] = el; }}
                    onClick={() => toggleBranch(branch.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border-2 shadow-xs cursor-pointer transition-all select-none min-w-[220px] ${branch.borderClass}`}
                  >
                    <button
                      type="button"
                      className="p-1 rounded-lg bg-slate-50 text-slate-400 hover:text-slate-700"
                      aria-label={isOpen ? 'Collapse' : 'Expand'}
                    >
                      {isOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                    </button>
                    <div className="flex-1 text-right min-w-0">
                      <div className="text-xs font-black text-slate-900 leading-tight">{branch.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{branch.subtitle}</div>
                    </div>
                    <div className={`w-9 h-9 rounded-xl ${branch.bgClass} ${branch.textClass} flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CENTER HUB NODE */}
          <div
            ref={centerRef}
            className="relative z-10 px-7 py-6 rounded-3xl bg-slate-900 text-white shadow-xl border-4 border-white ring-2 ring-blue-500/30 text-center min-w-[200px] shrink-0 select-none"
          >
            <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-2.5 shadow-md shadow-blue-500/30">
              <Layers className="w-6 h-6" />
            </div>
            <div className="text-base font-black tracking-wide uppercase">ARGUS BI</div>
            <div className="text-[11px] text-blue-300 font-semibold mt-0.5">
              Complete Project Mind Map
            </div>
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-slate-200">
              <span>{BRANCHES.length} Core Modules</span>
            </div>
          </div>

          {/* RIGHT BRANCHES */}
          <div className="flex flex-col gap-7 relative z-10">
            {rightBranches.map((branch) => {
              const Icon = branch.icon;
              const isOpen = !!expanded[branch.id];
              return (
                <div key={branch.id} className="flex items-center justify-start gap-10">
                  {/* Branch Card */}
                  <div
                    ref={(el) => { branchRefs.current[branch.id] = el; }}
                    onClick={() => toggleBranch(branch.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border-2 shadow-xs cursor-pointer transition-all select-none min-w-[220px] ${branch.borderClass}`}
                  >
                    <div className={`w-9 h-9 rounded-xl ${branch.bgClass} ${branch.textClass} flex items-center justify-center shrink-0`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-xs font-black text-slate-900 leading-tight">{branch.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{branch.subtitle}</div>
                    </div>
                    <button
                      type="button"
                      className="p-1 rounded-lg bg-slate-50 text-slate-400 hover:text-slate-700"
                      aria-label={isOpen ? 'Collapse' : 'Expand'}
                    >
                      {isOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Leaves on the right of the branch node */}
                  {isOpen && (
                    <div className="flex flex-col items-start gap-2">
                      {branch.children.map((leaf) => (
                        <button
                          key={leaf.id}
                          ref={(el) => { leafRefs.current[leaf.id] = el; }}
                          type="button"
                          onClick={() => navigate(leaf.route)}
                          className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-slate-400 hover:shadow-sm text-xs font-semibold text-slate-700 hover:text-slate-950 transition-all cursor-pointer whitespace-nowrap"
                        >
                          <span className={`w-2 h-2 rounded-full ${branch.dotClass} shrink-0`} />
                          <span>{leaf.label}</span>
                          <ArrowUpRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 transition-colors" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
