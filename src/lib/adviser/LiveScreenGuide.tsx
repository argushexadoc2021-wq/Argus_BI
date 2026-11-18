import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Crosshair,
  MousePointerClick,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { TeachBlock, TeachStep } from '@/lib/adviser/charts';

interface LiveScreenGuideProps {
  lesson: TeachBlock;
  lang: 'ta' | 'tanglish' | 'en';
  currentPath: string;
  onNavigate: (route: string) => void;
  onSpeakStep?: (text: string) => void;
  onStopSpeak?: () => void;
  onClose: () => void;
}

interface BoxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const IGNORE_SELECTOR =
  '[data-voice-ignore], .adviser-split, [data-live-guide-ignore], [data-tour-ignore]';

const STYLE_CSS = `
@keyframes lsgPulse {
  0% { box-shadow: 0 0 0 0 rgba(249,115,22,.85), 0 0 24px rgba(249,115,22,.45); }
  70% { box-shadow: 0 0 0 16px rgba(249,115,22,0), 0 0 28px rgba(249,115,22,.25); }
  100% { box-shadow: 0 0 0 0 rgba(249,115,22,0), 0 0 24px rgba(249,115,22,.45); }
}
@keyframes lsgBobDown {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(8px); }
}
@keyframes lsgBobUp {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes lsgCardIn {
  from { opacity: 0; transform: translateY(8px) scale(.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
`;

const norm = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/[*•·:]+/g, ' ')
    .trim()
    .toLowerCase();

const stripTrailingCount = (s: string) =>
  norm(s)
    .replace(/\s+\d+\s*$/, '')
    .replace(/^\+\s*/, '+ ')
    .trim();

function isIgnored(el: Element | null): boolean {
  if (!el) return true;
  return !!el.closest(IGNORE_SELECTOR);
}

function isElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected || isIgnored(el)) return false;
  const style = window.getComputedStyle(el);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    parseFloat(style.opacity || '1') === 0
  ) {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width >= 6 && r.height >= 6;
}

function getAdviserRightEdge(): number {
  if (typeof document === 'undefined') return 0;
  if (!document.documentElement.hasAttribute('data-adviser-split')) return 0;
  const split = document.querySelector<HTMLElement>('.adviser-split');
  if (!split) return 0;
  const r = split.getBoundingClientRect();
  return r.width > 0 && r.right < window.innerWidth - 120 ? Math.round(r.right) : 0;
}

function activeAppDialog(): HTMLElement | null {
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].filter(
    (d) => !isIgnored(d) && d.getAttribute('aria-label') !== 'Adviser' && isElementVisible(d),
  );
  return dialogs.length ? dialogs[dialogs.length - 1] : null;
}

/**
 * Collects exact visible control / heading / button labels currently on the live app screen
 * (excluding Adviser's own panel) so ChatGPT can point accurately to real on-screen elements.
 */
export function collectVisibleScreenTargets(max = 45): string[] {
  if (typeof document === 'undefined') return [];
  const paneLeft = getAdviserRightEdge();
  const root: ParentNode = activeAppDialog() ?? document;
  const seen = new Set<string>();
  const out: string[] = [];

  const nodes = root.querySelectorAll<HTMLElement>(
    'button, a, [role="tab"], [role="button"], h1, h2, h3, th, input[placeholder], select[aria-label]',
  );

  for (const el of nodes) {
    if (out.length >= max) break;
    if (!isElementVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right < paneLeft + 4 || r.left > window.innerWidth + 800) continue;
    const raw =
      el.tagName === 'INPUT'
        ? el.getAttribute('placeholder') || el.getAttribute('aria-label') || ''
        : (el.innerText || el.textContent || el.getAttribute('aria-label') || el.getAttribute('title') || '');
    const clean = raw.replace(/\s+/g, ' ').trim();
    if (clean.length < 2 || clean.length > 44) continue;
    const key = norm(clean);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function promoteToInteractive(el: HTMLElement): HTMLElement {
  const clickable = el.closest<HTMLElement>('button, a, [role="button"], [role="tab"]');
  if (clickable && !isIgnored(clickable) && isElementVisible(clickable)) {
    const r = clickable.getBoundingClientRect();
    if (r.width <= 420 && r.height <= 120) return clickable;
  }
  return el;
}

function scoreCandidate(
  el: HTMLElement,
  queryRaw: string,
  paneLeft: number,
): number {
  if (!isElementVisible(el)) return -1;
  const r = el.getBoundingClientRect();
  // Avoid highlighting giant full-page wrapper containers
  if (r.width > window.innerWidth * 0.85 && r.height > window.innerHeight * 0.72) return -1;

  const q = norm(queryRaw);
  const qNoNum = stripTrailingCount(queryRaw);
  const qNoPlus = q.replace(/^\+\s*/, '').trim();
  if (!q) return -1;

  const tag = el.tagName.toLowerCase();
  const isInteractive =
    tag === 'button' ||
    tag === 'a' ||
    tag === 'input' ||
    tag === 'select' ||
    tag === 'textarea' ||
    el.getAttribute('role') === 'button' ||
    el.getAttribute('role') === 'tab';

  const isHeading = tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'th' || tag === 'label';

  const textRaw =
    tag === 'input' || tag === 'textarea'
      ? el.getAttribute('placeholder') || el.getAttribute('aria-label') || ''
      : (el.innerText || el.textContent || '');
  const txt = norm(textRaw);
  const txtNoNum = stripTrailingCount(textRaw);
  const txtNoPlus = txt.replace(/^\+\s*/, '').trim();
  const aria = norm(el.getAttribute('aria-label') || '');
  const title = norm(el.getAttribute('title') || '');
  const placeholder = norm(el.getAttribute('placeholder') || '');

  // Ignore huge blocks of text (e.g., whole cards or tables)
  if (!isInteractive && txt.length > 90) return -1;

  let score = -1;

  if (txt === q || aria === q || title === q || placeholder === q) {
    score = isInteractive ? 110 : isHeading ? 95 : 85;
  } else if (
    (txtNoNum && txtNoNum === qNoNum) ||
    (txtNoPlus && qNoPlus && txtNoPlus === qNoPlus)
  ) {
    score = isInteractive ? 102 : isHeading ? 90 : 80;
  } else if (
    (txt && txt.includes(q)) ||
    (aria && aria.includes(q)) ||
    (title && title.includes(q)) ||
    (placeholder && placeholder.includes(q))
  ) {
    const excess = Math.max(0, txt.length - q.length);
    score = (isInteractive ? 86 : isHeading ? 74 : 62) - Math.min(24, excess * 0.45);
  } else if (
    qNoPlus.length >= 3 &&
    ((txtNoPlus && txtNoPlus.includes(qNoPlus)) ||
      (txtNoNum && qNoNum.length >= 3 && txtNoNum.includes(qNoNum)))
  ) {
    const excess = Math.max(0, txt.length - qNoPlus.length);
    score = (isInteractive ? 78 : isHeading ? 68 : 54) - Math.min(24, excess * 0.45);
  } else {
    // Word overlap match (handles slight singular/plural variations like "Enquiry" vs "Enquiries")
    const qWords = qNoPlus
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .map((w) => w.replace(/(ies|es|s)$/, ''));
    if (qWords.length > 0 && txt) {
      const hits = qWords.filter((stem) => txt.includes(stem)).length;
      if (hits === qWords.length) {
        const excess = Math.max(0, txt.length - q.length);
        score = (isInteractive ? 68 : isHeading ? 58 : 44) - Math.min(22, excess * 0.4);
      }
    }
  }

  if (score <= 0) return -1;

  // Prefer elements clearly visible inside the right-hand app pane
  if (r.left >= paneLeft - 6 && r.right <= window.innerWidth + 12 && r.top >= -4 && r.bottom <= window.innerHeight + 12) {
    score += 10;
  } else if (r.left >= paneLeft - 6) {
    score += 4;
  }

  // Prefer leaf/compact elements over big wrappers
  if (el.children.length === 0) score += 3;

  return score;
}

export function findLiveScreenTarget(
  target?: string,
  fallbackAction?: string,
): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const queries = [target, fallbackAction]
    .map((x) => (x || '').replace(/^click\s+/i, '').trim())
    .filter((x) => x.length >= 2);
  if (!queries.length) return null;

  const paneLeft = getAdviserRightEdge();
  const dlg = activeAppDialog();
  const scopes: ParentNode[] = dlg ? [dlg, document] : [document];

  const selector =
    'button, a, [role="button"], [role="tab"], input, select, textarea, h1, h2, h3, h4, th, label, span, p, div';

  for (const query of queries) {
    for (const scope of scopes) {
      let best: HTMLElement | null = null;
      let bestScore = 0;

      const candidates = scope.querySelectorAll<HTMLElement>(selector);
      for (const el of candidates) {
        if (el.children.length > 4 && !['BUTTON', 'A'].includes(el.tagName)) continue;
        const sc = scoreCandidate(el, query, paneLeft);
        if (sc > bestScore) {
          bestScore = sc;
          best = el;
        }
      }

      // If matched a <label>, see if there's an adjacent input/select to highlight instead
      if (best && best.tagName === 'LABEL') {
        const forId = best.getAttribute('for');
        const linked = forId ? document.getElementById(forId) : null;
        if (linked && isElementVisible(linked)) return linked;
        const sibInput = best.parentElement?.querySelector<HTMLElement>(
          'input:not([type="hidden"]), select, textarea',
        );
        if (sibInput && isElementVisible(sibInput)) return sibInput;
      }

      if (best && bestScore >= 40) {
        return promoteToInteractive(best);
      }
    }
  }
  return null;
}

const sameRect = (a: BoxRect | null, b: BoxRect | null) =>
  (!a && !b) ||
  (!!a &&
    !!b &&
    Math.abs(a.x - b.x) < 0.8 &&
    Math.abs(a.y - b.y) < 0.8 &&
    Math.abs(a.w - b.w) < 0.8 &&
    Math.abs(a.h - b.h) < 0.8);

const AUTO_STEP_MS = 6200;

export function LiveScreenGuide({
  lesson,
  lang,
  currentPath,
  onNavigate,
  onSpeakStep,
  onStopSpeak,
  onClose,
}: LiveScreenGuideProps) {
  const steps = lesson.steps;
  const total = steps.length;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [rect, setRect] = useState<BoxRect | null>(null);
  const [paneLeft, setPaneLeft] = useState<number>(() => getAdviserRightEdge());
  const [locating, setLocating] = useState(true);
  const [voiceStep, setVoiceStep] = useState(false);

  const targetElRef = useRef<HTMLElement | null>(null);
  const navigatedRef = useRef<string>('');
  const step: TeachStep | undefined = steps[idx] ?? steps[0];
  const ta = lang === 'ta';

  // Reset when a brand-new lesson starts
  useEffect(() => {
    setIdx(0);
    setPlaying(true);
    setProgress(0);
    navigatedRef.current = '';
  }, [lesson]);

  // Navigate automatically if the step (or lesson) lives on another route
  const desiredRoute = useMemo(() => {
    const raw = step?.route || lesson.route || '';
    if (!raw) return '';
    return raw.startsWith('/') ? raw : `/${raw}`;
  }, [step?.route, lesson.route]);

  useEffect(() => {
    if (!desiredRoute) return;
    const normCur = currentPath.replace(/\/+$/, '') || '/';
    const normWant = desiredRoute.replace(/\/+$/, '') || '/';
    if (normCur !== normWant && navigatedRef.current !== `${idx}:${normWant}`) {
      navigatedRef.current = `${idx}:${normWant}`;
      onNavigate(normWant);
    }
  }, [desiredRoute, currentPath, idx, onNavigate]);

  // Locate target element (retries cleanly while page/route/modal renders) & scroll smoothly into view
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let attempts = 0;
    let scrolled = false;
    setLocating(true);
    targetElRef.current = null;

    const findNow = () => {
      if (cancelled) return;
      const el = findLiveScreenTarget(step.target, step.action);
      if (el) {
        targetElRef.current = el;
        setLocating(false);
        if (!scrolled) {
          scrolled = true;
          try {
            el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
          } catch {
            /* not scrollable */
          }
        }
        return;
      }
      attempts += 1;
      if (attempts < 18) {
        window.setTimeout(findNow, 180);
      } else {
        setLocating(false);
      }
    };

    const startTimer = window.setTimeout(findNow, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
    };
  }, [step, idx, currentPath]);

  // Live RAF tracker so the spotlight glides smoothly & tracks scrolling, resizing, and Adviser split resizing
  useEffect(() => {
    let raf = 0;
    let tickCount = 0;
    const tick = () => {
      tickCount += 1;
      const left = getAdviserRightEdge();
      setPaneLeft((prev) => (Math.abs(prev - left) > 1 ? left : prev));

      if (step && (tickCount % 20 === 0 || !targetElRef.current || !targetElRef.current.isConnected)) {
        const refreshed = findLiveScreenTarget(step.target, step.action);
        if (refreshed) targetElRef.current = refreshed;
      }

      const el = targetElRef.current;
      let nextRect: BoxRect | null = null;
      if (el && el.isConnected && isElementVisible(el)) {
        const r = el.getBoundingClientRect();
        // Clamp slightly so spotlight never bleeds left over Adviser
        const clampedX = Math.max(left + 4, r.left);
        const clampedW = Math.max(12, r.right - clampedX);
        if (r.right > left + 12 && r.bottom > 0 && r.top < window.innerHeight) {
          nextRect = { x: clampedX, y: r.top, w: clampedW, h: r.height };
        }
      }
      setRect((prev) => (sameRect(prev, nextRect) ? prev : nextRect));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  // Optional step voice narration when user enables read-aloud on the live guide
  useEffect(() => {
    if (!voiceStep || !step || !onSpeakStep) return;
    onStopSpeak?.();
    const spoken = `${step.title}. ${step.detail}`.trim();
    if (spoken) onSpeakStep(spoken);
    return () => {
      onStopSpeak?.();
    };
  }, [idx, voiceStep, step, onSpeakStep, onStopSpeak]);

  // Auto-advance timer (smooth progress bar; parks gracefully on last step)
  useEffect(() => {
    if (!playing || total <= 1 || idx >= total - 1) {
      setProgress(idx >= total - 1 ? 100 : 0);
      return;
    }
    const start = Date.now();
    const iv = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / AUTO_STEP_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        window.clearInterval(iv);
        setIdx((cur) => (cur < total - 1 ? cur + 1 : cur));
      }
    }, 60);
    return () => window.clearInterval(iv);
  }, [playing, idx, total]);

  // Escape closes the on-screen spotlight
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onStopSpeak?.();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, onStopSpeak]);

  const goPrev = useCallback(() => {
    setPlaying(false);
    setProgress(0);
    setIdx((cur) => Math.max(0, cur - 1));
  }, []);

  const goNext = useCallback(() => {
    setProgress(0);
    setIdx((cur) => {
      if (cur < total - 1) return cur + 1;
      setPlaying(false);
      return cur;
    });
  }, [total]);

  const replay = useCallback(() => {
    setIdx(0);
    setProgress(0);
    setPlaying(true);
  }, []);

  const clickHighlightedElement = useCallback(() => {
    const el = targetElRef.current;
    if (!el || !el.isConnected) return;
    setPlaying(false);
    el.click();
    if (idx < total - 1) {
      window.setTimeout(() => setIdx((cur) => Math.min(total - 1, cur + 1)), 420);
    }
  }, [idx, total]);

  if (!step || typeof document === 'undefined') return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rightW = Math.max(260, vw - paneLeft);
  const pad = 7;

  // Compute target spotlight hole relative to the right-side overlay SVG
  const hole = rect
    ? {
        x: Math.max(4, rect.x - paneLeft - pad),
        y: Math.max(4, rect.y - pad),
        w: rect.w + pad * 2,
        h: rect.h + pad * 2,
      }
    : null;

  // Smart floating explanation card placement right next to the highlighted element (never over Adviser)
  const cardW = Math.min(350, rightW - 24);
  const estCardH = 225;
  let cardLeft = paneLeft + Math.max(12, Math.round((rightW - cardW) / 2));
  let cardTop = Math.max(20, Math.round(vh - estCardH - 24));
  let arrowAbove = true;

  if (rect) {
    arrowAbove = rect.y > 120;
    const centerX = rect.x + rect.w / 2 - cardW / 2;
    cardLeft = Math.min(vw - cardW - 14, Math.max(paneLeft + 14, Math.round(centerX)));

    const spaceBelow = vh - (rect.y + rect.h + 24);
    const spaceAbove = rect.y - 24;
    if (spaceBelow >= estCardH) {
      cardTop = Math.round(rect.y + rect.h + (arrowAbove ? 18 : 54));
    } else if (spaceAbove >= estCardH) {
      cardTop = Math.max(14, Math.round(rect.y - estCardH - (arrowAbove ? 54 : 18)));
    } else {
      // Place beside on right or left if tall element (like a full column)
      const rightSpace = vw - (rect.x + rect.w + 18);
      const leftSpace = rect.x - paneLeft - 18;
      if (rightSpace >= cardW) {
        cardLeft = Math.round(rect.x + rect.w + 16);
        cardTop = Math.min(vh - estCardH - 14, Math.max(16, Math.round(rect.y)));
      } else if (leftSpace >= cardW) {
        cardLeft = Math.round(rect.x - cardW - 16);
        cardTop = Math.min(vh - estCardH - 14, Math.max(16, Math.round(rect.y)));
      } else {
        cardTop = rect.y + rect.h / 2 > vh * 0.5 ? 18 : Math.max(18, vh - estCardH - 18);
      }
    }
  }

  const targetTag = targetElRef.current?.tagName.toLowerCase() ?? '';
  const targetClickable =
    !!targetElRef.current &&
    (targetTag === 'button' ||
      targetTag === 'a' ||
      targetElRef.current.getAttribute('role') === 'button' ||
      targetElRef.current.getAttribute('role') === 'tab');

  return createPortal(
    <div data-live-guide-ignore>
      <style>{STYLE_CSS}</style>

      {/* Dim backdrop clipped strictly to the right-side real app pane so Adviser on the left stays 100% bright & interactive */}
      <svg
        aria-hidden
        className="pointer-events-none fixed top-0 z-[84]"
        style={{ left: paneLeft, width: rightW, height: vh }}
        width={rightW}
        height={vh}
      >
        <defs>
          <mask id="adviser-live-spotlight-mask">
            <rect x="0" y="0" width={rightW} height={vh} fill="white" />
            {hole && (
              <rect
                x={hole.x}
                y={hole.y}
                width={hole.w}
                height={hole.h}
                rx="12"
                ry="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={rightW}
          height={vh}
          fill="rgba(15, 23, 42, 0.44)"
          mask="url(#adviser-live-spotlight-mask)"
        />
      </svg>

      {/* Glowing animated spotlight frame directly around the exact real DOM element */}
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[86]"
          style={{
            left: rect.x - pad,
            top: rect.y - pad,
            width: rect.w + pad * 2,
            height: rect.h + pad * 2,
            borderRadius: 12,
            border: '3px solid #f97316',
            transition: 'all 360ms cubic-bezier(.22,1,.36,1)',
            animation: 'lsgPulse 1.5s infinite',
          }}
        >
          {/* Step badge pinned onto top-left corner of the real element */}
          <span
            className="absolute -left-2 -top-3 inline-flex items-center gap-1 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-lg"
          >
            {idx + 1}/{total}
          </span>
        </div>
      )}

      {/* Animated bouncing pointer arrow aimed straight at the highlighted real element */}
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[87] flex flex-col items-center"
          style={{
            left: Math.min(vw - 44, Math.max(paneLeft + 12, rect.x + rect.w / 2 - 22)),
            top: arrowAbove ? Math.max(6, rect.y - 52) : Math.min(vh - 52, rect.y + rect.h + 10),
            transition: 'left 360ms cubic-bezier(.22,1,.36,1), top 360ms cubic-bezier(.22,1,.36,1)',
          }}
        >
          <div style={{ animation: `${arrowAbove ? 'lsgBobDown' : 'lsgBobUp'} .9s ease-in-out infinite` }}>
            {arrowAbove && (
              <span className="mb-0.5 block rounded-full bg-orange-600 px-2 py-0.5 text-center text-[10px] font-extrabold text-white shadow">
                {ta ? 'இங்கே' : 'Here'}
              </span>
            )}
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 34"
              fill="#f97316"
              className="mx-auto"
              style={{
                transform: arrowAbove ? 'none' : 'rotate(180deg)',
                filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.35))',
              }}
            >
              <path d="M14 34 2 16h8V0h8v16h8z" />
            </svg>
            {!arrowAbove && (
              <span className="mt-0.5 block rounded-full bg-orange-600 px-2 py-0.5 text-center text-[10px] font-extrabold text-white shadow">
                {ta ? 'இங்கே' : 'Here'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Floating Explanation Callout right next to the highlighted element */}
      <div
        role="region"
        aria-label="Live screen guide"
        className="fixed z-[88] overflow-hidden rounded-2xl border-2 border-orange-400/90 bg-white shadow-2xl"
        style={{
          left: cardLeft,
          top: cardTop,
          width: cardW,
          transition: 'left 340ms cubic-bezier(.22,1,.36,1), top 340ms cubic-bezier(.22,1,.36,1)',
          animation: 'lsgCardIn .25s ease-out',
        }}
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-2 text-white">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Crosshair size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-extrabold leading-tight">{lesson.title}</p>
            <p className="text-[10px] text-orange-50">
              {ta ? `படி ${idx + 1} / ${total}` : `Step ${idx + 1} of ${total}`}
              {step.target ? ` · ${step.target}` : ''}
            </p>
          </div>
          {onSpeakStep && (
            <button
              type="button"
              onClick={() => {
                const next = !voiceStep;
                setVoiceStep(next);
                if (!next) onStopSpeak?.();
              }}
              title={voiceStep ? 'Mute step voice' : 'Read step aloud'}
              className="rounded-lg p-1 text-white/90 hover:bg-white/20"
            >
              {voiceStep ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onStopSpeak?.();
              onClose();
            }}
            aria-label="Close screen guide"
            title="Close (Esc)"
            className="rounded-lg p-1 text-white/90 hover:bg-white/20"
          >
            <X size={15} />
          </button>
        </div>

        {/* Explanation Body */}
        <div className="px-3.5 py-3">
          {step.target && (
            <div className="mb-1.5 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  rect
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    rect ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                {rect
                  ? ta
                    ? `காட்டுகிறது: ${step.target}`
                    : `Showing: ${step.target}`
                  : locating
                    ? ta
                      ? 'திரையில் தேடுகிறது…'
                      : 'Locating on screen…'
                    : step.target}
              </span>
            </div>
          )}

          <p className="text-[14px] font-bold leading-snug text-slate-900">{step.title}</p>
          {step.detail && (
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-700">{step.detail}</p>
          )}

          {targetClickable && (
            <button
              type="button"
              onClick={clickHighlightedElement}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              <MousePointerClick size={13} />
              {ta ? `"${step.target || 'இதை'}" கிளிக் செய்` : `Click "${step.target || 'this'}"`}
            </button>
          )}
        </div>

        {/* Progress strip */}
        {total > 1 && (
          <div className="h-1 w-full bg-slate-100">
            <div
              className="h-full bg-orange-500 transition-all duration-100"
              style={{ width: `${playing ? progress : ((idx + 1) / total) * 100}%` }}
            />
          </div>
        )}

        {/* Footer Controls */}
        <div className="flex items-center justify-between gap-1.5 border-t border-slate-100 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <button
                key={`${s.title}-${i}`}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setProgress(0);
                  setIdx(i);
                }}
                title={s.title}
                className={`h-2 rounded-full transition-all ${
                  i === idx ? 'w-5 bg-orange-500' : i < idx ? 'w-2 bg-emerald-500' : 'w-2 bg-slate-300'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrev}
              disabled={idx === 0}
              title={ta ? 'முந்தையது' : 'Previous'}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-35"
            >
              <ChevronLeft size={14} />
            </button>

            {total > 1 && idx < total - 1 ? (
              <button
                type="button"
                onClick={() => setPlaying((v) => !v)}
                title={playing ? (ta ? 'நிறுத்து' : 'Pause') : (ta ? 'தொடர்' : 'Auto-play')}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                {playing ? <Pause size={11} /> : <Play size={11} />}
                {playing ? (ta ? 'நிறுத்து' : 'Pause') : (ta ? 'Play' : 'Play')}
              </button>
            ) : (
              <button
                type="button"
                onClick={replay}
                title={ta ? 'மீண்டும் காட்டு' : 'Replay'}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
              >
                <RotateCcw size={11} />
                {ta ? 'மீண்டும்' : 'Replay'}
              </button>
            )}

            {idx < total - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex h-7 items-center gap-0.5 rounded-lg bg-orange-600 px-2.5 text-[11px] font-bold text-white hover:bg-orange-700"
              >
                {ta ? 'அடுத்து' : 'Next'}
                <ChevronRight size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onStopSpeak?.();
                  onClose();
                }}
                className="inline-flex h-7 items-center rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-700"
              >
                {ta ? 'முடிந்தது' : 'Done'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
