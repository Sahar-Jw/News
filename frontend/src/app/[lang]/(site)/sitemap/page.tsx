'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useSite } from '@/components/site/site-context';

/** Generated from live content: categories come from published news. */
export default function SitemapPage() {
  const { t, href } = useI18n();
  const { categories } = useSite();
  const fixed: [string, string][] = [['/', t('site.home')], ['/news', t('site.allNews')], ['/privacy', t('site.privacy')], ['/terms', t('site.terms')]];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">{t('site.sitemap')}</h1>
      <ul className="space-y-2">
        {fixed.map(([p, l]) => <li key={p}><Link className="text-primary hover:underline" href={href(p)}>{l}</Link></li>)}
        {categories.map((c) => (
          <li key={c.name}>
            <Link className="text-primary hover:underline" href={href(`/news?category=${encodeURIComponent(c.name)}`)}>{c.name}</Link>
            {c.subcategories.length > 0 && (
              <ul className="ms-6 mt-1 list-disc space-y-1 ps-4">
                {c.subcategories.map((s) => <li key={s}><Link className="hover:underline" href={href(`/news?category=${encodeURIComponent(c.name)}&subcategory=${encodeURIComponent(s)}`)}>{s}</Link></li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
