'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { useSite } from '@/components/site/site-context';
import { SECTION_ORDER_KEYS } from '@/components/site/sections-meta';

const ICONS: Record<string, React.ReactNode> = {
  pages: <><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" /></>,
  sections: <><rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" /></>,
  categories: <><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" /><line x1="7" x2="7.01" y1="7" y2="7" /></>,
  subcategories: <><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></>,
};

function Group({ icon, title, count, children }: { icon: string; title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[icon]}</svg>
        </span>
        <h2 className="flex-1 text-base font-bold">{title}</h2>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">{count}</span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

const chip = 'rounded-full border bg-gray-50 px-3 py-1.5 text-sm text-gray-700 transition hover:border-primary hover:bg-primary hover:text-white';

/** Generated from live content: pages, home sections, and the (independent) category / subcategory lists. */
export default function SitemapPage() {
  const { t, href } = useI18n();
  const { categories, settings, loc } = useSite();
  const pages: [string, string][] = [['/', t('site.home')], ['/news', t('site.allNews')], ['/privacy', t('site.privacy')], ['/terms', t('site.terms')]];
  const sh = settings.sections_home ?? {};
  const sections = SECTION_ORDER_KEYS.filter((k) => k !== 'hero' && sh[`${k}_visible`] !== false).sort((a, b) => (sh[`${a}_order`] ?? 99) - (sh[`${b}_order`] ?? 99));
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold">{t('site.sitemap')}</h1>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" />
        </div>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <Group icon="pages" title={t('site.home')} count={pages.length}>
          {pages.map(([p, l]) => <Link key={p} href={href(p)} className={chip}>{l}</Link>)}
        </Group>
        <Group icon="sections" title={t('site.sections')} count={sections.length}>
          {sections.map((k) => <Link key={k} href={`${href('/')}#sec-${k}`} className={chip}>{loc('sections_home', `${k}_title`) || t(`sec.${k}`)}</Link>)}
        </Group>
        {categories.main.length > 0 && (
          <Group icon="categories" title={t('site.categories')} count={categories.main.length}>
            {categories.main.map((c) => <Link key={c} href={href(`/news?category=${encodeURIComponent(c)}`)} className={chip}>{c}</Link>)}
          </Group>
        )}
        {categories.sub.length > 0 && (
          <Group icon="subcategories" title={t('site.subcategories')} count={categories.sub.length}>
            {categories.sub.map((c) => <Link key={c} href={href(`/news?subcategory=${encodeURIComponent(c)}`)} className={chip}>{c}</Link>)}
          </Group>
        )}
      </div>
    </div>
  );
}
