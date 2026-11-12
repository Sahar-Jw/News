'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { Card, NewsCard } from '@/components/site/cards';
import { Pager } from '@/components/site/pager';

interface Hit { group: string; id: number; title: string; excerpt: string; url: string; date: string | null }
interface Paged<T> { data: T[]; meta: { totalPages: number; total: number } }
type SiteResult = Paged<Hit> & { counts: Record<string, number> };

/** the kinds of results: news come from the news search, every other kind from the site-wide search */
const GROUPS: [string, string, string][] = [
  ['events', 'المعارض والفعاليات', 'Exhibitions & events'], ['documents', 'القرارات والوثائق', 'Decisions & documents'], ['committees', 'اللجان والقطاعات', 'Committees'],
  ['services', 'الخدمات', 'Services'], ['training', 'التدريب', 'Training'], ['incubator', 'حاضنة الأعمال', 'Business incubator'], ['get2trade', 'Get2Trade', 'Get2Trade'],
  ['expo', 'المعرض الافتراضي', 'Virtual expo'], ['board', 'مجلس الإدارة', 'Board'], ['faq', 'الأسئلة الشائعة', 'FAQ'], ['pages', 'صفحات الموقع', 'Site pages'],
];

/** Search the whole site: news, events, documents, committees, services, training, incubator, Get2Trade, expo, board, FAQs and pages. */
function Results() {
  const { lang, t, href } = useI18n();
  const ar = lang === 'ar';
  const sp = useSearchParams();
  const router = useRouter();
  const q = (sp.get('q') ?? '').trim();
  const group = sp.get('group') ?? '';           // '' = everything, 'news' = news only, or one of GROUPS
  const page = Math.max(1, Number(sp.get('page') ?? 1) || 1);
  const [news, setNews] = useState<Paged<Card> | null>(null);
  const [site, setSite] = useState<SiteResult | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (q.length < 2) { setErr(t('site.searchMin')); setNews(null); setSite(null); return; }
    setErr(''); setNews(null); setSite(null);
    const wantNews = group === '' || group === 'news';
    const wantSite = group !== 'news';
    // news: all of them on their own tab, a few above the other results on the "all" tab
    const n = wantNews ? api<Paged<Card>>('/public/search', { params: { q, lang, page: group === 'news' ? page : 1, limit: group === 'news' ? 12 : 4 } }) : api<Paged<Card>>('/public/search', { params: { q, lang, limit: 1 } });
    const s = wantSite ? api<SiteResult>('/public/site-search', { params: { q, lang, group: group || undefined, page, limit: 12 } }) : api<SiteResult>('/public/site-search', { params: { q, lang, limit: 1 } });
    Promise.all([n, s]).then(([a, b]) => { setNews(a); setSite(b); }).catch((e) => setErr(e.message));
  }, [q, lang, group, page, t]);

  const go = (params: Record<string, string | number>) => {
    const u = new URLSearchParams({ q });
    for (const [k, v] of Object.entries(params)) if (v) u.set(k, String(v));
    router.push(href(`/search?${u.toString()}`));
  };
  const total = (news?.meta.total ?? 0) + Object.values(site?.counts ?? {}).reduce((a, b) => a + b, 0);
  const chip = (key: string, label: string, count?: number) => (
    <button key={key || 'all'} type="button" aria-pressed={group === key} onClick={() => go({ group: key })}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${group === key ? 'bg-secondary text-white' : 'bg-white text-secondary ring-1 ring-line hover:text-primary'}`}>
      {label}{count !== undefined ? <span className={`ms-1.5 text-xs ${group === key ? 'text-white/80' : 'text-gray-500'}`}>{count}</span> : null}
    </button>
  );
  const label = (g: string) => GROUPS.find((x) => x[0] === g)?.[ar ? 1 : 2] ?? g;
  const loading = !err && (!news || !site);
  const showNews = group === '' || group === 'news';
  const showSite = group !== 'news';
  const pages = group === 'news' ? news?.meta.totalPages ?? 1 : site?.meta.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-3xl font-bold">{t('site.results')}</h1>
      {q && <p className="mb-5 text-gray-500">“{q}”{news && site ? ` — ${total}` : ''}</p>}
      {q.length >= 2 && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={ar ? 'نوع النتائج' : 'Result type'}>
          {chip('', ar ? 'الكل' : 'All', news && site ? total : undefined)}
          {chip('news', ar ? 'الأخبار' : 'News', news?.meta.total)}
          {GROUPS.filter(([g]) => !site || (site.counts[g] ?? 0) > 0 || group === g).map(([g, a, e]) => chip(g, ar ? a : e, site?.counts[g]))}
        </div>
      )}
      {err ? <Center>{err}</Center> : loading ? <Center><Spinner /></Center> : total === 0 ? <Center>{ar ? 'لا توجد نتائج مطابقة' : 'No matching results'}</Center> : (
        <div className="space-y-8">
          {showNews && news && news.data.length > 0 && (
            <section>
              {group === '' && <h2 className="mb-3 text-lg font-bold text-secondary">{ar ? 'الأخبار' : 'News'}</h2>}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{news.data.map((n) => <NewsCard key={n.id} n={n} />)}</div>
              {group === '' && news.meta.total > news.data.length && <p className="mt-3 text-center"><button type="button" onClick={() => go({ group: 'news' })} className="text-sm font-bold text-primary hover:underline">{ar ? `عرض كل الأخبار (${news.meta.total})` : `All ${news.meta.total} news results`}</button></p>}
            </section>
          )}
          {showSite && site && site.data.length > 0 && (
            <section>
              {group === '' && news && news.data.length > 0 && <h2 className="mb-3 text-lg font-bold text-secondary">{ar ? 'نتائج أخرى في الموقع' : 'More on the site'}</h2>}
              <ul className="grid gap-3 md:grid-cols-2">
                {site.data.map((h) => (
                  <li key={`${h.group}-${h.id}-${h.url}`}>
                    <Link href={href(h.url)} className="group flex h-full flex-col rounded-2xl bg-white p-4 shadow-card ring-1 ring-line transition hover:ring-accent">
                      <span className="mb-1.5 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-bold text-primary">{label(h.group)}</span>{h.date && <span className="text-gray-500">{fmtDay(lang, h.date.slice(0, 10))}</span>}</span>
                      <h3 className="font-bold leading-snug group-hover:text-primary">{h.title}</h3>
                      {h.excerpt && <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">{h.excerpt}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <Pager page={page} totalPages={pages} onPage={(p) => go({ group, page: p })} />
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Results /></Suspense>;
}
