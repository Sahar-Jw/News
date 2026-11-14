'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api, downloadUrl, fileUrl, withDownload } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { useSite } from '@/components/site/site-context';
import { AllNews } from '@/components/site/news-all';
import { newsCategoryKeyOf } from '@/lib/news-categories';
import { NewsFormDialog } from '@/components/admin/news-form';

const TABS = ['news', 'press', 'kit'] as const;
type Tab = (typeof TABS)[number];
interface Paged<T> { data: T[]; meta: { totalPages: number } }
interface Doc { id: number; title: string; summary: string; docDate: string | null; fileUrl: string | null }

interface GalleryCard { id: number; title: string; kind: 'photos' | 'video'; category: string | null; thumb: string | null; images: string[]; createdAt: string }

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
            {d.fileUrl && <a href={downloadUrl(d.fileUrl, d.title)} download className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-110">{t('doc.download')}</a>}
          </li>
        ))}
      </ul>
    </>
  );
}

function Download({ href: h, children }: { href: string; children: React.ReactNode }) {
  return <a href={withDownload(h)} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110">⬇ {children}</a>;
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
  const [adding, setAdding] = useState(false);
  const chip = 'rounded-full bg-primary px-3 py-1 text-xs font-bold text-white hover:brightness-110';
  const items = [
    can('news.create') && { key: 'news', onClick: () => setAdding(true), label: `＋ ${t('md.addNews')}` },
    can('documents.create', 'documents.update') && { key: 'doc', to: '/admin/settings?page=documents&tab=documents', label: `＋ ${t('md.addDoc')}` },
    can('settings.update') && { key: 'kit', to: '/admin/settings?page=media&tab=settings', label: `⚙ ${t('md.kitSettings')}` },
  ].filter(Boolean) as { key: string; label: string; to?: string; onClick?: () => void }[];
  if (!items.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
      <span className="text-xs font-bold text-primary">{t('md.manage')}:</span>
      {items.map((x) => x.to
        ? <Link key={x.key} href={href(x.to)} className={chip}>{x.label}</Link>
        : <button key={x.key} type="button" onClick={x.onClick} className={chip}>{x.label}</button>)}
      {adding && <NewsFormDialog category={catKey} onClose={() => setAdding(false)} />}
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
      {tab === 'press' ? <DocsTab kind="press" /> : tab === 'kit' ? <KitTab /> : <AllNews />}
    </div>
  );
}

export default function MediaPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><MediaCenter /></Suspense>;
}
