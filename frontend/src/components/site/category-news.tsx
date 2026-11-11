'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { NewsMainCategoryKey, newsCategoryLabel } from '@/lib/news-categories';
import { Card, NewsCard } from '@/components/site/cards';

/**
 * Latest news of one fixed media-center category, shown on the page that owns it (board, committees, training, incubator, events ...).
 * Renders nothing while loading or when the category has no news; "all news" opens the media center filtered by the same category.
 */
export function CategoryNews({ category, limit = 3, className = '' }: { category: NewsMainCategoryKey; limit?: number; className?: string }) {
  const { lang, t, href } = useI18n();
  const label = newsCategoryLabel(category, lang);
  const [items, setItems] = useState<Card[]>([]);
  useEffect(() => {
    api<{ data: Card[] }>('/public/news', { params: { lang, category: label, limit }, cache: 'no-store' }).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [lang, label, limit]);
  if (!items.length) return null;
  return (
    <section className={`mx-auto max-w-6xl px-4 pb-10 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="border-s-4 border-accent ps-3 text-xl font-extrabold text-secondary">{label}</h2>
        <Link href={href(`/media?category=${encodeURIComponent(label)}`)} className="text-sm font-bold text-primary hover:underline">{t('cn.all')}</Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((n) => <NewsCard key={n.id} n={n} />)}</div>
    </section>
  );
}
