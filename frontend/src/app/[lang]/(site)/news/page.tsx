'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Spinner } from '@/components/ui/ui';
import { Card, NewsCard } from '@/components/site/cards';
import { Pager } from '@/components/site/pager';
import { NewsFilters, NewsFilterValues } from '@/components/site/news-filters';

function List() {
  const { lang, t, href } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const category = sp.get('category') ?? '';
  const subcategory = sp.get('subcategory') ?? '';
  const topics = sp.get('topics') ?? '';
  const q = sp.get('q') ?? '';
  const dateFrom = sp.get('dateFrom') ?? '';
  const dateTo = sp.get('dateTo') ?? '';
  const sort = sp.get('sort') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const [data, setData] = useState<{ data: Card[]; meta: { totalPages: number; total: number } } | null>(null);

  useEffect(() => {
    setData(null);
    api('/public/news', { params: { lang, category, subcategory, topics, q, dateFrom, dateTo, sort, page, limit: 12 } }).then(setData).catch(() => setData({ data: [], meta: { totalPages: 1, total: 0 } }));
  }, [lang, category, subcategory, topics, q, dateFrom, dateTo, sort, page]);

  const push = (v: Partial<NewsFilterValues> & { topics?: string }, p: number) => {
    const next: Record<string, string> = { category, subcategory, topics, q, dateFrom, dateTo, sort, ...v };
    const params = new URLSearchParams();
    Object.entries(next).forEach(([k, val]) => { if (val) params.set(k, val); });
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    router.push(href(`/news${qs ? `?${qs}` : ''}`));
  };
  const go = (p: number) => push({}, p);
  const apply = (v: NewsFilterValues) => push({ ...v, topics: '' }, 1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{topics ? `${t('site.relatedTo')} ${topics.split(',').join(' • ')}` : [category, subcategory].filter(Boolean).join(' / ') || t('site.allNews')}</h1>
      <NewsFilters value={{ q, category, subcategory, dateFrom, dateTo, sort }} onApply={apply} />
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
