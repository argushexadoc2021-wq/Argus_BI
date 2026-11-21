import { useEffect, useState } from 'react';
import { Bot, Check, CheckCircle2, ChevronRight, CornerDownRight, Database, Loader2, Navigation, Sparkles, X } from 'lucide-react';
import {
  getAutomationState,
  subscribeAutomation,
  dismissAutomation,
  type AutomationState,
} from '@/lib/adviser/aiAutomator';

export function AiAutomationOverlay() {
  const [state, setState] = useState<AutomationState>(getAutomationState);

  useEffect(() => {
    return subscribeAutomation(setState);
  }, []);

  if (!state.active) return null;

  const currentField = state.fields[state.currentFieldIndex];

  return (
    <div className="fixed top-16 right-4 z-[9999] w-[390px] max-w-[calc(100vw-2rem)] rounded-2xl border border-indigo-500/30 bg-slate-950/90 text-white shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4">
      {/* Top Banner: Bot identity & Target Screen */}
      <div className="flex items-center justify-between border-b border-indigo-950/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
            <Bot size={18} className="animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wide uppercase text-indigo-300">
              <Sparkles size={11} className="text-amber-400" />
              AI Automation Agent
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <Navigation size={10} className="text-cyan-400" />
              <span className="text-cyan-300 font-semibold">{state.targetLabel}</span>
              <span className="text-slate-500 font-mono text-[10px]">{state.targetPath}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissAutomation}
          className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          title="Dismiss Automation HUD"
        >
          <X size={15} />
        </button>
      </div>

      {/* Live Automation Body */}
      <div className="p-4 space-y-3">
        {/* Step progress pills */}
        <div className="grid grid-cols-3 gap-1.5 text-[10px] font-bold uppercase tracking-wider text-center">
          <div
            className={`rounded-md py-1 px-1 transition-colors ${
              state.step === 'navigating'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {state.step === 'navigating' ? '1. Navigating' : '✓ 1. Navigated'}
          </div>
          <div
            className={`rounded-md py-1 px-1 transition-colors ${
              state.step === 'navigating'
                ? 'bg-white/5 text-slate-500'
                : state.step === 'typing'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {state.step === 'typing' ? '2. Typing...' : state.step === 'navigating' ? '2. Auto-type' : '✓ 2. Typed'}
          </div>
          <div
            className={`rounded-md py-1 px-1 transition-colors ${
              state.step === 'saving'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                : state.step === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/5 text-slate-500'
            }`}
          >
            {state.step === 'saving' ? '3. Saving...' : state.step === 'completed' ? '✓ 3. Saved' : '3. Save DB'}
          </div>
        </div>

        {/* Typing Simulator Terminal */}
        {(state.step === 'typing' || state.step === 'saving') && (
          <div className="rounded-xl border border-indigo-900/60 bg-black/60 p-3 font-mono text-xs shadow-inner">
            <div className="text-[10px] text-indigo-400 font-bold mb-2 flex items-center justify-between">
              <span>AUTOMATING FORM INPUTS</span>
              <span className="text-slate-500">
                {state.currentFieldIndex + 1} of {state.fields.length}
              </span>
            </div>

            {/* Previously typed fields */}
            <div className="space-y-1 mb-2">
              {state.fields.slice(0, state.currentFieldIndex).map((f) => (
                <div key={f.key} className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Check size={11} className="text-emerald-400 shrink-0" />
                  <span className="text-slate-500">{f.label}:</span>
                  <span className="text-slate-300 font-semibold truncate">{f.value}</span>
                </div>
              ))}
            </div>

            {/* Currently typing field */}
            {currentField && (
              <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/40 p-2 text-xs">
                <div className="text-[10px] uppercase tracking-wider text-cyan-300 font-bold mb-0.5 flex items-center gap-1">
                  <CornerDownRight size={10} />
                  {currentField.label}
                </div>
                <div className="text-white font-bold flex items-center">
                  <span>{state.typedValue}</span>
                  <span className="inline-block w-2 h-4 bg-cyan-400 ml-0.5 animate-pulse" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Completed State */}
        {state.step === 'completed' && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3.5 text-center space-y-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-300">Successfully Auto-Typed & Saved to DB!</p>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{state.message}</p>
            </div>
            <div className="pt-1 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={dismissAutomation}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 text-xs font-semibold shadow-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {state.step === 'error' && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-center space-y-1.5">
            <p className="text-xs font-bold text-rose-300">Automation Save Failed</p>
            <p className="text-[11px] text-rose-200">{state.message}</p>
            <button
              type="button"
              onClick={dismissAutomation}
              className="mt-1 rounded-md bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 text-xs"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
          <span className="flex items-center gap-1">
            <Database size={10} className="text-indigo-400" />
            Supabase Tenant Isolation Active
          </span>
          <span className="text-slate-400 font-mono">Argus AI RPA</span>
        </div>
      </div>
    </div>
  );
}
