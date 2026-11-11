'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { Card, NewsCard } from '@/components/site/cards';
import { Pager } from '@/components/site/pager';
import { NewsFilters, NewsFilterValues } from '@/components/site/news-filters';
import { newsCategoryKeyOf, newsCategoryLabel } from '@/lib/news-categories';

/**
 * The full news list (search, category / date / sort filters, topic links, pages) shown on the Media Center "News" tab.
 * Everything is kept in the URL (/media?category=...&q=...&page=2), so old /news links keep working through the redirect.
 */
export function AllNews() {
  const { lang, t, href } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  // a fixed category in the link may be in the other language (the language was switched): show it in the page language
  const rawCategory = sp.get('category') ?? '';
  const catKey = newsCategoryKeyOf(rawCategory);
  const category = catKey ? newsCategoryLabel(catKey, lang) : rawCategory;
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
    router.push(href(`/media${qs ? `?${qs}` : ''}`));
  };
  const go = (p: number) => push({}, p);
  const apply = (v: NewsFilterValues) => push({ ...v, topics: '' }, 1);
  const heading = topics ? `${t('site.relatedTo')} ${topics.split(',').join(' • ')}` : [category, subcategory].filter(Boolean).join(' / ');

  return (
    <>
      {heading && <h2 className="mb-4 text-lg font-bold text-secondary">{heading}</h2>}
      <NewsFilters value={{ q, category, subcategory, dateFrom, dateTo, sort }} onApply={apply} />
      {!data ? <Center><Spinner /></Center> : data.data.length === 0 ? <Center>{t('site.noNews')}</Center> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{data.data.map((n) => <NewsCard key={n.id} n={n} />)}</div>
          <Pager page={page} totalPages={data.meta.totalPages} onPage={go} />
        </>
      )}
    </>
  );
}
