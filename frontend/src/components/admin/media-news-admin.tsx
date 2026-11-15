'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { hubUrl } from '@/lib/hubs-meta';
import { NEWS_MAIN_CATEGORIES, isNewsCategoryKey, newsCategoryLabel } from '@/lib/news-categories';
import { Field, inputCls } from '@/components/ui/ui';
import { NewsTable } from './news-table';

const OTHER = 'o:'; // a category that is not one of the fixed ones: "o:<label>"

/**
 * Media center settings -> News: the same table as the Content > News screen (search, status / language / visibility / date filters,
 * add, edit, delete, bulk delete, export), narrowed by the main category and subcategory chosen here. The choice lives in the address
 * (?page=media&tab=news&cat=board&sub=...), and editing a row comes back to this same view.
 * Every button follows the user's own news permissions, and the API only returns / changes what those permissions allow.
 */
export function MediaNewsAdmin() {
  const { t, lang, href } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const cat = sp.get('cat') ?? '';
  const sub = sp.get('sub') ?? '';
  const [others, setOthers] = useState<string[]>([]);
  const [subs, setSubs] = useState<string[]>([]);

  // the categories really used by news (besides the fixed ones) and the subcategories in use
  useEffect(() => {
    api<{ main: string[]; sub: string[] }>('/admin/news/categories', { cache: 'no-store' })
      .then((r) => {
        const fixed = NEWS_MAIN_CATEGORIES.flatMap((c) => [c.ar.toLowerCase(), c.en.toLowerCase()]);
        setOthers([...new Set((r.main ?? []).filter((v) => v && !fixed.includes(String(v).toLowerCase())))]);
        setSubs([...new Set((r.sub ?? []).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => { setOthers([]); setSubs([]); });
  }, []);

  const urlFor = (c: string, s: string) => `${hubUrl('media', 'news')}${c ? `&cat=${encodeURIComponent(c)}` : ''}${s ? `&sub=${encodeURIComponent(s)}` : ''}`;
  const go = (c: string, s: string) => router.replace(href(urlFor(c, s)));

  const fixedKey = isNewsCategoryKey(cat) ? cat : undefined;
  const otherLabel = cat.startsWith(OTHER) ? cat.slice(OTHER.length) : undefined;

  return (
    <>
      <div className="mb-4 grid gap-3 rounded-xl border border-line bg-gray-50 p-3 sm:grid-cols-2">
        <Field label={t('site.category')}>
          <select className={`${inputCls} !py-1.5`} value={fixedKey || (otherLabel !== undefined ? cat : '')} onChange={(e) => go(e.target.value, sub)}>
            <option value="">{t('site.allCategories')}</option>
            {NEWS_MAIN_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{newsCategoryLabel(c.key, lang)}</option>)}
            {others.map((o) => <option key={o} value={`${OTHER}${o}`}>{o}</option>)}
          </select>
        </Field>
        <Field label={t('site.subcategory')}>
          <select className={`${inputCls} !py-1.5`} value={sub} onChange={(e) => go(cat, e.target.value)}>
            <option value="">{t('site.allSubcategories')}</option>
            {sub && !subs.includes(sub) && <option value={sub}>{sub}</option>}
            {subs.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      </div>
      <NewsTable key={`${cat}|${sub}`} section="regular" category={fixedKey} mainCategory={otherLabel} subcategory={sub || undefined} returnTo={urlFor(cat, sub)} />
    </>
  );
}
