'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { Card, NewsCard } from '@/components/site/cards';
import { Pager } from '@/components/site/pager';
import { Heading, useExpoInfo } from '@/components/site/expo-shared';

/** EXPO news = the news that carry the topic set in Settings → expo (news_topic). */
export default function ExpoNews() {
  const { lang, t } = useI18n();
  const { newsTopic } = useExpoInfo();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ data: Card[]; meta: { totalPages: number } } | null>(null);
  useEffect(() => {
    if (!newsTopic) return setData({ data: [], meta: { totalPages: 1 } });
    setData(null);
    api<{ data: Card[]; meta: { totalPages: number } }>('/public/news', { params: { lang, topics: newsTopic, page, limit: 9 } }).then(setData).catch(() => setData({ data: [], meta: { totalPages: 1 } }));
  }, [lang, newsTopic, page]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Heading>{t('ex.news')}</Heading>
      {!data ? <Center><Spinner /></Center> : data.data.length === 0 ? <Center>{t('ex.noNews')}</Center> : (
        <>
          <div className="grid gap-4 md:grid-cols-3">{data.data.map((n) => <NewsCard key={n.id} n={n} />)}</div>
          <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
