'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { NotFoundContent } from '@/components/site/not-found-content';
import { PublicService } from '@/components/site/services-shared';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6"><h2 className="mb-2 text-lg font-extrabold text-secondary">{title}</h2>{children}</section>;
}

/** One service: /services/view?id=5 */
function View() {
  const { lang, t, href } = useI18n();
  const id = useSearchParams().get('id');
  const [d, setD] = useState<PublicService | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');

  useEffect(() => {
    if (!id) { setState('404'); return; }
    setState('load');
    api<PublicService>(`/public/services/${encodeURIComponent(id)}`, { params: { lang }, cache: 'no-store' }).then((r) => { setD(r); setState('ok'); }).catch(() => setState('404'));
  }, [id, lang]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !d) return <NotFoundContent lang={lang} />;

  const facts: [string, string][] = ([
    [t('svc.department'), d.department], [t('svc.duration'), d.duration], [t('svc.fee'), d.fee], [t('svc.location'), d.location], [t('svc.audience'), d.audience],
  ] as [string, string][]).filter(([, v]) => v);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href={href('/one-stop')} className="mb-4 inline-block text-sm text-primary hover:underline">{t('svc.back')}</Link>
      <article className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line">
        {d.imageUrl && <img src={fileUrl(d.imageUrl)} alt="" className="h-56 w-full object-cover" />}
        <div className="p-6 md:p-10">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{t(`svc.kind.${d.kind}`)}</span>
          <h1 className="mt-4 text-2xl font-extrabold leading-snug text-secondary md:text-3xl">{d.name}</h1>
          {d.description && <p className="mt-3 whitespace-pre-line leading-8 text-gray-700">{d.description}</p>}
          {facts.length > 0 && (
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {facts.map(([k, v]) => <div key={k} className="rounded-xl bg-gray-50 px-4 py-3"><dt className="text-xs font-semibold text-gray-500">{k}</dt><dd className="mt-0.5 text-sm font-bold text-secondary">{v}</dd></div>)}
            </dl>
          )}
          {d.documents.length > 0 && <Block title={t('svc.documents')}><ul className="list-disc space-y-1 ps-5 text-sm leading-7 text-gray-700">{d.documents.map((x, i) => <li key={i}>{x}</li>)}</ul></Block>}
          {d.steps.length > 0 && <Block title={t('svc.steps')}><ol className="list-decimal space-y-1 ps-5 text-sm leading-7 text-gray-700">{d.steps.map((x, i) => <li key={i}>{x}</li>)}</ol></Block>}
          {d.formUrl && <a href={d.formUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">{t('svc.form')}</a>}
        </div>
      </article>
    </div>
  );
}

export default function ServiceViewPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><View /></Suspense>;
}
