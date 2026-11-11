'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, onSiteChange } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtNum } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { GalleryDialog } from '@/components/admin/gallery-admin';
import { Thumb } from '@/components/site/cards';
import { ConfirmDelete, ItemActions, ManageBtn, PageManageBar } from '@/components/site/page-manage-bar';
import { Pager } from '@/components/site/pager';
import { PlayBadge } from '@/components/site/play-badge';

/** an item can hold pictures and/or a video */
interface PublicGallery { id: number; title: string; category: string | null; youtubeId: string | null; hasVideo: boolean; hasImages: boolean; thumb: string | null; images: string[] }
interface CategoryCount { category: string; count: number }
type TypeFilter = '' | 'photos' | 'video';
const PAGE_SIZE = 12;

/** Image and video gallery: photo albums and YouTube videos in one grid, filtered by type and by category (meetings, events, exhibitions ...). */
export default function GalleryPage() {
  const { lang, t, href } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const topRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState<TypeFilter>('');
  const [category, setCategory] = useState('');
  const [cats, setCats] = useState<CategoryCount[]>([]);
  const [year, setYear] = useState('');
  const [years, setYears] = useState<number[]>([]);
  const [data, setData] = useState<{ data: PublicGallery[]; meta: { totalPages: number; total?: number } } | null>(null);
  // manager tools: the add / edit window (id = album being edited) and the album waiting for the delete confirmation
  const [dialog, setDialog] = useState<{ id?: number } | null>(null);
  const [ask, setAsk] = useState<PublicGallery | null>(null);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const mayAdd = can('gallery.create');
  const mayEdit = can('gallery.update') && can('gallery.read');
  const mayDelete = can('gallery.delete');

  const loadFilters = useCallback(() => {
    api<CategoryCount[]>('/public/gallery/categories', { params: { type: type || undefined } }).then(setCats).catch(() => setCats([]));
    api<number[]>('/public/gallery/years', { params: { type: type || undefined } }).then((r) => { setYears(r); setYear((y) => (y && !r.includes(Number(y)) ? '' : y)); }).catch(() => setYears([]));
  }, [type]);
  useEffect(() => { loadFilters(); }, [loadFilters]);
  // a change made in the windows below (or in another browser tab) shows up at once
  useEffect(() => onSiteChange(() => { loadFilters(); setRefresh((n) => n + 1); }), [loadFilters]);
  // a category that has nothing in the chosen type is dropped
  useEffect(() => { if (category && !cats.some((c) => c.category === category)) setCategory(''); }, [cats, category]);

  useEffect(() => {
    setData(null);
    api('/public/gallery', { params: { lang, page, limit: PAGE_SIZE, type: type || undefined, category: category || undefined, year: year || undefined }, cache: 'no-store' }).then(setData).catch(() => setData({ data: [], meta: { totalPages: 1 } }));
  }, [lang, page, type, category, year, refresh]);
  // deleting the last album of a page leaves an empty page behind: step back to the last one that exists
  useEffect(() => { if (data && data.data.length === 0 && page > 1) setPage(Math.max(1, data.meta.totalPages)); }, [data, page]);

  const remove = async () => {
    if (!ask) return;
    setBusy(true);
    try {
      await api(`/admin/gallery/${ask.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      setAsk(null);
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const goPage = (p: number) => { setPage(p); topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const pick = (fn: () => void) => () => { fn(); setPage(1); };
  const chip = (on: boolean) => `rounded-full px-4 py-1.5 text-sm font-semibold transition ${on ? 'bg-secondary text-white shadow-card' : 'bg-primary/10 text-ink/80 hover:bg-primary/20'}`;

  return (
    <div ref={topRef} className="mx-auto max-w-7xl scroll-mt-24 px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">{t('gl.title')}</h1>
      <p className="mb-5 text-sm text-gray-600">{t(type === 'photos' ? 'gl.hint.photos' : type === 'video' ? 'gl.hint.video' : 'gl.hint.all')}</p>
      {/* control buttons: only for people holding the matching permissions */}
      <PageManageBar show={mayAdd || mayEdit || mayDelete} settingsUrl={can('gallery.read') ? '/admin/settings?page=media&tab=gallery' : undefined}>
        {mayAdd && <ManageBtn onClick={() => setDialog({})}>＋ {t('gl.add')}</ManageBtn>}
      </PageManageBar>
      {dialog && <GalleryDialog key={dialog.id ?? 'new'} id={dialog.id} onClose={() => setDialog(null)} onSaved={() => { loadFilters(); setRefresh((n) => n + 1); }} />}
      {ask && <ConfirmDelete busy={busy} onConfirm={remove} onClose={() => setAsk(null)} />}
      <div role="tablist" aria-label={t('gl.type')} className="mb-3 flex flex-wrap gap-2">
        {([['', 'gl.all'], ['photos', 'gl.kind.photos'], ['video', 'gl.kind.video']] as [TypeFilter, string][]).map(([k, label]) => (
          <button key={k || 'all'} role="tab" aria-selected={type === k} onClick={pick(() => setType(k))} className={chip(type === k)}>{t(label)}</button>
        ))}
      </div>
      {cats.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2" aria-label={t('gl.category')}>
          <button aria-pressed={category === ''} onClick={pick(() => setCategory(''))} className={`${chip(category === '')} !px-3 !py-1 !text-xs`}>{t('gl.allCategories')}</button>
          {cats.map((c) => <button key={c.category} aria-pressed={category === c.category} onClick={pick(() => setCategory(c.category))} className={`${chip(category === c.category)} !px-3 !py-1 !text-xs`}>{t(`gl.cat.${c.category}`)} <span className="opacity-60">({fmtNum(lang, c.count)})</span></button>)}
        </div>
      )}
      {years.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2" aria-label={t('md.allYears')}>
          <button aria-pressed={year === ''} onClick={pick(() => setYear(''))} className={`${chip(year === '')} !px-3 !py-1 !text-xs`}>{t('md.allYears')}</button>
          {years.map((y) => <button key={y} aria-pressed={year === String(y)} onClick={pick(() => setYear(String(y)))} className={`${chip(year === String(y))} !px-3 !py-1 !text-xs`}>{String(y)}</button>)}
        </div>
      )}
      {!data ? <Center><Spinner /></Center> : data.data.length === 0 ? <Center>{t('pub.noGalleries')}</Center> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.data.map((g) => (
              <div key={g.id} className="flex flex-col gap-2">
              <Link href={href(`/gallery/view?id=${g.id}`)} className="group flex-1 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="relative">
                  <Thumb src={g.thumb} alt={g.title} className="h-44 w-full" />
                  {g.hasVideo && <PlayBadge />}
                  {g.category && <span className="absolute start-2 top-2 rounded-full bg-black/55 px-2.5 py-0.5 text-[11px] font-semibold text-white">{t(`gl.cat.${g.category}`)}</span>}
                </div>
                <div className="p-4">
                  <h2 className="line-clamp-2 font-bold group-hover:text-primary">{g.title}</h2>
                  <p className="mt-1 text-xs text-gray-500">{[g.hasImages && `${fmtNum(lang, g.images.length)} ${t('pub.photos')}`, g.hasVideo && t('gl.video')].filter(Boolean).join(' • ')}</p>
                </div>
              </Link>
              <ItemActions onEdit={mayEdit ? () => setDialog({ id: g.id }) : undefined} onDelete={mayDelete ? () => setAsk(g) : undefined} />
              </div>
            ))}
          </div>
          <Pager page={page} totalPages={data.meta.totalPages} onPage={goPage} />
        </>
      )}
    </div>
  );
}
