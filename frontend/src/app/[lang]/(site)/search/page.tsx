'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { Card, NewsCard } from '@/components/site/cards';
import { Pager } from '@/components/site/pager';

function Results() {
  const { lang, t, href } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const q = (sp.get('q') ?? '').trim();
  const category = sp.get('category') ?? '';
  const page = Number(sp.get('page') ?? 1);
  const [data, setData] = useState<{ data: Card[]; meta: { totalPages: number; total: number } } | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (q.length < 2) { setErr(t('site.searchMin')); setData(null); return; }
    setErr(''); setData(null);
    api('/public/search', { params: { q, lang, category, page, limit: 12 } }).then(setData).catch((e) => setErr(e.message));
  }, [q, lang, category, page, t]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-bold">{t('site.results')}</h1>
      {q && <p className="mb-6 text-gray-500">“{q}”{data ? ` — ${data.meta.total}` : ''}</p>}
      {err ? <Center>{err}</Center> : !data ? <Center><Spinner /></Center> : data.data.length === 0 ? <Center>{t('site.noNews')}</Center> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{data.data.map((n) => <NewsCard key={n.id} n={n} />)}</div>
          <Pager page={page} totalPages={data.meta.totalPages} onPage={(p) => router.push(href(`/search?q=${encodeURIComponent(q)}&page=${p}`))} />
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Results /></Suspense>;
}
