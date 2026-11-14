'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { useCrumbTitle } from '@/components/site/breadcrumbs';
import { NotFoundContent } from '@/components/site/not-found-content';
import { DynamicForm, PublicForm } from '@/components/site/dynamic-form';

interface Item { slug: string; title: string; description: string | null; isOpen: boolean }

function One({ slug }: { slug: string }) {
  const { lang } = useI18n();
  const [f, setF] = useState<PublicForm | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');
  useCrumbTitle(f ? (lang === 'en' && f.titleEn) || f.titleAr : undefined);
  useEffect(() => { api<PublicForm>(`/public/forms/${encodeURIComponent(slug)}`).then((d) => { setF(d); setState('ok'); }).catch(() => setState('404')); }, [slug]);
  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !f) return <NotFoundContent lang={lang} />;
  const desc = (lang === 'en' && f.descriptionEn) || f.descriptionAr;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-extrabold text-secondary">{(lang === 'en' && f.titleEn) || f.titleAr}</h1>
      {desc && <div className="prose-news" dangerouslySetInnerHTML={{ __html: desc }} />}
      <DynamicForm form={f} />
    </div>
  );
}

function List() {
  const { lang, href } = useI18n();
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => { api<Item[]>('/public/forms', { params: { lang } }).then(setItems).catch(() => setItems([])); }, [lang]);
  if (!items) return <Center><Spinner /></Center>;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-extrabold text-secondary">{lang === 'en' ? 'Forms & requests' : 'النماذج والطلبات'}</h1>
      {items.length === 0 && <p className="text-sm text-gray-500">{lang === 'en' ? 'No forms are available.' : 'لا توجد نماذج متاحة حالياً.'}</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.slug}>
            <Link href={href(`/forms?slug=${encodeURIComponent(i.slug)}`)} className="block h-full rounded-2xl bg-white p-4 shadow-card ring-1 ring-line transition hover:ring-accent">
              <b className="text-secondary">{i.title}</b>
              {!i.isOpen && <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">{lang === 'en' ? 'Closed' : 'مغلق'}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Router() {
  const slug = useSearchParams().get('slug');
  return slug ? <One slug={slug} /> : <List />;
}

export default function Page() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Router /></Suspense>;
}
