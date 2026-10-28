'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSite } from './site-context';
import type { Card } from './cards';

/** Scroll speed in pixels per second (same speed for 1 headline or 50). */
const TICKER_SPEED = 60;
/** Minimum empty space (px) kept between two headlines when the list has to be repeated to fill the bar. */
const MIN_GAP = 160;

/** Black or white text, whichever reads better on the given #hex background. */
function readableOn(hex: string) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111827' : '#ffffff';
}

/**
 * Breaking-news bar.
 *
 * The headlines sit on a loop (a "conveyor") that is made of two identical halves, and the track slides by
 * exactly one half, so the animation restarts without any visible jump.
 *
 * - Each half is at least as wide as the bar. The bar is therefore always full: when a headline leaves one
 *   side, the next one (or the same one, if there is only one) is already entering from the other side.
 * - With few headlines the list is repeated just enough to fill the bar, spread evenly with at least MIN_GAP
 *   between headlines (so one headline is not cloned edge to edge, and the bar is not left mostly empty).
 * - With many headlines the half is as wide as they need and they just keep flowing.
 * - The bar itself is always laid out left-to-right (dir="ltr" on the viewport), so the track is anchored to the
 *   left edge in both languages. In a right-to-left page the track would otherwise be anchored to the right edge
 *   and the animation would slide it completely out of view. Only the direction of travel changes for Arabic
 *   (data-rtl -> animation-direction: reverse in globals.css), and the headlines are fed in reading order so the
 *   first one enters first. Hovering pauses the bar.
 */
export function BreakingTicker({ items }: { items: Card[] }) {
  const { t, href, lang } = useI18n();
  const rtl = lang === 'ar';
  const { s } = useSite();
  // Two independent colours (Settings → appearance); an empty one keeps the built-in look:
  //   breaking_bg_color        -> the scrolling bar   (default: red gradient)
  //   breaking_label_bg_color  -> the «Breaking» label at the start of the bar (default: dark red / dark overlay)
  const bg = s('appearance', 'breaking_bg_color') as string | null;
  const labelBg = s('appearance', 'breaking_label_bg_color') as string | null;
  const viewRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(0); // width in px of one half of the loop
  const [reps, setReps] = useState(1); // how many times the list is repeated inside one half

  useEffect(() => {
    const view = viewRef.current;
    const one = measureRef.current;
    if (!view || !one) return;
    const calc = () => {
      const natural = one.getBoundingClientRect().width; // all headlines side by side
      const bar = view.getBoundingClientRect().width;
      if (natural <= 0 || bar <= 0) return;
      // Each headline appears once per half (never cloned side by side); the empty space just scrolls past.
      const next = Math.ceil(Math.max(natural + MIN_GAP, bar));
      setReps(1);
      setCell((prev) => (Math.abs(prev - next) < 2 ? prev : next));
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(view);
    ro.observe(one);
    return () => ro.disconnect();
  }, [items]);

  if (!items.length) return null;

  const ordered = rtl ? [...items].reverse() : items;
  const fade = 'linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%)';
  const headline = (n: Card, key: string) => (
    <Link key={key} dir="auto" href={href(`/news/view?id=${n.id}`)} className="px-5 text-sm hover:underline">● {n.title}</Link>
  );

  return (
    <div
      className={`no-print flex items-center overflow-hidden ${bg ? '' : 'bg-gradient-to-r from-red-700 via-red-600 to-red-500 text-white'}`}
      style={bg ? { background: bg, color: readableOn(bg) } : undefined}
    >
      <span
        className={`z-10 flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-bold ${labelBg ? '' : bg ? 'bg-black/25' : 'bg-red-900 text-white'}`}
        style={labelBg ? { background: labelBg, color: readableOn(labelBg) } : undefined}
      >
        <span className="relative flex h-2 w-2" aria-hidden="true"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-current" /></span>
        {t('site.breaking')}
      </span>
      <div ref={viewRef} dir="ltr" className="relative min-w-0 flex-1 overflow-hidden" style={{ WebkitMaskImage: fade, maskImage: fade }}>
        {/* hidden copy used only to measure how wide the headlines are */}
        <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute flex w-max whitespace-nowrap py-2">
          {ordered.map((n) => <span key={n.id} className="px-5 text-sm">● {n.title}</span>)}
        </div>
        <div
          data-rtl={rtl}
          className={`ticker-track flex w-max whitespace-nowrap ${cell ? '' : 'invisible'}`}
          style={cell ? ({ '--ticker-duration': `${Math.max(8, cell / TICKER_SPEED)}s` } as React.CSSProperties) : undefined}
        >
          {[0, 1].map((side) => (
            <div key={side} aria-hidden={side === 1 || undefined} className="flex shrink-0 items-center py-2" style={cell ? { width: cell } : undefined}>
              {Array.from({ length: reps }, (_, r) => ordered.map((n) => headline(n, `${n.id}-${side}-${r}`)))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
