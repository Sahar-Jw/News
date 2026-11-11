'use client';
import { useI18n } from '@/lib/i18n';
import { fmtNum } from '@/lib/utils';

/** page numbers to show: always the first and last page and a window around the current one; `null` = a gap ("…") */
export function pageWindow(page: number, total: number, around = 1): (number | null)[] {
  const keep = new Set<number>([1, total]);
  for (let p = page - around; p <= page + around; p++) if (p >= 1 && p <= total) keep.add(p);
  const sorted = Array.from(keep).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

const base = 'inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';

/** Numbered pagination: previous / 1 2 3 … 9 / next. Renders nothing when everything fits on one page. */
export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const { t, lang } = useI18n();
  if (totalPages <= 1) return null;
  const go = (p: number) => onPage(Math.min(Math.max(1, p), totalPages));
  return (
    <nav aria-label={t('app.pages')} className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      <button type="button" className={`${base} bg-white hover:border-primary hover:text-primary`} disabled={page <= 1} onClick={() => go(page - 1)}>{t('app.prev')}</button>
      {pageWindow(page, totalPages).map((p, i) => p === null
        ? <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-gray-400">…</span>
        : <button key={p} type="button" aria-current={p === page ? 'page' : undefined} aria-label={`${t('app.page')} ${fmtNum(lang, p)}`} onClick={() => go(p)}
            className={`${base} ${p === page ? 'border-primary bg-primary text-white' : 'bg-white hover:border-primary hover:text-primary'}`}>{fmtNum(lang, p)}</button>)}
      <button type="button" className={`${base} bg-white hover:border-primary hover:text-primary`} disabled={page >= totalPages} onClick={() => go(page + 1)}>{t('app.next')}</button>
    </nav>
  );
}
