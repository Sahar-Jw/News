'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useSite } from '@/components/site/site-context';

/** Generated from live content: main categories and subcategories are independent lists. */
export default function SitemapPage() {
  const { t, href } = useI18n();
  const { categories } = useSite();
  const fixed: [string, string][] = [['/', t('site.home')], ['/news', t('site.allNews')], ['/privacy', t('site.privacy')], ['/terms', t('site.terms')]];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">{t('site.sitemap')}</h1>
      <ul className="space-y-2">
        {fixed.map(([p, l]) => <li key={p}><Link className="text-primary hover:underline" href={href(p)}>{l}</Link></li>)}
      </ul>
      {categories.main.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-xl font-bold">{t('site.categories')}</h2>
          <ul className="space-y-2">
            {categories.main.map((c) => <li key={c}><Link className="text-primary hover:underline" href={href(`/news?category=${encodeURIComponent(c)}`)}>{c}</Link></li>)}
          </ul>
        </>
      )}
      {categories.sub.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-xl font-bold">{t('site.subcategories')}</h2>
          <ul className="space-y-2">
            {categories.sub.map((c) => <li key={c}><Link className="text-primary hover:underline" href={href(`/news?subcategory=${encodeURIComponent(c)}`)}>{c}</Link></li>)}
          </ul>
        </>
      )}
    </div>
  );
}
