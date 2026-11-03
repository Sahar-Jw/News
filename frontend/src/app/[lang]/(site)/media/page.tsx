'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate, fmtNum } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { Card, NewsCard, Thumb } from '@/components/site/cards';
import { Pager } from '@/components/site/pager';
import { useSite } from '@/components/site/site-context';

const TABS = ['news', 'statements', 'photos', 'video', 'interviews', 'coverage', 'press', 'kit'] as const;
type Tab = (typeof TABS)[number];
/** tabs that read news by a category label written in Settings (category "media") */
const CATEGORY_KEY: Partial<Record<Tab, string>> = { statements: 'statements_category', interviews: 'interviews_category', coverage: 'coverage_category' };

interface Paged<T> { data: T[]; meta: { totalPages: number } }
interface Gallery { id: number; title: string; images: string[] }
interface Doc { id: number; title: string; summary: string; docDate: string | null; fileUrl: string | null }

function NewsTab({ tab }: { tab: Tab }) {
  const { lang, t, href } = useI18n();
  const { s } = useSite();
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Paged<Card> | null>(null);
  const key = CATEGORY_KEY[tab];
  const category = key ? String(s('media', key) ?? '').trim() : '';

  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => {
    if (key && !category) { setRes({ data: [], meta: { totalPages: 1 } }); return; }
    setRes(null);
    api<Paged<Card>>('/public/news', { params: { lang, category: category || undefined, hasVideo: tab === 'video' ? 'true' : undefined, page, limit: 9 }, cache: 'no-store' })
      .then(setRes).catch(() => setRes({ data: [], meta: { totalPages: 1 } }));
  }, [lang, tab, category, key, page]);

  if (!res) return <Center><Spinner /></Center>;
  if (!res.data.length) return <Center>{t('md.empty')}</Center>;
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{res.data.map((n) => <NewsCard key={n.id} n={n} />)}</div>
      <Pager page={page} totalPages={res.meta.totalPages} onPage={setPage} />
      {tab === 'news' && <div className="mt-4 text-center"><Link href={href('/news')} className="text-sm font-semibold text-primary hover:underline">{t('md.allNews')} ›</Link></div>}
    </>
  );
}

function PhotosTab() {
  const { lang, t, href } = useI18n();
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Paged<Gallery> | null>(null);
  useEffect(() => {
    setRes(null);
    api<Paged<Gallery>>('/public/gallery', { params: { lang, page, limit: 8 }, cache: 'no-store' }).then(setRes).catch(() => setRes({ data: [], meta: { totalPages: 1 } }));
  }, [lang, page]);
  if (!res) return <Center><Spinner /></Center>;
  if (!res.data.length) return <Center>{t('md.empty')}</Center>;
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {res.data.map((g) => (
          <Link key={g.id} href={href(`/gallery/view?id=${g.id}`)} className="group overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg">
            <Thumb src={g.images[0]} alt={g.title} className="h-40 w-full" />
            <div className="p-4"><h2 className="line-clamp-2 font-bold group-hover:text-primary">{g.title}</h2><p className="mt-1 text-xs text-gray-500">{fmtNum(lang, g.images.length)} {t('pub.photos')}</p></div>
          </Link>
        ))}
      </div>
      <Pager page={page} totalPages={res.meta.totalPages} onPage={setPage} />
    </>
  );
}

/** press materials and the Media Kit are documents of kind "press" / "mediakit" */
function DocsTab({ kind }: { kind: 'press' | 'mediakit' }) {
  const { lang, t, href } = useI18n();
  const [res, setRes] = useState<Paged<Doc> | null>(null);
  useEffect(() => {
    setRes(null);
    api<Paged<Doc>>('/public/documents', { params: { lang, kind, limit: 50 }, cache: 'no-store' }).then(setRes).catch(() => setRes({ data: [], meta: { totalPages: 1 } }));
  }, [lang, kind]);
  if (!res) return <Center><Spinner /></Center>;
  if (!res.data.length) return <Center>{t('md.empty')}</Center>;
  return (
    <>
      {kind === 'mediakit' && <p className="mb-4 text-center text-sm text-gray-600">{t('md.kitIntro')}</p>}
      <ul className="grid gap-4 md:grid-cols-2">
        {res.data.map((d) => (
          <li key={d.id} className="flex items-start justify-between gap-3 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
            <div className="min-w-0">
              <Link href={href(`/documents/view?id=${d.id}`)} className="font-bold text-secondary hover:text-primary">{d.title}</Link>
              {d.docDate && <p className="mt-0.5 text-xs text-gray-500">{fmtDate(lang, d.docDate)}</p>}
              {d.summary && <p className="mt-1 line-clamp-2 text-sm leading-7 text-gray-600">{d.summary}</p>}
            </div>
            {d.fileUrl && <a href={fileUrl(d.fileUrl)} download className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-110">{t('doc.download')}</a>}
          </li>
        ))}
      </ul>
    </>
  );
}

/** P18: the Media Center, one page with tabs (wireframe): it only gathers what other screens already manage. */
function MediaCenter() {
  const { t, href } = useI18n();
  const router = useRouter();
  const raw = useSearchParams().get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'news';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-secondary">{t('md.title')}</h1>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" />
        </div>
      </header>
      <div className="mb-6 flex flex-wrap justify-center gap-2" role="tablist">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => router.push(href(`/media${k === 'news' ? '' : `?tab=${k}`}`))}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${tab === k ? 'border-primary bg-primary text-white' : 'bg-white text-gray-700 hover:border-primary'}`}>{t(`md.tab.${k}`)}</button>
        ))}
      </div>
      {tab === 'photos' ? <PhotosTab /> : tab === 'press' ? <DocsTab kind="press" /> : tab === 'kit' ? <DocsTab kind="mediakit" /> : <NewsTab tab={tab} />}
    </div>
  );
}

export default function MediaPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><MediaCenter /></Suspense>;
}
