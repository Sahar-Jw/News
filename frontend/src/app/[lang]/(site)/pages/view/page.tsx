'use client';
import { useCrumbTitle } from '@/components/site/breadcrumbs';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { hubUrl } from '@/lib/hubs-meta';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { NotFoundContent } from '@/components/site/not-found-content';

interface PageData { id: number; slug: string; title: string; body: string }

/** The static pages the admin can edit (tabs of the "Static pages" hub in Settings). */
const EDITABLE = ['about', 'privacy', 'terms'];

/** Bar at the top of the page, only for people who may manage static pages: one button that opens this page in the admin editor. */
function PageControls({ slug }: { slug: string }) {
  const { lang, href } = useI18n();
  const { can } = useAuth();
  if (!EDITABLE.includes(slug) || !can('pages.read', 'pages.update')) return null;
  const ar = lang === 'ar';
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-primary/25">
      <span className="flex items-center gap-2 text-sm font-bold text-secondary">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10" aria-hidden="true">⚙</span>
        {ar ? 'أدوات إدارة الصفحة' : 'Page controls'}
      </span>
      <Link href={href(hubUrl('pages', slug))} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110">
        {can('pages.update') ? `✎ ${ar ? 'تعديل الصفحة' : 'Edit page'}` : `⚙ ${ar ? 'إدارة الصفحة' : 'Manage page'}`}
      </Link>
    </div>
  );
}

/** Static page (about the chamber, ...): /pages/view?slug=about. The body is HTML sanitised by the API. */
function View() {
  const { lang, t } = useI18n();
  const slug = useSearchParams().get('slug');
  const [p, setP] = useState<PageData | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');
  useCrumbTitle(p?.title);

  useEffect(() => {
    if (!slug) { setState('404'); return; }
    setState('load');
    api<PageData>(`/public/pages/${encodeURIComponent(slug)}`, { params: { lang }, cache: 'no-store' }).then((d) => { setP(d); setState('ok'); }).catch(() => setState('404'));
  }, [slug, lang]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !p) return <NotFoundContent lang={lang} />;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <PageControls slug={p.slug} />
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
