'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { DocResults, type Result } from '@/components/site/documents-browser';
import { useDocsManage } from '@/components/site/docs-manage';

/**
 * Library & digital archive: a long-term digital reference with every kind of document: studies, reports, bulletins, guides, laws,
 * decisions, circulars, forms, documents, media materials and historical documents. Browse by type (with counts), filter by year or
 * date range, search by words, number or issuer, and sort newest or oldest first.
 */
interface Type { key: string; icon: string; label: string; kinds: string[] }
const TYPES: Type[] = [
  { key: 'study', icon: '🔬', label: 'doc.kind.study', kinds: ['study'] },
  { key: 'report', icon: '📊', label: 'doc.kind.report', kinds: ['report'] },
  { key: 'bulletin', icon: '📰', label: 'doc.kind.bulletin', kinds: ['bulletin'] },
  { key: 'guide', icon: '🧭', label: 'doc.kind.guide', kinds: ['guide'] },
  { key: 'law', icon: '📚', label: 'doc.kind.law', kinds: ['law'] },
  { key: 'decision', icon: '⚖️', label: 'doc.kind.decision', kinds: ['decision'] },
  { key: 'circular', icon: '📣', label: 'doc.kind.circular', kinds: ['circular'] },
  { key: 'form', icon: '📝', label: 'doc.kind.form', kinds: ['form'] },
  { key: 'library', icon: '🗂', label: 'lib.documents', kinds: ['library'] },
  { key: 'media', icon: '🎞', label: 'doc.kind.media', kinds: ['press', 'mediakit'] },
  { key: 'historical', icon: '🏛', label: 'doc.kind.historical', kinds: ['historical'] },
];
const dateOk = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-semibold transition ${on ? 'border-primary bg-primary text-white' : 'bg-white text-gray-700 hover:border-primary'}`;

function Library() {
  const { lang, t, href } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const raw = sp.get('kind') ?? '';
  // a link to one of the media kinds (press / mediakit) lands on the "media materials" type
  const type = TYPES.find((x) => x.key === raw || x.kinds.includes(raw))?.key ?? '';
  const def = TYPES.find((x) => x.key === type);
  const year = /^\d{4}$/.test(sp.get('year') ?? '') ? (sp.get('year') as string) : '';
  const q = sp.get('q') ?? '';
  const issuer = sp.get('issuer') ?? '';
  const sort = sp.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const from = year ? `${year}-01-01` : dateOk(sp.get('from'));
  const to = year ? `${year}-12-31` : dateOk(sp.get('to'));
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const [text, setText] = useState(q);
  const [res, setRes] = useState<Result | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [years, setYears] = useState<number[]>([]);
  const [issuers, setIssuers] = useState<string[]>([]);
  const kinds = def ? def.kinds.join(',') : undefined;
  const manage = useDocsManage({ kind: def?.kinds[0] ?? 'library', tab: 'library' });

  useEffect(() => { setText(q); }, [q]);
  useEffect(() => { api<Record<string, number>>('/public/documents/counts', { cache: 'no-store' }).then(setCounts).catch(() => setCounts({})); }, [manage.rev]);
  useEffect(() => {
    api<number[]>('/public/documents/years', { params: { kinds }, cache: 'no-store' }).then(setYears).catch(() => setYears([]));
    api<string[]>('/public/documents/issuers', { params: { lang, kind: def?.kinds.length === 1 ? def.kinds[0] : undefined }, cache: 'no-store' }).then(setIssuers).catch(() => setIssuers([]));
  }, [lang, kinds]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setRes(null);
    api<Result>('/public/documents', { params: { lang, kinds, q, issuer, from, to, sort, page, limit: 12 }, cache: 'no-store' }).then(setRes).catch(() => setRes({ data: [], meta: { page: 1, totalPages: 1, total: 0 } }));
  }, [lang, kinds, q, issuer, from, to, sort, page, manage.rev]);

  const go = (next: { kind?: string; q?: string; issuer?: string; year?: string; from?: string; to?: string; sort?: string; page?: number }) => {
    const v = { kind: type, q, issuer, year, from: sp.get('from') ?? '', to: sp.get('to') ?? '', sort, ...next };
    const p = new URLSearchParams();
    if (v.kind) p.set('kind', v.kind);
    if (v.q) p.set('q', v.q);
    if (v.issuer) p.set('issuer', v.issuer);
    if (v.year) p.set('year', v.year); else { if (v.from) p.set('from', v.from); if (v.to) p.set('to', v.to); }
    if (v.sort === 'oldest') p.set('sort', 'oldest');
    if ((next.page ?? 1) > 1) p.set('page', String(next.page));
    router.push(href(`/library${p.toString() ? `?${p}` : ''}`));
  };
  const countOf = (x: Type) => x.kinds.reduce((n, k) => n + (counts[k] ?? 0), 0);
  const total = TYPES.reduce((n, x) => n + countOf(x), 0);
  const filtered = !!(q || issuer || year || sp.get('from') || sp.get('to'));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-secondary">{t('nav.library')}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">{t('lib.intro')}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
      </header>
      {manage.bar}

      {/* browse by type, with how many each holds */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" role="tablist" aria-label={t('doc.kind')}>
        <button type="button" role="tab" aria-selected={!type} onClick={() => go({ kind: '', page: 1 })} className={`rounded-2xl p-3 text-center ring-1 transition ${!type ? 'bg-secondary text-white ring-secondary' : 'bg-white ring-line hover:ring-primary'}`}>
          <div className="text-xl" aria-hidden="true">📖</div><div className="text-sm font-bold">{t('faq.all')}</div><div className="text-xs opacity-70">{total}</div>
        </button>
        {TYPES.map((x) => (
          <button key={x.key} type="button" role="tab" aria-selected={type === x.key} onClick={() => go({ kind: x.key, issuer: '', page: 1 })} className={`rounded-2xl p-3 text-center ring-1 transition ${type === x.key ? 'bg-secondary text-white ring-secondary' : 'bg-white ring-line hover:ring-primary'}`}>
            <div className="text-xl" aria-hidden="true">{x.icon}</div><div className="text-sm font-bold">{t(x.label)}</div><div className="text-xs opacity-70">{countOf(x)}</div>
          </button>
        ))}
      </div>

      {/* browse by date */}
      {years.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2" aria-label={t('doc.byYear')}>
          <span className="text-xs text-gray-500">{t('doc.byYear')}:</span>
          <button type="button" aria-pressed={!year} className={`${chip(!year)} !px-3 !py-1 !text-xs`} onClick={() => go({ year: '', page: 1 })}>{t('md.allYears')}</button>
          {years.map((y) => <button key={y} type="button" aria-pressed={year === String(y)} className={`${chip(year === String(y))} !px-3 !py-1 !text-xs`} onClick={() => go({ year: String(y), from: '', to: '', page: 1 })}>{y}</button>)}
        </div>
      )}

      <form className="mb-6 grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto_auto]" onSubmit={(e) => { e.preventDefault(); go({ q: text.trim(), page: 1 }); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={t('doc.search')} aria-label={t('doc.search')} className="min-w-0 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-primary" />
        <label className="flex items-center gap-1.5 text-xs text-gray-500">{t('doc.from')}<input type="date" value={year ? '' : from} max={to || undefined} onChange={(e) => go({ from: e.target.value, year: '', page: 1 })} className="rounded-xl border border-line bg-white px-2 py-2 text-sm text-ink outline-none focus:border-primary" /></label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">{t('doc.to')}<input type="date" value={year ? '' : to} min={from || undefined} onChange={(e) => go({ to: e.target.value, year: '', page: 1 })} className="rounded-xl border border-line bg-white px-2 py-2 text-sm text-ink outline-none focus:border-primary" /></label>
        <select value={issuer} onChange={(e) => go({ issuer: e.target.value, page: 1 })} aria-label={t('doc.issuer')} className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary">
          <option value="">{t('doc.allIssuers')}</option>
          {issuers.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={sort} onChange={(e) => go({ sort: e.target.value, page: 1 })} aria-label={t('lib.sort')} className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary">
          <option value="newest">{t('lib.newest')}</option>
          <option value="oldest">{t('lib.oldest')}</option>
        </select>
        <div className="flex gap-2">
          <button className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110">{t('doc.searchBtn')}</button>
          {filtered && <button type="button" onClick={() => go({ q: '', issuer: '', year: '', from: '', to: '', page: 1 })} className="rounded-xl border border-line px-3 py-2 text-sm text-gray-600 hover:border-primary">{t('os.clear')}</button>}
        </div>
      </form>
      {res && res.meta.total > 0 && <p className="mb-3 text-center text-xs text-gray-500">{res.meta.total} {t('doc.items')}</p>}
      <DocResults res={res} onPage={(n) => go({ page: n })} actions={manage.actions} />
      {manage.dialogs}
    </div>
  );
}

export function LibrarySection() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Library /></Suspense>;
}
