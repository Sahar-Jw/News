'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';

interface Doc { id: number; kind: string; docNumber: string; docDate: string | null; issuer: string; title: string; summary: string; fileUrl: string | null }
interface Result { data: Doc[]; meta: { page: number; totalPages: number; total: number } }
const KINDS = ['circular', 'decision', 'law', 'guide', 'library'] as const;
const dateOk = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

/** Public list of official documents (wireframe W06): tabs by kind, search + issuer + date range, table on wide screens (cards on phones), 12 per page. Each row opens the PDF page or downloads the file. */
function List() {
  const { lang, t, href } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const kind = KINDS.includes(sp.get('kind') as any) ? (sp.get('kind') as string) : '';
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const q = sp.get('q') ?? '';
  const issuer = sp.get('issuer') ?? '';
  const from = dateOk(sp.get('from'));
  const to = dateOk(sp.get('to'));
  const [text, setText] = useState(q);
  const [res, setRes] = useState<Result | null>(null);
  const [issuers, setIssuers] = useState<string[]>([]);

  useEffect(() => { setText(q); }, [q]);
  useEffect(() => {
    api<string[]>('/public/documents/issuers', { params: { lang, kind }, cache: 'no-store' }).then(setIssuers).catch(() => setIssuers([]));
  }, [lang, kind]);
  useEffect(() => {
    setRes(null);
    api<Result>('/public/documents', { params: { lang, kind, q, issuer, from, to, page, limit: 12 }, cache: 'no-store' }).then(setRes).catch(() => setRes({ data: [], meta: { page: 1, totalPages: 1, total: 0 } }));
  }, [lang, kind, q, issuer, from, to, page]);

  const go = (next: { kind?: string; q?: string; issuer?: string; from?: string; to?: string; page?: number }) => {
    const p = new URLSearchParams();
    const v = { kind, q, issuer, from, to, ...next };
    if (v.kind) p.set('kind', v.kind);
    if (v.q) p.set('q', v.q);
    if (v.issuer) p.set('issuer', v.issuer);
    if (v.from) p.set('from', v.from);
    if (v.to) p.set('to', v.to);
    if ((next.page ?? 1) > 1) p.set('page', String(next.page));
    router.push(href(`/documents${p.toString() ? `?${p}` : ''}`));
  };
  const filtered = !!(q || issuer || from || to);

  const actions = (d: Doc) => (
    <div className="flex flex-wrap gap-2 text-sm">
      <Link href={href(`/documents/view?id=${d.id}`)} className="rounded-lg bg-primary px-3 py-1 font-semibold text-white transition hover:brightness-110">{t('doc.open')}</Link>
      {d.fileUrl && <a href={fileUrl(d.fileUrl)} download className="rounded-lg border border-line px-3 py-1 font-semibold text-gray-700 transition hover:border-primary hover:text-primary">{t('doc.download')}</a>}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-secondary">{t('doc.title')}</h1>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" />
        </div>
      </header>
      <div className="mb-5 flex flex-wrap justify-center gap-2" role="tablist">
        {['', ...KINDS].map((k) => (
          <button key={k || 'all'} type="button" role="tab" aria-selected={kind === k} onClick={() => go({ kind: k, issuer: '' })}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${kind === k ? 'border-primary bg-primary text-white' : 'bg-white text-gray-700 hover:border-primary'}`}>
            {k ? t(`doc.kind.${k}`) : t('faq.all')}
          </button>
        ))}
      </div>
      <form className="mb-6 grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]" onSubmit={(e) => { e.preventDefault(); go({ q: text.trim() }); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={t('doc.search')} aria-label={t('doc.search')} className="min-w-0 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-primary" />
        <label className="flex items-center gap-1.5 text-xs text-gray-500">{t('doc.from')}<input type="date" value={from} max={to || undefined} onChange={(e) => go({ from: e.target.value })} className="rounded-xl border border-line bg-white px-2 py-2 text-sm text-ink outline-none focus:border-primary" /></label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500">{t('doc.to')}<input type="date" value={to} min={from || undefined} onChange={(e) => go({ to: e.target.value })} className="rounded-xl border border-line bg-white px-2 py-2 text-sm text-ink outline-none focus:border-primary" /></label>
        <select value={issuer} onChange={(e) => go({ issuer: e.target.value })} aria-label={t('doc.issuer')} className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-primary">
          <option value="">{t('doc.allIssuers')}</option>
          {issuers.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110">{t('doc.searchBtn')}</button>
          {filtered && <button type="button" onClick={() => go({ q: '', issuer: '', from: '', to: '' })} className="rounded-xl border border-line px-3 py-2 text-sm text-gray-600 hover:border-primary">{t('os.clear')}</button>}
        </div>
      </form>
      {!res ? <Center><Spinner /></Center> : res.data.length === 0 ? <Center>{t('doc.empty')}</Center> : (
        <>
          {/* wide screens: table (number, title, date, issuer, actions) */}
          <div className="hidden overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line md:block">
            <table className="w-full text-start text-sm">
              <thead className="bg-secondary text-white">
                <tr>
                  <th className="px-4 py-2.5 text-start font-semibold">{t('doc.number')}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{t('doc.colTitle')}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{t('doc.date')}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">{t('doc.issuer')}</th>
                  <th className="px-4 py-2.5 text-start font-semibold">PDF</th>
                </tr>
              </thead>
              <tbody>
                {res.data.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 whitespace-nowrap">{d.docNumber ? <bdi dir="ltr">{d.docNumber}</bdi> : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="mb-1 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{t(`doc.kind.${d.kind}`)}</span>
                      <Link href={href(`/documents/view?id=${d.id}`)} className="block font-bold text-secondary hover:text-primary">{d.title}</Link>
                      {d.summary && <span className="mt-1 line-clamp-2 block text-xs leading-6 text-gray-600">{d.summary}</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{d.docDate ? fmtDate(lang, d.docDate) : '—'}</td>
                    <td className="px-4 py-3">{d.issuer || '—'}</td>
                    <td className="px-4 py-3">{actions(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* phones: cards */}
          <ul className="space-y-3 md:hidden">
            {res.data.map((d) => (
              <li key={d.id} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">{t(`doc.kind.${d.kind}`)}</span>
                  {d.docNumber && <span>{t('doc.number')}: <bdi dir="ltr">{d.docNumber}</bdi></span>}
                  {d.docDate && <span>{fmtDate(lang, d.docDate)}</span>}
                  {d.issuer && <span>{d.issuer}</span>}
                </div>
                <h2 className="mt-2 text-lg font-bold text-secondary"><Link href={href(`/documents/view?id=${d.id}`)} className="hover:text-primary">{d.title}</Link></h2>
                {d.summary && <p className="mt-1 line-clamp-3 text-sm leading-7 text-gray-600">{d.summary}</p>}
                <div className="mt-3">{actions(d)}</div>
              </li>
            ))}
          </ul>
          {res.meta.totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-3 text-sm" aria-label="pagination">
              <button type="button" disabled={res.meta.page <= 1} onClick={() => go({ page: res.meta.page - 1 })} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">{t('doc.prev')}</button>
              <span>{res.meta.page} / {res.meta.totalPages}</span>
              <button type="button" disabled={res.meta.page >= res.meta.totalPages} onClick={() => go({ page: res.meta.page + 1 })} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">{t('doc.next')}</button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><List /></Suspense>;
}
