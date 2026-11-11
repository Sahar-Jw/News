'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { PdfViewer } from '@/components/site/pdf-viewer';
import { NotFoundContent } from '@/components/site/not-found-content';

interface Doc { id: number; kind: string; subtype?: string | null; docNumber: string; docDate: string | null; issuer: string; title: string; summary: string; fileUrl: string | null; file: string }

/** One document: details and the PDF drawn in the page: /documents/view?id=5 */
function View() {
  const { lang, t, href } = useI18n();
  const id = useSearchParams().get('id');
  const [d, setD] = useState<Doc | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');

  useEffect(() => {
    if (!id) { setState('404'); return; }
    setState('load');
    api<Doc>(`/public/documents/${encodeURIComponent(id)}`, { params: { lang }, cache: 'no-store' }).then((r) => { setD(r); setState('ok'); }).catch(() => setState('404'));
  }, [id, lang]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !d) return <NotFoundContent lang={lang} />;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <article className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line md:p-10">
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <Link href={href(['circular', 'decision', 'law', 'guide'].includes(d.kind) ? `/documents?part=${d.kind === 'guide' ? 'law&sub=guide' : d.kind}${d.subtype && d.kind !== 'guide' ? `&sub=${d.subtype}` : ''}` : `/library?kind=${d.kind}`)} className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary transition hover:bg-primary hover:text-white">{t(`doc.kind.${d.kind}`)}</Link>
          {d.subtype && <span className="rounded-full bg-accent/20 px-3 py-1 font-semibold text-secondary">{t(`doc.sub.${d.subtype}`)}</span>}
          {d.docNumber && <span>{t('doc.number')}: <bdi dir="ltr">{d.docNumber}</bdi></span>}
          {d.docDate && <span>{fmtDate(lang, d.docDate)}</span>}
          {d.issuer && <span>{t('doc.issuer')}: {d.issuer}</span>}
        </div>
        <h1 className="mt-4 text-2xl font-extrabold leading-snug text-secondary md:text-3xl">{d.title}</h1>
        {d.summary && <p className="mt-3 leading-8 text-gray-700">{d.summary}</p>}
        {d.fileUrl && <a href={fileUrl(d.fileUrl)} download className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">{t('doc.download')}</a>}
        {d.fileUrl && <div className="mt-6"><PdfViewer src={d.fileUrl} title={d.title} /></div>}
      </article>
    </div>
  );
}

export default function DocumentViewPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><View /></Suspense>;
}
