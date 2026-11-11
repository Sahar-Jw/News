'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PlayBadge } from '@/components/site/play-badge';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate, fmtNum } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { Card, NewsCard, Thumb } from '@/components/site/cards';
import { Pager } from '@/components/site/pager';
import { useSite } from '@/components/site/site-context';
import { AllNews } from '@/components/site/news-all';
import { addNewsHref, newsCategoryKeyOf } from '@/lib/news-categories';

const TABS = ['news', 'statements', 'photos', 'video', 'interviews', 'coverage', 'press', 'kit'] as const;
type Tab = (typeof TABS)[number];
/** tabs that read news by a category label written in Settings (category "media") */
const CATEGORY_KEY: Partial<Record<Tab, string>> = { statements: 'statements_category', interviews: 'interviews_category', coverage: 'coverage_category' };

interface Paged<T> { data: T[]; meta: { totalPages: number } }
interface Gallery { id: number; title: string; images: string[] }
interface Doc { id: number; title: string; summary: string; docDate: string | null; fileUrl: string | null }

/** statements / interviews / coverage / video: news filtered by a label or by having a video (the plain "news" tab is the full list, AllNews) */
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
    </>
  );
}

interface GalleryCard { id: number; title: string; kind: 'photos' | 'video'; category: string | null; thumb: string | null; images: string[]; createdAt: string }

const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs font-semibold transition ${on ? 'border-secondary bg-secondary text-white' : 'bg-white text-gray-700 hover:border-primary'}`;

/** The photo / video archive: albums and videos filtered by occasion (category) and by year. */
function ArchiveTab({ type }: { type: 'photos' | 'video' }) {
  const { lang, t, href } = useI18n();
  const [page, setPage] = useState(1);
  const [cat, setCat] = useState('');
  const [year, setYear] = useState('');
  const [cats, setCats] = useState<{ category: string; count: number }[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [res, setRes] = useState<Paged<GalleryCard> | null>(null);
  useEffect(() => { setPage(1); setCat(''); setYear(''); }, [type]);
  useEffect(() => {
    api<{ category: string; count: number }[]>('/public/gallery/categories', { params: { type }, cache: 'no-store' }).then(setCats).catch(() => setCats([]));
    api<number[]>('/public/gallery/years', { params: { type }, cache: 'no-store' }).then(setYears).catch(() => setYears([]));
  }, [type]);
  useEffect(() => {
    setRes(null);
    api<Paged<GalleryCard>>('/public/gallery', { params: { lang, type, category: cat || undefined, year: year || undefined, page, limit: 12 }, cache: 'no-store' })
      .then(setRes).catch(() => setRes({ data: [], meta: { totalPages: 1 } }));
  }, [lang, type, cat, year, page]);
  return (
    <>
      <p className="mb-4 text-center text-sm text-gray-600">{t(type === 'photos' ? 'md.photosHint' : 'md.videosHint')}</p>
      {cats.length > 0 && (
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          <button type="button" className={chip(!cat)} onClick={() => { setCat(''); setPage(1); }}>{t('gl.allCategories')}</button>
          {cats.map((c) => <button key={c.category} type="button" className={chip(cat === c.category)} onClick={() => { setCat(c.category); setPage(1); }}>{t(`gl.cat.${c.category}`)} ({fmtNum(lang, c.count)})</button>)}
        </div>
      )}
      {years.length > 1 && (
        <div className="mb-5 flex flex-wrap justify-center gap-2">
          <button type="button" className={chip(!year)} onClick={() => { setYear(''); setPage(1); }}>{t('md.allYears')}</button>
          {years.map((y) => <button key={y} type="button" className={chip(year === String(y))} onClick={() => { setYear(String(y)); setPage(1); }}>{fmtNum(lang, y).replace(/[,٬]/g, '')}</button>)}
        </div>
      )}
      {!res ? <Center><Spinner /></Center> : !res.data.length ? <Center>{t('md.empty')}</Center> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {res.data.map((g) => (
              <Link key={g.id} href={href(`/gallery/view?id=${g.id}`)} className="group overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative"><Thumb src={g.thumb ?? g.images[0]} alt={g.title} className="h-40 w-full" />{g.kind === 'video' && <PlayBadge />}</div>
                <div className="p-4">
                  <h2 className="line-clamp-2 font-bold group-hover:text-primary">{g.title}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                    {g.kind === 'photos' && <span>{fmtNum(lang, g.images.length)} {t('pub.photos')}</span>}
                    {g.category && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{t(`gl.cat.${g.category}`)}</span>}
                    <span>{fmtDate(lang, g.createdAt)}</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <Pager page={page} totalPages={res.meta.totalPages} onPage={setPage} />
        </>
      )}
    </>
  );
}

function VideoTab() {
  const { t } = useI18n();
  return (
    <div className="space-y-10">
      <ArchiveTab type="video" />
      <section>
        <h2 className="mb-4 border-s-4 border-accent ps-3 text-lg font-extrabold text-secondary">{t('md.newsVideos')}</h2>
        <NewsTab tab="video" />
      </section>
    </div>
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

function Download({ href: h, children }: { href: string; children: React.ReactNode }) {
  return <a href={h} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110">⬇ {children}</a>;
}
function KitBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line"><h2 className="mb-4 border-s-4 border-accent ps-3 text-lg font-extrabold text-secondary">{title}</h2>{children}</section>;
}

/** The Media Kit: logo, visual identity, officials' photos, the building, general information and the media files. Shown once approved (Settings → media center). */
function KitTab() {
  const { lang, t } = useI18n();
  const { s, loc, img } = useSite();
  const { can } = useAuth();
  const enabled = s('media', 'kit_enabled') === true || s('media', 'kit_enabled') === 'true';
  const manager = can('settings.read', 'settings.update');
  const [officials, setOfficials] = useState<{ id: number; name: string; jobTitle: string; photoUrl: string | null }[]>([]);
  const [hq, setHq] = useState<GalleryCard | null>(null);
  const hqId = Number(s('media', 'kit_hq_album')) || 0;
  useEffect(() => {
    api<typeof officials>('/public/board', { params: { lang }, cache: 'no-store' }).then((r) => setOfficials(r.filter((m) => m.photoUrl))).catch(() => setOfficials([]));
  }, [lang]);
  useEffect(() => {
    if (!hqId) { setHq(null); return; }
    api<GalleryCard>(`/public/gallery/${hqId}`, { params: { lang }, cache: 'no-store' }).then(setHq).catch(() => setHq(null));
  }, [hqId, lang]);

  if (!enabled && !manager) return <Center>{t('md.kitSoon')}</Center>;
  const logo = img('media', 'kit_logo') || img('branding', 'logo');
  const logoAlt = img('media', 'kit_logo_alt');
  const guide = img('media', 'kit_identity_file');
  const identity = loc('media', 'kit_identity');
  const about = loc('media', 'kit_about');
  const colors = [['primary_color', '#0a5c3d'], ['secondary_color', '#043323'], ['accent_color', '#bd9f6e']].map(([k, d]) => String(s('appearance', k) || d));
  return (
    <div className="space-y-6">
      {!enabled && <p className="rounded-xl bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 ring-1 ring-amber-200">{t('md.kitDraft')}</p>}
      <p className="text-center text-sm text-gray-600">{t('md.kitIntro')}</p>

      {(logo || logoAlt) && (
        <KitBlock title={t('md.kitLogo')}>
          <div className="grid gap-4 sm:grid-cols-2">
            {logo && <div className="rounded-xl bg-canvas p-5 text-center"><img src={logo} alt="" className="mx-auto h-28 w-auto max-w-full object-contain" /><div className="mt-3"><Download href={logo}>{t('md.kitDownload')}</Download></div></div>}
            {logoAlt && <div className="rounded-xl bg-secondary p-5 text-center"><img src={logoAlt} alt="" className="mx-auto h-28 w-auto max-w-full object-contain" /><div className="mt-3"><Download href={logoAlt}>{t('md.kitLogoAlt')}</Download></div></div>}
          </div>
        </KitBlock>
      )}

      <KitBlock title={t('md.kitIdentity')}>
        {identity && <p className="mb-4 whitespace-pre-line text-sm leading-8 text-ink/85">{identity}</p>}
        <h3 className="mb-2 text-sm font-bold text-gray-600">{t('md.kitColors')}</h3>
        <div className="flex flex-wrap gap-3">
          {colors.map((c) => <div key={c} className="w-28 overflow-hidden rounded-xl ring-1 ring-line"><div className="h-14" style={{ background: c }} /><div className="bg-white px-2 py-1 text-center text-xs font-mono" dir="ltr">{c.toUpperCase()}</div></div>)}
        </div>
        {guide && <div className="mt-4"><Download href={guide}>{t('md.kitGuide')}</Download></div>}
      </KitBlock>

      {officials.length > 0 && (
        <KitBlock title={t('md.kitOfficials')}>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
            {officials.map((m) => (
              <div key={m.id} className="text-center">
                <img src={fileUrl(m.photoUrl)} alt="" loading="lazy" className="mx-auto h-32 w-32 rounded-2xl object-cover ring-1 ring-line" />
                <div className="mt-2 text-sm font-bold text-secondary">{m.name}</div>
                {m.jobTitle && <div className="text-xs text-gray-600">{m.jobTitle}</div>}
                <div className="mt-2"><Download href={fileUrl(m.photoUrl)}>{t('md.kitDownload')}</Download></div>
              </div>
            ))}
          </div>
        </KitBlock>
      )}

      {hq && hq.images.length > 0 && (
        <KitBlock title={t('md.kitHq')}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hq.images.map((src, i) => (
              <div key={src} className="overflow-hidden rounded-xl ring-1 ring-line"><img src={src} alt={`${hq.title} ${i + 1}`} loading="lazy" className="h-44 w-full object-cover" /><div className="bg-white p-2 text-center"><Download href={src}>{t('md.kitDownload')}</Download></div></div>
            ))}
          </div>
        </KitBlock>
      )}

      {about && <KitBlock title={t('md.kitAbout')}><p className="whitespace-pre-line text-sm leading-8 text-ink/85">{about}</p></KitBlock>}

      <KitBlock title={t('md.kitFiles')}><DocsTab kind="mediakit" /></KitBlock>
    </div>
  );
}

/** Shortcuts for people who may manage the media center (they are not shown to visitors). */
function ManageBar() {
  const { t, href } = useI18n();
  const { can } = useAuth();
  // a category chip is selected: "add news" is then pinned to that category (it cannot be changed in the form)
  const cat = useSearchParams().get('category') ?? '';
  const catKey = newsCategoryKeyOf(cat);
  const items = [
    can('news.create') && { to: catKey ? addNewsHref(catKey, `/media?category=${encodeURIComponent(cat)}`) : '/admin/news/edit', label: `＋ ${t('md.addNews')}` },
    can('gallery.create', 'gallery.update') && { to: '/admin/settings?page=media&tab=gallery', label: `＋ ${t('md.addAlbum')}` },
    can('documents.create', 'documents.update') && { to: '/admin/settings?page=documents&tab=documents', label: `＋ ${t('md.addDoc')}` },
    can('settings.update') && { to: '/admin/settings?page=media&tab=settings', label: `⚙ ${t('md.kitSettings')}` },
  ].filter(Boolean) as { to: string; label: string }[];
  if (!items.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
      <span className="text-xs font-bold text-primary">{t('md.manage')}:</span>
      {items.map((x) => <Link key={x.to} href={href(x.to)} className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white hover:brightness-110">{x.label}</Link>)}
    </div>
  );
}

/** P18: the Media Center, one page with tabs (wireframe): it only gathers what other screens already manage. */
function MediaCenter() {
  const { t, href } = useI18n();
  const router = useRouter();
  const raw = useSearchParams().get('tab');
  const { s } = useSite();
  const { can } = useAuth();
  const kitVisible = s('media', 'kit_enabled') === true || s('media', 'kit_enabled') === 'true' || can('settings.read', 'settings.update');
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'news';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-secondary">{t('md.title')}</h1>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" />
        </div>
      </header>
      <ManageBar />
      <div className="mb-6 flex flex-wrap justify-center gap-2" role="tablist">
        {TABS.filter((k) => k !== 'kit' || kitVisible).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => router.push(href(`/media${k === 'news' ? '' : `?tab=${k}`}`))}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${tab === k ? 'border-primary bg-primary text-white' : 'bg-white text-gray-700 hover:border-primary'}`}>{t(`md.tab.${k}`)}</button>
        ))}
      </div>
      {tab === 'photos' ? <ArchiveTab type="photos" /> : tab === 'video' ? <VideoTab /> : tab === 'press' ? <DocsTab kind="press" /> : tab === 'kit' ? <KitTab /> : tab === 'news' ? <AllNews /> : <NewsTab tab={tab} />}
    </div>
  );
}

export default function MediaPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><MediaCenter /></Suspense>;
}
