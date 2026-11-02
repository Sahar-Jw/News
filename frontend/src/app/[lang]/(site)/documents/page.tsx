'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';

interface Doc { id: number; kind: string; docNumber: string; docDate: string | null; title: string; summary: string; fileUrl: string | null }
interface Result { data: Doc[]; meta: { page: number; totalPages: number; total: number } }
const KINDS = ['decision', 'circular', 'library'] as const;

/** Public list of official documents: tabs by kind, search, 12 per page. Each card opens the PDF page or downloads the file. */
function List() {
  const { lang, t, href } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const kind = KINDS.includes(sp.get('kind') as any) ? (sp.get('kind') as string) : '';
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const q = sp.get('q') ?? '';
  const [text, setText] = useState(q);
  const [res, setRes] = useState<Result | null>(null);

  useEffect(() => { setText(q); }, [q]);
  useEffect(() => {
    setRes(null);
    api<Result>('/public/documents', { params: { lang, kind, q, page, limit: 12 }, cache: 'no-store' }).then(setRes).catch(() => setRes({ data: [], meta: { page: 1, totalPages: 1, total: 0 } }));
  }, [lang, kind, q, page]);

  const go = (next: { kind?: string; q?: string; page?: number }) => {
    const p = new URLSearchParams();
    const k = next.kind ?? kind; const qq = next.q ?? q; const pg = next.page ?? 1;
    if (k) p.set('kind', k);
    if (qq) p.set('q', qq);
    if (pg > 1) p.set('page', String(pg));
    router.push(href(`/documents${p.toString() ? `?${p}` : ''}`));
  };

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
          <button key={k || 'all'} type="button" role="tab" aria-selected={kind === k} onClick={() => go({ kind: k })}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${kind === k ? 'border-primary bg-primary text-white' : 'bg-white text-gray-700 hover:border-primary'}`}>
            {k ? t(`doc.kind.${k}`) : t('faq.all')}
          </button>
        ))}
      </div>
      <form className="mx-auto mb-6 flex max-w-xl gap-2" onSubmit={(e) => { e.preventDefault(); go({ q: text.trim() }); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={t('doc.search')} aria-label={t('doc.search')} className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-primary" />
        <button className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:brightness-110">{t('doc.searchBtn')}</button>
      </form>
      {!res ? <Center><Spinner /></Center> : res.data.length === 0 ? <Center>{t('doc.empty')}</Center> : (
        <>
          <ul className="space-y-3">
            {res.data.map((d) => (
              <li key={d.id} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">{t(`doc.kind.${d.kind}`)}</span>
                  {d.docNumber && <span>{t('doc.number')}: <bdi dir="ltr">{d.docNumber}</bdi></span>}
                  {d.docDate && <span>{fmtDate(lang, d.docDate)}</span>}
                </div>
                <h2 className="mt-2 text-lg font-bold text-secondary"><Link href={href(`/documents/view?id=${d.id}`)} className="hover:text-primary">{d.title}</Link></h2>
                {d.summary && <p className="mt-1 line-clamp-3 text-sm leading-7 text-gray-600">{d.summary}</p>}
                <div className="mt-3 flex gap-2 text-sm">
                  <Link href={href(`/documents/view?id=${d.id}`)} className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-white transition hover:brightness-110">{t('doc.open')}</Link>
                  {d.fileUrl && <a href={fileUrl(d.fileUrl)} download className="rounded-lg border border-line px-3 py-1.5 font-semibold text-gray-700 transition hover:border-primary hover:text-primary">{t('doc.download')}</a>}
                </div>
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
