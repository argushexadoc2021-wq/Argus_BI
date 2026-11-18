import { useEffect, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { TeachBlock } from './charts';

interface AnimatedTeachCardProps {
  lesson: TeachBlock;
  onOpenRoute?: (route: string) => void;
  onStartLiveTour?: (route?: string) => void;
}

const STEP_DURATION_MS = 3800;

export function AnimatedTeachCard({ lesson, onOpenRoute, onStartLiveTour }: AnimatedTeachCardProps) {
  const steps = lesson.steps;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  // Auto-advance animation with smooth progress bar
  useEffect(() => {
    if (!playing || steps.length <= 1) return;
    setProgress(0);
    const started = performance.now();
    const tick = window.setInterval(() => {
      const pct = Math.min(100, ((performance.now() - started) / STEP_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(tick);
        setIdx((cur) => {
          if (cur + 1 < steps.length) return cur + 1;
          setPlaying(false);
          return cur;
        });
      }
    }, 50);
    return () => window.clearInterval(tick);
  }, [idx, playing, steps.length]);

  if (!steps.length) return null;
  const current = steps[Math.min(idx, steps.length - 1)];
  const stepRoute = current.route || lesson.route;

  const jumpTo = (nextIdx: number) => {
    setIdx(Math.max(0, Math.min(steps.length - 1, nextIdx)));
    setProgress(0);
  };

  const replay = () => {
    setIdx(0);
    setProgress(0);
    setPlaying(true);
  };

  return (
    <div className="mt-2.5 overflow-hidden rounded-2xl border border-indigo-200/90 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 px-3 py-2 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/20">
            <GraduationCap size={14} />
            {playing && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-300 animate-ping" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold leading-tight">{lesson.title}</p>
            {lesson.subtitle && <p className="truncate text-[10px] text-emerald-50/90">{lesson.subtitle}</p>}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold tabular-nums">
          Step {idx + 1} / {steps.length}
        </span>
      </div>

      {/* Animated Stepper Pipeline */}
      <div className="border-b border-slate-100 bg-slate-50/80 px-3 py-2.5">
        <div className="relative flex items-center justify-between gap-1">
          {/* Background track */}
          <div className="pointer-events-none absolute left-4 right-4 top-3.5 h-1 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-300"
              style={{
                width: steps.length > 1
                  ? `${((idx + (playing ? progress / 100 : 0)) / (steps.length - 1)) * 100}%`
                  : '100%',
              }}
            />
          </div>

          {steps.map((s, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <button
                key={i}
                type="button"
                onClick={() => { setPlaying(false); jumpTo(i); }}
                title={`Step ${i + 1}: ${s.title}`}
                className="group relative z-10 flex flex-col items-center gap-1 cursor-pointer focus:outline-none"
              >
                <span className="relative flex h-7 w-7 items-center justify-center">
                  {active && (
                    <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />
                  )}
                  <span
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold transition-all duration-300 ${
                      active
                        ? 'scale-110 bg-gradient-to-br from-emerald-500 to-indigo-600 text-white shadow-md ring-2 ring-emerald-200'
                        : done
                        ? 'bg-emerald-600 text-white'
                        : 'border-2 border-slate-300 bg-white text-slate-500 group-hover:border-emerald-400'
                    }`}
                  >
                    {done ? <Check size={13} /> : i + 1}
                  </span>
                </span>
                <span
                  className={`max-w-[72px] truncate text-[9px] font-bold transition-colors ${
                    active ? 'text-indigo-700' : done ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Animated Active Step Spotlight */}
      <div key={idx} className="p-3 animate-scale-in">
        <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-indigo-50/60 p-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <MousePointerClick size={16} className="animate-bounce" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                  Step {idx + 1}
                </span>
                <h4 className="text-xs font-extrabold text-slate-900">{current.title}</h4>
              </div>
              <p className="text-xs leading-relaxed text-slate-700">{current.detail}</p>
              {current.action && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100/80 px-2.5 py-1 text-[11px] font-bold text-emerald-900 shadow-2xs">
                  <Sparkles size={12} className="text-emerald-600 shrink-0" />
                  <span>{current.action}</span>
                </div>
              )}
            </div>
          </div>

          {/* Step progress bar */}
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-[width] duration-75"
              style={{ width: `${playing ? progress : 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Controls Footer */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 bg-slate-50/70 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (!playing && idx === steps.length - 1) replay();
              else setPlaying((p) => !p);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 cursor-pointer"
          >
            {playing ? <><Pause size={12} /> Pause</> : <><Play size={12} /> {idx === steps.length - 1 ? 'Replay' : 'Play'}</>}
          </button>
          <button
            type="button"
            disabled={idx === 0}
            onClick={() => { setPlaying(false); jumpTo(idx - 1); }}
            aria-label="Previous step"
            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            disabled={idx === steps.length - 1}
            onClick={() => { setPlaying(false); jumpTo(idx + 1); }}
            aria-label="Next step"
            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={replay}
            title="Restart animation"
            aria-label="Restart animation"
            className="rounded-lg border border-slate-200 bg-white p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {stepRoute && onOpenRoute && (
            <button
              type="button"
              onClick={() => onOpenRoute(stepRoute)}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
            >
              <ExternalLink size={11} /> Open Screen
            </button>
          )}
          {onStartLiveTour && (
            <button
              type="button"
              onClick={() => onStartLiveTour(stepRoute)}
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 cursor-pointer"
              title="Run live animated spotlight walkthrough on the screen"
            >
              <GraduationCap size={12} /> Live Screen Tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
