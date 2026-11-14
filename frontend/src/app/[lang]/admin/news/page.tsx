'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useI18n } from '@/lib/i18n';
import { isNewsCategoryKey, newsCategoryLabel } from '@/lib/news-categories';
import { NewsTable } from '@/components/admin/news-table';
import { RequirePerm } from '@/components/admin/guard';

/** Regular news. With ?category=<key> (chamber, board, ...) only the news of that fixed main category is listed, and adding is locked to it. */
function News() {
  const { t, lang } = useI18n();
  const raw = useSearchParams().get('category');
  const category = isNewsCategoryKey(raw) ? raw : undefined;
  return (
    <RequirePerm any={['news.read']}>
      <h1 className="mb-4 text-2xl font-bold">{category ? newsCategoryLabel(category, lang) : t('adm.news')}</h1>
      <NewsTable key={category ?? 'all'} section="regular" category={category} />
    </RequirePerm>
  );
}

export default function AdminNews() {
  return <Suspense fallback={null}><News /></Suspense>;
}
