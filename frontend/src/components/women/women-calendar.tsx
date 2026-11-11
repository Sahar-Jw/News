'use client';
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { useTr } from './women-manage';

export interface CalItem { id: number; start: string; end: string; live: boolean }

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const MAX_SPAN_DAYS = 400; // a typo such as year 2062 must not freeze the page

/** every day (yyyy-mm-dd) from `a` to `b`, both included */
function eachDay(a: string, b: string): string[] {
  const out: string[] = [];
  const d = new Date(`${a}T00:00:00Z`);
  const stop = new Date(`${b}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(stop.getTime())) return out;
  while (d <= stop && out.length < MAX_SPAN_DAYS) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

/**
 * Small month calendar for the side of the initiatives / activities pages (women theme).
 * Days that have an item are tinted (a range is tinted day by day) and get a dot; today has a ring;
 * clicking a day selects it (the page then lists only the items of that day), clicking it again clears it.
 */
export function WomenCalendar({ items, today, selected, onSelect }: { items: CalItem[]; today: string; selected: string | null; onSelect: (day: string | null) => void }) {
  const { lang } = useI18n();
  const tr = useTr();
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1];
  const [view, setView] = useState({ y: ty, m: tm });

  // day -> { n: items on that day, live: at least one is not over yet }
  const days = useMemo(() => {
    const map = new Map<string, { n: number; live: boolean }>();
    for (const it of items) {
      for (const d of eachDay(it.start, it.end)) {
        const cur = map.get(d) ?? { n: 0, live: false };
        map.set(d, { n: cur.n + 1, live: cur.live || it.live });
      }
    }
    return map;
  }, [items]);

  const monthStart = ymd(view.y, view.m, 1);
  const monthEnd = ymd(view.y, view.m, new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate());
  const inMonth = items.filter((it) => it.start <= monthEnd && it.end >= monthStart).length;

  const ar = lang === 'ar';
  const weekStart = ar ? 6 : 0; // Saturday-first in Arabic, Sunday-first in English
  const first = new Date(Date.UTC(view.y, view.m, 1));
  const offset = (first.getUTCDay() - weekStart + 7) % 7;
  const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const fmt = (opts: Intl.DateTimeFormatOptions, d: Date) => new Intl.DateTimeFormat(ar ? 'ar' : 'en-GB', { ...opts, timeZone: 'UTC' }).format(d);
  const title = fmt({ month: 'long', year: 'numeric' }, first);
  const weekdays = Array.from({ length: 7 }, (_, i) => fmt({ weekday: 'narrow' }, new Date(Date.UTC(2023, 0, 1 + ((weekStart + i) % 7)))));
  const step = (delta: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + delta, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const nav = 'grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25';
  const chevron = (flip: boolean) => <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={flip ? 'rotate-180 rtl:rotate-0' : 'rtl:rotate-180'}><path d="m6 3 5 5-5 5" /></svg>;

  return (
    <section aria-label={tr('التقويم', 'Calendar')} className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
      <div className="flex items-center justify-between gap-2 bg-secondary px-3 py-3 text-white">
        <button type="button" onClick={() => step(-1)} aria-label={tr('الشهر السابق', 'Previous month')} className={nav}>{chevron(true)}</button>
        <div className="text-center"><div className="text-sm font-extrabold leading-tight">{title}</div></div>
        <button type="button" onClick={() => step(1)} aria-label={tr('الشهر التالي', 'Next month')} className={nav}>{chevron(false)}</button>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent" aria-hidden="true" />
      <div className="p-3">
        <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-bold text-gray-500" aria-hidden="true">{weekdays.map((w, i) => <span key={i}>{w}</span>)}</div>
        <div className="grid grid-cols-7 gap-y-1 text-center" role="grid">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />;
            const key = ymd(view.y, view.m, d);
            const info = days.get(key);
            const isToday = key === today;
            const isSel = key === selected;
            const cls = isSel ? 'bg-secondary font-bold text-white shadow-card'
              : info ? 'bg-primary/15 font-bold text-secondary hover:bg-primary/25'
                : 'text-ink/80 hover:bg-primary/10';
            return (
              <button key={i} type="button" role="gridcell" aria-pressed={isSel} disabled={!info && !isSel}
                onClick={() => onSelect(isSel ? null : key)}
                aria-label={`${fmtDay(lang, key)}${info ? ` (${info.n})` : ''}`}
                className={`relative mx-auto grid h-9 w-9 place-items-center rounded-full text-sm transition disabled:cursor-default ${cls} ${isToday ? 'ring-2 ring-accent' : ''}`}>
                {d}
                {info && <span aria-hidden="true" className={`absolute bottom-1 h-1 w-1 rounded-full ${isSel ? 'bg-white' : info.live ? 'bg-primary' : 'bg-gray-400'}`} />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-dashed border-line px-3 py-2.5 text-xs text-gray-600">
        <span>{inMonth ? tr(`${inMonth} في هذا الشهر`, `${inMonth} this month`) : tr('لا شيء في هذا الشهر', 'Nothing this month')}</span>
        <button type="button" onClick={() => { setView({ y: ty, m: tm }); onSelect(null); }} className="rounded-full px-3 py-1 font-bold text-primary transition hover:bg-primary/10">{tr('اليوم', 'Today')}</button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-primary/5 px-3 py-2 text-[11px] text-gray-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />{tr('قادم / جارٍ', 'Upcoming / ongoing')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-400" aria-hidden="true" />{tr('منتهٍ', 'Finished')}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full ring-2 ring-accent" aria-hidden="true" />{tr('اليوم', 'Today')}</span>
      </div>
    </section>
  );
}
