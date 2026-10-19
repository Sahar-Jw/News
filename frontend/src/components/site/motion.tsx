'use client';
import { useEffect, useRef, useState } from 'react';

/** True once the element has scrolled into view (and stays true). */
function useSeen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

/** Rises into place once, the first time it is scrolled into view. */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return <div ref={ref} data-reveal="" data-in={seen ? '' : undefined} style={delay ? ({ '--d': `${delay}ms` } as React.CSSProperties) : undefined} className={className}>{children}</div>;
}

/** Grid / flex container whose direct children rise one after another when it is first seen. */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  return <div ref={ref} data-stagger="" data-in={seen ? '' : undefined} className={className}>{children}</div>;
}

/** Counts a figure up from zero when first seen ("15,000+" → 0 … 15,000+). Text that holds no number is shown as is. */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const m = value.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/);
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    const mm = value.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/);
    if (!el || !mm) return;
    const target = parseFloat(mm[2].replace(/,/g, ''));
    const decimals = (mm[2].split('.')[1] ?? '').length;
    const grouped = mm[2].includes(',');
    const fmt = (v: number) => (grouped ? v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : v.toFixed(decimals));
    if (!Number.isFinite(target) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(mm[2]); return; }
    setShown(fmt(0));
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 1400);
        setShown(fmt(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  if (!m) return <span className={className}>{value}</span>;
  return <bdi ref={ref} dir="auto" className={className}>{m[1]}{shown ?? m[2]}{m[3]}</bdi>;
}

/** Thin bar at the top of the window showing how far down the article you are. */
export function ReadingProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? Math.min(1, h.scrollTop / max) : 0);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);
  return <div aria-hidden="true" className="no-print fixed inset-x-0 top-0 z-50 h-1 origin-left bg-primary transition-transform duration-150 ease-out rtl:origin-right" style={{ transform: `scaleX(${p})` }} />;
}
