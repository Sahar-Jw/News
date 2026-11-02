'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { NotFoundContent } from '@/components/site/not-found-content';

interface PageData { id: number; slug: string; title: string; body: string }

/** Static page (about the chamber, ...): /pages/view?slug=about. The body is HTML sanitised by the API. */
function View() {
  const { lang, t } = useI18n();
  const slug = useSearchParams().get('slug');
  const [p, setP] = useState<PageData | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');

  useEffect(() => {
    if (!slug) { setState('404'); return; }
    setState('load');
    api<PageData>(`/public/pages/${encodeURIComponent(slug)}`, { params: { lang }, cache: 'no-store' }).then((d) => { setP(d); setState('ok'); }).catch(() => setState('404'));
  }, [slug, lang]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !p) return <NotFoundContent lang={lang} />;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <article className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line md:p-10">
        <h1 className="text-2xl font-extrabold leading-snug text-secondary md:text-3xl">{p.title}</h1>
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" />
        </div>
        {p.body ? <div className="prose-news mt-6" dangerouslySetInnerHTML={{ __html: p.body }} /> : <p className="mt-6 text-gray-500">{t('site.pageEmpty')}</p>}
      </article>
    </div>
  );
}

export default function PageViewPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><View /></Suspense>;
}
