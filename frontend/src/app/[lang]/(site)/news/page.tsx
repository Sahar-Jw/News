'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Spinner } from '@/components/ui/ui';
import { Card, NewsCard } from '@/components/site/cards';
import { Pager } from '@/components/site/pager';

function List() {
  const { lang, t, href } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const category = sp.get('category') ?? '';
  const subcategory = sp.get('subcategory') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const [data, setData] = useState<{ data: Card[]; meta: { totalPages: number; total: number } } | null>(null);

  useEffect(() => {
    setData(null);
    api('/public/news', { params: { lang, category, subcategory, page, limit: 12 } }).then(setData).catch(() => setData({ data: [], meta: { totalPages: 1, total: 0 } }));
  }, [lang, category, subcategory, page]);

  const go = (p: number) => router.push(href(`/news?${new URLSearchParams({ ...(category && { category }), ...(subcategory && { subcategory }), page: String(p) })}`));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">{[category, subcategory].filter(Boolean).join(' / ') || t('site.allNews')}</h1>
      {!data ? <Center><Spinner /></Center> : data.data.length === 0 ? <Center>{t('site.noNews')}</Center> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{data.data.map((n) => <NewsCard key={n.id} n={n} />)}</div>
          <Pager page={page} totalPages={data.meta.totalPages} onPage={go} />
        </>
      )}
    </div>
  );
}

export default function NewsListPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><List /></Suspense>;
}
