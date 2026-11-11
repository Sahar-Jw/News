'use client';
import { useEffect, useRef, useState } from 'react';
import { useTr } from './women-manage';

/** Women-theme pager: pill buttons in the page colours (active = the dark "secondary" colour, like the tabs). */
export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  const tr = useTr();
  if (pages <= 1) return null;
  // 1 … 4 5 [6] 7 8 … 20
  const nums: (number | 'gap-a' | 'gap-b')[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== 'gap-a' && nums[nums.length - 1] !== 'gap-b') nums.push(i < page ? 'gap-a' : 'gap-b');
  }
  const base = 'grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm font-semibold transition';
  const idle = 'bg-white text-secondary ring-1 ring-line hover:text-primary hover:ring-accent';
  const arrow = (dir: 'prev' | 'next') => (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={dir === 'next' ? 'rtl:rotate-180' : 'rotate-180 rtl:rotate-0'}><path d="m6 3 5 5-5 5" /></svg>
  );
  return (
    <nav aria-label={tr('تصفّح الصفحات', 'Pagination')} className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={tr('السابق', 'Previous')} className={`${base} ${idle} disabled:pointer-events-none disabled:opacity-40`}>{arrow('prev')}</button>
      {nums.map((n) => typeof n === 'string'
        ? <span key={n} className="px-1 text-gray-400" aria-hidden="true">…</span>
        : <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${tr('صفحة', 'Page')} ${n}`} aria-current={n === page ? 'page' : undefined} className={`${base} ${n === page ? 'bg-secondary text-white shadow-card ring-1 ring-accent/60' : idle}`}>{n}</button>)}
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={tr('التالي', 'Next')} className={`${base} ${idle} disabled:pointer-events-none disabled:opacity-40`}>{arrow('next')}</button>
    </nav>
  );
}

/**
 * Splits `items` into pages of `size` and renders the current one with `render`, followed by the pager.
 * `resetKey` (a tab, a filter...) sends the list back to page 1 when it changes; an edit of the list itself keeps the page.
 */
export function Paged<T>({ items, size, resetKey = '', render }: { items: T[]; size: number; resetKey?: string; render: (slice: T[]) => React.ReactNode }) {
  const [page, setPage] = useState(1);
  const top = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  useEffect(() => { setPage(1); }, [resetKey]);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [current]);
  const go = (p: number) => { moved.current = true; setPage(p); };
  return (
    <div ref={top} className="scroll-mt-24">
      {render(items.slice((current - 1) * size, current * size))}
      <Pager page={current} pages={pages} onChange={go} />
    </div>
  );
}
