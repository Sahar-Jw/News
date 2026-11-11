'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { NewsMainCategoryKey, addNewsHref, newsCategoryLabel } from '@/lib/news-categories';
import { Card, NewsCard } from '@/components/site/cards';

/**
 * Latest news of one fixed media-center category, shown on the page that owns it (board, committees, training, incubator, events ...).
 * Visitors see nothing while it is loading or when the category has no news; "all news" opens the media center filtered by the same category.
 * People who may add news also get an "add news" button: its form is pinned to this page's category (it cannot be changed there).
 */
export function CategoryNews({ category, limit = 3, className = '' }: { category: NewsMainCategoryKey; limit?: number; className?: string }) {
  const { lang, t, href } = useI18n();
  const { can } = useAuth();
  const from = (usePathname() ?? '').replace(/^\/(ar|en)(?=\/|$)/, '') || '/';
  const label = newsCategoryLabel(category, lang);
  const [items, setItems] = useState<Card[]>([]);
  useEffect(() => {
    api<{ data: Card[] }>('/public/news', { params: { lang, category: label, limit }, cache: 'no-store' }).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [lang, label, limit]);
  const mayAdd = can('news.create');
  if (!items.length && !mayAdd) return null;
  return (
    <section className={`mx-auto max-w-6xl px-4 pb-10 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="border-s-4 border-accent ps-3 text-xl font-extrabold text-secondary">{label}</h2>
        <div className="flex items-center gap-3">
          {mayAdd && <Link href={href(addNewsHref(category, from))} className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white hover:brightness-110">＋ {t('md.addNews')}</Link>}
          {items.length > 0 && <Link href={href(`/media?category=${encodeURIComponent(label)}`)} className="text-sm font-bold text-primary hover:underline">{t('cn.all')}</Link>}
        </div>
      </div>
      {items.length > 0 ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((n) => <NewsCard key={n.id} n={n} />)}</div> : <p className="text-sm text-gray-500">{t('site.noNews')}</p>}
    </section>
  );
}
