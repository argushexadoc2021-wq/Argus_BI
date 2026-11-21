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
    <div className="fixed top-16 right-4 z-[9999] w-[395px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/90 bg-white/95 text-slate-900 shadow-[0_25px_60px_-15px_rgba(99,102,241,0.35),0_4px_16px_rgba(0,0,0,0.06)] backdrop-blur-2xl ring-1 ring-black/[0.04] transition-all duration-300 animate-in fade-in slide-in-from-top-4">
      {/* Top Banner: Bot identity & Target Screen */}
      <div className="flex items-center justify-between border-b border-slate-100/90 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/60 px-4 py-3 rounded-t-2xl">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/30">
            <Bot size={18} className="animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wide uppercase bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              <Sparkles size={11} className="text-amber-500" />
              AI Robotic Automation
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
              <Navigation size={10} className="text-indigo-600" />
              <span className="text-indigo-700 font-bold">{state.targetLabel}</span>
              <span className="text-slate-400 font-mono text-[10px]">{state.targetPath}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissAutomation}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          title="Dismiss Automation HUD"
        >
          <X size={15} />
        </button>
      </div>

      {/* Live Automation Body */}
      <div className="p-4 space-y-3">
        {/* Step progress pills */}
        <div className="grid grid-cols-3 gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-center">
          <div
            className={`rounded-lg py-1 px-1 transition-all ${
              state.step === 'navigating'
                ? 'bg-cyan-50 text-cyan-800 border border-cyan-300 shadow-xs'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {state.step === 'navigating' ? '1. Navigating' : '✓ 1. Navigated'}
          </div>
          <div
            className={`rounded-lg py-1 px-1 transition-all ${
              state.step === 'navigating'
                ? 'bg-slate-50 text-slate-400 border border-slate-200/60'
                : state.step === 'typing'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-300 shadow-xs animate-pulse'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {state.step === 'typing' ? '2. Typing...' : state.step === 'navigating' ? '2. Auto-type' : '✓ 2. Typed'}
          </div>
          <div
            className={`rounded-lg py-1 px-1 transition-all ${
              state.step === 'saving'
                ? 'bg-amber-50 text-amber-800 border border-amber-300 shadow-xs animate-pulse'
                : state.step === 'completed'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-50 text-slate-400 border border-slate-200/60'
            }`}
          >
            {state.step === 'saving' ? '3. Saving...' : state.step === 'completed' ? '✓ 3. Saved' : '3. Save DB'}
          </div>
        </div>

        {/* Typing Simulator Terminal */}
        {(state.step === 'typing' || state.step === 'saving') && (
          <div className="rounded-xl border border-indigo-100 bg-slate-50/80 p-3 font-mono text-xs shadow-inner">
            <div className="text-[10px] text-indigo-700 font-bold mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Sparkles size={10} className="text-amber-500" />
                AUTOMATING FORM INPUTS
              </span>
              <span className="text-slate-500 font-semibold">
                {state.currentFieldIndex + 1} of {state.fields.length}
              </span>
            </div>

            {/* Previously typed fields */}
            <div className="space-y-1 mb-2">
              {state.fields.slice(0, state.currentFieldIndex).map((f) => (
                <div key={f.key} className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                  <Check size={11} className="text-emerald-600 shrink-0" />
                  <span className="text-slate-400">{f.label}:</span>
                  <span className="text-slate-800 font-bold truncate">{f.value}</span>
                </div>
              ))}
            </div>

            {/* Currently typing field */}
            {currentField && (
              <div className="rounded-lg border border-indigo-200 bg-white p-2.5 text-xs shadow-xs">
                <div className="text-[10px] uppercase tracking-wider text-indigo-700 font-extrabold mb-0.5 flex items-center gap-1">
                  <CornerDownRight size={10} />
                  {currentField.label}
                </div>
                <div className="text-slate-900 font-bold flex items-center text-[13px]">
                  <span>{state.typedValue}</span>
                  <span className="inline-block w-2 h-4 bg-indigo-600 ml-0.5 animate-pulse" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Completed State */}
        {state.step === 'completed' && (
          <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/70 p-3.5 text-center space-y-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-xs">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-800">Successfully Auto-Typed & Saved to DB!</p>
              <p className="text-[11.5px] text-emerald-700 mt-1 font-medium leading-relaxed">{state.message}</p>
            </div>
            <div className="pt-1 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={dismissAutomation}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1 text-[11px] font-bold text-white shadow-xs transition-all hover:scale-105"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {state.step === 'error' && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-center space-y-1.5">
            <p className="text-xs font-bold text-rose-700">Automation encountered an issue</p>
            <p className="text-[11px] text-rose-600">{state.message}</p>
            <button
              type="button"
              onClick={dismissAutomation}
              className="mt-1 rounded-md bg-rose-600 hover:bg-rose-700 px-2.5 py-1 text-[11px] font-bold text-white"
            >
              Close
            </button>
          </div>
        )}

        {/* Progress Footer */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 font-medium">
          <span className="flex items-center gap-1">
            <Database size={11} className="text-indigo-600" />
            Direct DB Control
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Argus Robotic Engine</span>
        </div>
      </div>
    </div>
  );
}
