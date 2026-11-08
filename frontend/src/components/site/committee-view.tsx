'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSite } from '@/components/site/site-context';
import { fmtDate, fmtDay } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { NotFoundContent } from '@/components/site/not-found-content';

interface Member { id: number; role: string; name: string; title: string; photoUrl: string | null }
interface Activity { id: number; kind: string; title: string; body: string; eventDate: string | null; upcoming: boolean }
interface NewsItem { id: number; title: string; excerpt: string; image: string | null; publishAt: string | null }
interface Video { id: number; title: string; youtubeId: string; cover: string | null }
interface Album { id: number; title: string; cover: string | null; count: number }
export interface CommitteeData {
  id: number; kind: string; name: string; summary: string; chairName: string; tags: string[]; logoUrl: string | null; duties: string;
  members: Member[]; meetings: Activity[]; visits?: Activity[]; recommendations: Activity[]; outputs?: Activity[]; events?: Activity[]; initiatives: Activity[]; news: NewsItem[]; gallery: Album[]; videos?: Video[];
}

const Heading = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{children}</h2>;
const Box = ({ children }: { children: React.ReactNode }) => <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">{children}</section>;

function MemberGrid({ members }: { members: Member[] }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {members.map((m) => (
        <div key={m.id} className="text-center">
          {m.photoUrl
            ? <img src={fileUrl(m.photoUrl)} alt="" loading="lazy" className="mx-auto h-24 w-24 rounded-2xl object-cover ring-2 ring-accent/50" />
            : <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10 text-3xl text-primary" aria-hidden="true">👤</span>}
          <div className="mt-2 text-sm font-bold text-secondary">{m.name}</div>
          <div className="text-xs text-primary">{m.role !== 'member' ? t(`cm.role.${m.role}`) : ''}</div>
          {m.title && <div className="text-xs text-gray-600">{m.title}</div>}
        </div>
      ))}
    </div>
  );
}

/** click-to-play YouTube card: the player (privacy domain) is only loaded when the visitor presses play */
function VideoCard({ v }: { v: Video }) {
  const [play, setPlay] = useState(false);
  return (
    <figure className="overflow-hidden rounded-xl ring-1 ring-line">
      <div className="relative aspect-video bg-black">
        {play ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${v.youtubeId}?rel=0&modestbranding=1&autoplay=1`} title={v.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0" />
        ) : (
          <button type="button" onClick={() => setPlay(true)} aria-label={v.title} className="group absolute inset-0">
            <img src={v.cover ? fileUrl(v.cover) : `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
            <span className="absolute inset-0 m-auto grid h-14 w-14 place-items-center rounded-full bg-red-600 text-white shadow-lg transition group-hover:scale-105"><svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M8 5v14l11-7z" /></svg></span>
          </button>
        )}
      </div>
      <figcaption className="px-3 py-2 text-sm font-semibold text-secondary">{v.title}</figcaption>
    </figure>
  );
}

function NewsList({ items, limit }: { items: NewsItem[]; limit?: number }) {
  const { lang, t, href } = useI18n();
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return <p className="text-sm text-gray-500">{t('cm.noContent')}</p>;
  return (
    <ul className="space-y-3">
      {shown.map((n) => (
        <li key={n.id}>
          <Link href={href(`/news/view?id=${n.id}`)} className="group flex items-start gap-3">
            {n.image && <img src={fileUrl(n.image)} alt="" loading="lazy" className="h-16 w-24 shrink-0 rounded-lg object-cover" />}
            <span className="min-w-0">
              <span className="block font-semibold text-secondary group-hover:text-primary">{n.title}</span>
              {n.publishAt && <span className="block text-xs text-gray-500">{fmtDate(lang, n.publishAt)}</span>}
              {!limit && n.excerpt && <span className="mt-1 block text-sm text-gray-600">{n.excerpt}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ActivityList({ items, empty }: { items: Activity[]; empty: string }) {
  const { lang, t } = useI18n();
  if (!items.length) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="space-y-4">
      {items.map((a) => (
        <li key={a.id} className="rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{t(`cm.act.${a.kind}`)}</span>
            {a.eventDate && <span className="text-xs text-gray-500">{fmtDay(lang, a.eventDate)}</span>}
            {a.upcoming && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">{t('cm.upcoming')}</span>}
          </div>
          <h3 className="mt-2 font-bold text-secondary">{a.title}</h3>
          {a.body && <div className="prose-news mt-2" dangerouslySetInnerHTML={{ __html: a.body }} />}
        </li>
      ))}
    </ul>
  );
}

/**
 * Committee page (wireframe 6.6): header with logo, chair, business activities and summary, then tabs:
 * overview, members, duties, news, meetings & visits, recommendations & outputs (+ initiatives for the women committee).
 * `path` is the API path of the committee ("/public/committees/3" or "/public/committees/women").
 * News shown here are the ones linked to the committee (content_links): nothing is typed twice.
 */
export function CommitteeView({ path }: { path: string }) {
  const { lang, t, href } = useI18n();
  const { loc } = useSite();
  const [c, setC] = useState<CommitteeData | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    setState('load');
    api<CommitteeData>(path, { params: { lang }, cache: 'no-store' }).then((r) => { setC(r); setState('ok'); }).catch(() => setState('404'));
  }, [path, lang]);

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.slice(1);
      const next = hash === 'about' ? 'overview' : hash;
      if (['overview', 'members', 'duties', 'news', 'meetings', 'visits', 'recommendations', 'outputs', 'events', 'initiatives', 'media', 'videos'].includes(next)) {
        setTab(next);
        requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  const tabs = useMemo(() => {
    if (!c) return [];
    return [
      { key: 'overview', show: true },
      { key: 'members', show: c.members.length > 0 },
      { key: 'duties', show: !!c.duties },
      { key: 'news', show: c.news.length > 0 },
      { key: 'meetings', show: c.meetings.length > 0 },
      { key: 'visits', show: (c.visits ?? []).length > 0 },
      { key: 'recommendations', show: c.recommendations.length > 0 },
      { key: 'outputs', show: (c.outputs ?? []).length > 0 },
      { key: 'events', show: (c.events ?? []).length > 0 },
      { key: 'initiatives', show: c.kind === 'women' },
      { key: 'media', show: (c.gallery ?? []).length > 0 },
      { key: 'videos', show: (c.videos ?? []).length > 0 },
    ].filter((x) => x.show);
  }, [c]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !c) return <NotFoundContent lang={lang} />;
  const upcoming = [...c.meetings, ...(c.events ?? [])].filter((m) => m.upcoming).sort((a, b) => (a.eventDate ?? '').localeCompare(b.eventDate ?? ''));
  const women = c.kind === 'women';

  return (
    <div className={women ? 'women-theme' : undefined}>
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav aria-label="breadcrumb" className="mb-4 text-sm text-gray-500">
        <Link href={href('/')} className="hover:text-primary">{t('site.home')}</Link>
        <span className="mx-1.5">›</span>
        {!women && <><Link href={href('/committees')} className="hover:text-primary">{t('cm.title')}</Link><span className="mx-1.5">›</span></>}
        <span className="text-ink">{c.name}</span>
      </nav>

      {women ? (
        <header id="about" className="relative scroll-mt-24 overflow-hidden rounded-3xl bg-secondary text-white shadow-card">
          <div className="pointer-events-none absolute -top-28 end-[-5rem] h-80 w-80 rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
          <div className="relative grid items-center gap-6 p-6 md:grid-cols-[auto,1fr] md:p-10">
            <img src={c.logoUrl ? fileUrl(c.logoUrl) : '/brand/women-committee-icon.svg'} alt={c.name} className="mx-auto h-40 w-auto max-w-[12rem] object-contain md:h-48" />
            <div className="min-w-0 text-center md:text-start">
              <h1 className="text-2xl font-extrabold leading-snug md:text-4xl">{c.name}</h1>
              <p className="mt-2 text-base font-semibold text-accent">{loc('women', 'tagline') || t('women.tagline')}</p>
              {c.chairName && <p className="mt-3 text-sm text-white/75">{t('cm.chair')}: <b className="text-white">{c.chairName}</b></p>}
              {c.tags.length > 0 && (
                <p className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs md:justify-start">
                  {c.tags.map((x) => <span key={x} className="rounded-full bg-accent/20 px-2.5 py-0.5 font-semibold text-white ring-1 ring-accent/50">{x}</span>)}
                </p>
              )}
              {c.summary && <p className="mt-4 max-w-3xl leading-7 text-white/85">{c.summary}</p>}
            </div>
          </div>
          <div className="h-1.5 bg-gradient-to-r from-transparent via-accent to-transparent" aria-hidden="true" />
        </header>
      ) : (
      <header className="flex flex-col-reverse items-stretch gap-5 rounded-3xl bg-white p-6 shadow-card ring-1 ring-line md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold leading-snug text-secondary md:text-3xl">{c.name}</h1>
          {c.chairName && <p className="mt-1 text-sm text-gray-600">{t('cm.chair')}: <b className="text-secondary">{c.chairName}</b></p>}
          {c.tags.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-gray-500">{t('cm.activity')}:</span>
              {c.tags.map((x) => <span key={x} className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">{x}</span>)}
            </p>
          )}
          {c.summary && <p className="mt-3 leading-7 text-ink/90">{c.summary}</p>}
        </div>
        {c.logoUrl
          ? <img src={fileUrl(c.logoUrl)} alt="" className="h-36 w-full shrink-0 rounded-2xl bg-canvas object-contain p-2 md:w-52" />
          : <span className="flex h-36 w-full shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-4xl text-primary md:w-52" aria-hidden="true">🏛</span>}
      </header>
      )}

      <div role="tablist" className="my-5 flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button key={x.key} role="tab" aria-selected={tab === x.key} onClick={() => { setTab(x.key); if (women) window.history.replaceState(null, '', `#${x.key === 'overview' ? 'about' : x.key}`); }} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === x.key ? 'bg-secondary text-white shadow-card' : 'bg-primary/10 text-ink/80 hover:bg-primary/20'}`}>{t(`cm.tab.${x.key}`)}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div id={women ? 'overview' : undefined} className="scroll-mt-24 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Box><Heading>{t('cm.latestNews')}</Heading><NewsList items={c.news} limit={3} /></Box>
            <Box><Heading>{t('cm.upcomingMeetings')}</Heading><ActivityList items={upcoming.slice(0, 3)} empty={t('cm.noContent')} /></Box>
          </div>
          {c.members.length > 0 && <Box><Heading>{t('cm.tab.members')}</Heading><MemberGrid members={c.members.slice(0, 6)} /></Box>}
        </div>
      )}
      {tab === 'members' && <div id="members" className="scroll-mt-24"><Box><MemberGrid members={c.members} /></Box></div>}
      {tab === 'duties' && <div id="duties" className="scroll-mt-24"><Box><div className="prose-news" dangerouslySetInnerHTML={{ __html: c.duties }} /></Box></div>}
      {tab === 'news' && <div id="news" className="scroll-mt-24"><Box><NewsList items={c.news} /></Box></div>}
      {tab === 'meetings' && <div id="meetings" className="scroll-mt-24"><Box><ActivityList items={c.meetings} empty={t('cm.noContent')} /></Box></div>}
      {tab === 'visits' && <div id="visits" className="scroll-mt-24"><Box><ActivityList items={c.visits ?? []} empty={t('cm.noContent')} /></Box></div>}
      {tab === 'outputs' && <div id="outputs" className="scroll-mt-24"><Box><ActivityList items={c.outputs ?? []} empty={t('cm.noContent')} /></Box></div>}
      {tab === 'events' && <div id="events" className="scroll-mt-24"><Box><ActivityList items={c.events ?? []} empty={t('cm.noContent')} /></Box></div>}
      {tab === 'videos' && (
        <div id="videos" className="scroll-mt-24"><Box>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{(c.videos ?? []).map((v) => <VideoCard key={v.id} v={v} />)}</div>
        </Box></div>
      )}
      {tab === 'recommendations' && <div id="recommendations" className="scroll-mt-24"><Box><ActivityList items={c.recommendations} empty={t('cm.noContent')} /></Box></div>}
      {tab === 'media' && (
        <div id="media" className="scroll-mt-24"><Box>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {c.gallery.map((g) => (
              <Link key={g.id} href={href(`/gallery/view?id=${g.id}`)} className="group block overflow-hidden rounded-xl ring-1 ring-line transition hover:ring-accent">
                {g.cover ? <img src={fileUrl(g.cover)} alt="" loading="lazy" className="h-32 w-full object-cover" /> : <span className="flex h-32 items-center justify-center bg-primary/10 text-3xl" aria-hidden="true">🖼</span>}
                <span className="block px-3 py-2 text-sm font-semibold text-secondary group-hover:text-primary">{g.title}<span className="ms-1 text-xs font-normal text-gray-500">({g.count})</span></span>
              </Link>
            ))}
          </div>
        </Box></div>
      )}
      {tab === 'initiatives' && <div id="initiatives" className="scroll-mt-24"><Box><ActivityList items={c.initiatives} empty={t('cm.noContent')} /></Box></div>}

      <p className="mt-5 text-sm text-gray-500">⟲ {t('cm.archiveNote')}</p>
    </div>
    </div>
  );
}
