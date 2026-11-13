'use client';
import { useCrumbTitle } from '@/components/site/breadcrumbs';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { DocResults, type Result } from '@/components/site/documents-browser';
import { useDocsManage } from '@/components/site/docs-manage';

/**
 * Decisions & circulars: one section of its own with three parts.
 *  1. Circulars: the official circulars, by date, with search and filters.
 *  2. Decisions: government decisions, commercial / economic decisions, decisions about members.
 *  3. Laws & regulations: laws, instructions, regulations and guides, each with its PDF.
 * /documents shows the section home; /documents?part=circular|decision|law opens a part (part=all searches all of them).
 */
type Part = 'circular' | 'decision' | 'law';
interface Chip { key: string; label: string; kind: string; subtype?: string }

const PARTS: { key: Part; icon: string; title: string; text: string; kinds: string[] }[] = [
  { key: 'circular', icon: '📣', title: 'doc.part.circular', text: 'doc.part.circularText', kinds: ['circular'] },
  { key: 'decision', icon: '⚖️', title: 'doc.part.decision', text: 'doc.part.decisionText', kinds: ['decision'] },
  { key: 'law', icon: '📚', title: 'doc.part.law', text: 'doc.part.lawText', kinds: ['law', 'guide'] },
];
const CHIPS: Record<Part, Chip[]> = {
  circular: [],
  decision: [
    { key: 'government', label: 'doc.sub.government', kind: 'decision', subtype: 'government' },
    { key: 'economic', label: 'doc.sub.economic', kind: 'decision', subtype: 'economic' },
    { key: 'members', label: 'doc.sub.members', kind: 'decision', subtype: 'members' },
  ],
  law: [
    { key: 'law', label: 'doc.sub.law', kind: 'law', subtype: 'law' },
    { key: 'instruction', label: 'doc.sub.instruction', kind: 'law', subtype: 'instruction' },
    { key: 'regulation', label: 'doc.sub.regulation', kind: 'law', subtype: 'regulation' },
    { key: 'guide', label: 'doc.sub.guide', kind: 'guide' },
  ],
};
const dateOk = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const chip = (on: boolean) => `rounded-full border px-4 py-1.5 text-sm font-semibold transition ${on ? 'border-primary bg-primary text-white' : 'bg-white text-gray-700 hover:border-primary'}`;

function Header({ title, text }: { title: string; text?: string }) {
  return (
    <header className="mb-6 text-center">
      <h1 className="text-2xl font-extrabold text-secondary">{title}</h1>
      {text && <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">{text}</p>}
      <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
    </header>
  );
}

/** the section home: the three parts with their counts and latest items, and a search over everything */
function Home() {
  const { lang, t, href } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [data, setData] = useState<Record<string, Result | null>>({});
  const manage = useDocsManage({ kind: 'circular' });
  useEffect(() => {
    PARTS.forEach((p) => {
      // one request per kind: the part's "law" also holds the guides, so its count adds them up
      Promise.all(p.kinds.map((kind) => api<Result>('/public/documents', { params: { lang, kind, limit: 3 }, cache: 'no-store' }).catch(() => null)))
        .then((rs) => setData((d) => ({ ...d, [p.key]: { data: rs.flatMap((r) => r?.data ?? []).sort((a, b) => (b.docDate ?? '').localeCompare(a.docDate ?? '')).slice(0, 3), meta: { page: 1, totalPages: 1, total: rs.reduce((n, r) => n + (r?.meta.total ?? 0), 0) } } })));
    });
  }, [lang, manage.rev]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Header title={t('doc.title')} text={t('doc.sectionText')} />
      {manage.bar}
      <form className="mx-auto mb-8 flex max-w-2xl gap-2" onSubmit={(e) => { e.preventDefault(); router.push(href(`/documents?part=all${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`)); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} placeholder={t('doc.search')} aria-label={t('doc.search')} className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-primary" />
        <button className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">{t('doc.searchBtn')}</button>
      </form>
      <div className="grid gap-5 md:grid-cols-3">
        {PARTS.map((p) => {
          const r = data[p.key];
          return (
            <section key={p.key} className="flex flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-2xl" aria-hidden="true">{p.icon}</span>
                <div><h2 className="text-lg font-extrabold text-secondary">{t(p.title)}</h2>{r && <span className="text-xs text-gray-500">{r.meta.total} {t('doc.items')}</span>}</div>
              </div>
              <p className="mt-3 text-sm leading-7 text-gray-600">{t(p.text)}</p>
              <ul className="mt-3 flex-1 space-y-2 text-sm">
                {!r ? <li className="text-gray-400">…</li> : r.data.length === 0 ? <li className="text-gray-400">{t('doc.empty')}</li> : r.data.map((d) => (
                  <li key={d.id} className="border-t border-line pt-2"><Link href={href(`/documents/view?id=${d.id}`)} className="font-semibold text-secondary hover:text-primary">{d.title}</Link>{d.docDate && <span className="block text-xs text-gray-500">{fmtDate(lang, d.docDate)}</span>}</li>
                ))}
              </ul>
              <Link href={href(`/documents?part=${p.key}`)} className="mt-4 rounded-xl bg-primary py-2 text-center text-sm font-semibold text-white transition hover:brightness-110">{t('doc.viewAll')}</Link>
            </section>
          );
        })}
      </div>
      {manage.dialogs}
    </div>
  );
}

/** one part (or all of them): sub-type chips, year chips, search + date range + issuer, then the results */
function PartPage({ part }: { part: Part | 'all' }) {
  const { lang, t, href } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const def = part === 'all' ? null : PARTS.find((p) => p.key === part)!;
  useCrumbTitle(def ? t(def.title) : null);
  const chips = part === 'all' ? [] : CHIPS[part];
  const sub = chips.find((c) => c.key === sp.get('sub'))?.key ?? '';
  const chosen = chips.find((c) => c.key === sub);
  const kind = chosen ? chosen.kind : def && def.kinds.length === 1 ? def.kinds[0] : '';
  const scope = !kind ? 'official' : undefined; // no single kind: every official kind (for a part, narrowed below)
  const year = /^\d{4}$/.test(sp.get('year') ?? '') ? (sp.get('year') as string) : '';
  const q = sp.get('q') ?? '';
  const issuer = sp.get('issuer') ?? '';
  const from = year ? `${year}-01-01` : dateOk(sp.get('from'));
  const to = year ? `${year}-12-31` : dateOk(sp.get('to'));
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const manage = useDocsManage({ kind: kind || def?.kinds[0], subtype: chosen?.subtype });
  const [text, setText] = useState(q);
  const [res, setRes] = useState<Result | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [issuers, setIssuers] = useState<string[]>([]);
  useEffect(() => { setText(q); }, [q]);
  useEffect(() => {
    const kinds = kind ? [kind] : def ? def.kinds : [''];
    Promise.all(kinds.map((k) => api<number[]>('/public/documents/years', { params: { kind: k || undefined, scope: k ? undefined : 'official' }, cache: 'no-store' }).catch(() => [])))
      .then((ys) => setYears([...new Set(ys.flat())].sort().reverse()));
    api<string[]>('/public/documents/issuers', { params: { lang, kind: kind || undefined, scope: kind ? undefined : 'official' }, cache: 'no-store' }).then(setIssuers).catch(() => setIssuers([]));
  }, [lang, kind, part]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setRes(null);
    // the "all laws" view holds the laws and the guides: ask for both kinds and merge by date
    const kinds = kind ? [kind] : def ? def.kinds : [''];
    const subtype = chosen?.subtype;
    if (kinds.length === 1) {
      api<Result>('/public/documents', { params: { lang, kind: kinds[0] || undefined, scope: kinds[0] ? undefined : scope, subtype, q, issuer, from, to, page, limit: 12 }, cache: 'no-store' }).then(setRes).catch(() => setRes({ data: [], meta: { page: 1, totalPages: 1, total: 0 } }));
    } else {
      Promise.all(kinds.map((k) => api<Result>('/public/documents', { params: { lang, kind: k, q, issuer, from, to, page, limit: 12 }, cache: 'no-store' }).catch(() => null)))
        .then((rs) => {
          const data = rs.flatMap((r) => r?.data ?? []).sort((a, b) => (b.docDate ?? '').localeCompare(a.docDate ?? '') || b.id - a.id).slice(0, 12);
          setRes({ data, meta: { page, totalPages: Math.max(...rs.map((r) => r?.meta.totalPages ?? 1)), total: rs.reduce((n, r) => n + (r?.meta.total ?? 0), 0) } });
        });
    }
  }, [lang, kind, part, sub, q, issuer, from, to, year, page, manage.rev]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (next: { sub?: string; q?: string; issuer?: string; year?: string; from?: string; to?: string; page?: number }) => {
    const p = new URLSearchParams({ part });
    const v = { sub, q, issuer, year, from: sp.get('from') ?? '', to: sp.get('to') ?? '', ...next };
    if (v.sub) p.set('sub', v.sub);
    if (v.q) p.set('q', v.q);
    if (v.issuer) p.set('issuer', v.issuer);
    if (v.year) p.set('year', v.year);
    else { if (v.from) p.set('from', v.from); if (v.to) p.set('to', v.to); }
    if ((next.page ?? 1) > 1) p.set('page', String(next.page));
    router.push(href(`/documents?${p}`));
  };
  const filtered = !!(q || issuer || year || sp.get('from') || sp.get('to'));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Header title={def ? t(def.title) : t('doc.title')} text={def ? t(def.text) : undefined} />
      {manage.bar}
      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap justify-center gap-2" role="tablist">
          <button type="button" role="tab" aria-selected={!sub} className={chip(!sub)} onClick={() => go({ sub: '' })}>{t('faq.all')}</button>
          {chips.map((c) => <button key={c.key} type="button" role="tab" aria-selected={sub === c.key} className={chip(sub === c.key)} onClick={() => go({ sub: c.key })}>{t(c.label)}</button>)}
        </div>
      )}
      {years.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2" aria-label={t('doc.byYear')}>
          <span className="text-xs text-gray-500">{t('doc.byYear')}:</span>
          <button type="button" aria-pressed={!year} className={`${chip(!year)} !px-3 !py-1 !text-xs`} onClick={() => go({ year: '' })}>{t('md.allYears')}</button>
          {years.map((y) => <button key={y} type="button" aria-pressed={year === String(y)} className={`${chip(year === String(y))} !px-3 !py-1 !text-xs`} onClick={() => go({ year: String(y), from: '', to: '' })}>{y}</button>)}
        </div>
      )}
      <form className="mb-6 grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]" onSubmit={(e) => { e.preventDefault(); go({ q: text.trim() }); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={t('doc.search')} aria-label={t('doc.search')} className="min-w-0 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-primary" />
        <label className="flex items-center gap-1.5 text-xs text-gray-500">{t('doc.from')}<input type="date" value={year ? '' : from} max={to || undefined} onChange={(e) => go({ from: e.target.value, year: '' })} className="rounded-xl border border-line bg-white px-2 py-2 text-sm text-ink outline-none focus:border-primary" /></label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">{t('doc.to')}<input type="date" value={year ? '' : to} min={from || undefined} onChange={(e) => go({ to: e.target.value, year: '' })} className="rounded-xl border border-line bg-white px-2 py-2 text-sm text-ink outline-none focus:border-primary" /></label>
        <select value={issuer} onChange={(e) => go({ issuer: e.target.value })} aria-label={t('doc.issuer')} className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary">
          <option value="">{t('doc.allIssuers')}</option>
          {issuers.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110">{t('doc.searchBtn')}</button>
          {filtered && <button type="button" onClick={() => go({ q: '', issuer: '', year: '', from: '', to: '' })} className="rounded-xl border border-line px-3 py-2 text-sm text-gray-600 hover:border-primary">{t('os.clear')}</button>}
        </div>
      </form>
      <DocResults res={res} onPage={(n) => go({ page: n })} actions={manage.actions} />
      {manage.dialogs}
    </div>
  );
}

function Section() {
  const part = useSearchParams().get('part');
  if (part === 'all' || part === 'circular' || part === 'decision' || part === 'law') return <PartPage part={part} />;
  return <Home />;
}

export function DecisionsSection() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Section /></Suspense>;
}
