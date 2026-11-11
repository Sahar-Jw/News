'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { Card, NewsCard, Thumb } from '@/components/site/cards';
import { Pager } from '@/components/site/pager';
import { ImageSlider } from '@/components/site/image-slider';
import { PlayBadge } from '@/components/site/play-badge';
import { YoutubeEmbed } from '@/components/site/youtube-embed';
import { Heading, useExpoInfo } from '@/components/site/expo-shared';

interface Album { id: number; title: string; kind: 'photos' | 'video'; youtubeId: string | null; thumb: string | null; images: string[] }
type Tab = 'news' | 'photos' | 'videos' | 'coverage' | 'interviews' | 'materials';

/**
 * EXPO news and media. News tabs filter the news by the topics set in Settings → DCC EXPO (news, media coverage, interviews, media materials;
 * a tab with no topic set is hidden). Photos and videos are the gallery items with the category "DCC EXPO".
 */
export default function ExpoNews() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const x = useExpoInfo();
  const topics: Partial<Record<Tab, string>> = { news: x.newsTopic, coverage: x.L('coverage_topic'), interviews: x.L('interviews_topic'), materials: x.L('materials_topic') };
  const tabs: [Tab, string][] = [['news', ar ? 'الأخبار' : 'News'], ['photos', ar ? 'الصور' : 'Photos'], ['videos', ar ? 'الفيديوهات' : 'Videos'], ['coverage', ar ? 'التغطية الإعلامية' : 'Media coverage'], ['interviews', ar ? 'اللقاءات والمقابلات' : 'Interviews'], ['materials', ar ? 'المواد الإعلامية' : 'Media materials']];
  const visible = tabs.filter(([k]) => k === 'photos' || k === 'videos' || !!topics[k]);
  const [tab, setTab] = useState<Tab>('news');
  const [page, setPage] = useState(1);
  const [news, setNews] = useState<{ data: Card[]; meta: { totalPages: number } } | null>(null);
  const [albums, setAlbums] = useState<{ data: Album[]; meta: { totalPages: number } } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const isMedia = tab === 'photos' || tab === 'videos';
  useEffect(() => { setPage(1); setOpen(null); }, [tab]);
  useEffect(() => {
    let live = true;
    if (isMedia) {
      setAlbums(null);
      api<{ data: Album[]; meta: { totalPages: number } }>('/public/gallery', { params: { lang, category: 'expo', type: tab === 'photos' ? 'photos' : 'video', page, limit: 9 }, cache: 'no-store' })
        .then((r) => live && setAlbums(r)).catch(() => live && setAlbums({ data: [], meta: { totalPages: 1 } }));
    } else {
      const topic = topics[tab];
      if (!topic) { setNews({ data: [], meta: { totalPages: 1 } }); return; }
      setNews(null);
      api<{ data: Card[]; meta: { totalPages: number } }>('/public/news', { params: { lang, topics: topic, page, limit: 9 } })
        .then((r) => live && setNews(r)).catch(() => live && setNews({ data: [], meta: { totalPages: 1 } }));
    }
    return () => { live = false; };
  }, [lang, tab, page, x.newsTopic]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = isMedia ? albums : news;
  const opened = albums?.data.find((a) => a.id === open);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Heading>{ar ? 'الأخبار والإعلام' : 'News & media'}</Heading>
      <div className="mb-6 flex flex-wrap justify-center gap-2" role="tablist">
        {visible.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-5 py-2 text-sm font-bold transition ${tab === k ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>{label}</button>)}
      </div>
      {!current ? <Center><Spinner /></Center> : current.data.length === 0 ? <Center>{ar ? 'لا يوجد محتوى بعد' : 'Nothing here yet'}</Center> : (
        <>
          {isMedia ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {albums!.data.map((a) => (
                  <button key={a.id} type="button" onClick={() => setOpen(open === a.id ? null : a.id)} aria-pressed={open === a.id} className={`group overflow-hidden rounded-2xl bg-white text-start shadow-card ring-1 transition hover:-translate-y-0.5 ${open === a.id ? 'ring-2 ring-accent' : 'ring-line'}`}>
                    <div className="relative"><Thumb src={a.thumb} alt={a.title} className="h-44 w-full" />{a.kind === 'video' && <PlayBadge />}</div>
                    <div className="p-3 font-bold text-secondary">{a.title}</div>
                  </button>
                ))}
              </div>
              {opened && <div className="mt-6 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">{opened.kind === 'video' && opened.youtubeId ? <YoutubeEmbed id={opened.youtubeId} title={opened.title} /> : <ImageSlider images={opened.images} title={opened.title} />}</div>}
            </>
          ) : <div className="grid gap-4 md:grid-cols-3">{news!.data.map((n) => <NewsCard key={n.id} n={n} />)}</div>}
          <Pager page={page} totalPages={current.meta.totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
