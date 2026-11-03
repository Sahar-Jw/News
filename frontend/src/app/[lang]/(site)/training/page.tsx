'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Button, Center, Spinner, inputCls } from '@/components/ui/ui';
import { Card, NewsCard, Thumb } from '@/components/site/cards';
import { CourseRegister } from '@/components/site/course-register';
import { Pager } from '@/components/site/pager';
import { useSite } from '@/components/site/site-context';
import { COURSE_KINDS, PublicCourse, courseDates } from '@/components/site/training-shared';

type Tab = 'current' | 'archive' | 'news';
interface Paged<T> { data: T[]; meta: { totalPages: number; total: number } }
interface Filters { years: number[]; fields: string[]; kinds: string[]; trainers: { id: number; name: string }[] }

const BADGE: Record<string, string> = { open: 'bg-emerald-50 text-emerald-700', full: 'bg-amber-50 text-amber-700', closed: 'bg-gray-100 text-gray-600', ended: 'bg-gray-100 text-gray-600' };

/** Administrative Training Center (wireframe page 9): current courses, archive (search by year/field/trainer/type) and center news. */
export default function TrainingPage() {
  const { lang, t, href } = useI18n();
  const { loc } = useSite();
  const [tab, setTab] = useState<Tab>('current');
  const [data, setData] = useState<Paged<PublicCourse> | null>(null);
  const [news, setNews] = useState<Paged<Card> | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [year, setYear] = useState('');
  const [field, setField] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [kind, setKind] = useState('');
  const [reg, setReg] = useState<PublicCourse | null>(null);
  const [reload, setReload] = useState(0);

  const newsTopic = loc('training', 'news_topic');

  // archive search boxes are filled from what exists in the archive
  useEffect(() => { api<Filters>('/public/training/filters', { params: { lang }, cache: 'no-store' }).then(setFilters).catch(() => setFilters(null)); }, [lang]);

  useEffect(() => {
    if (tab === 'news') return;
    setData(null);
    const archive = tab === 'archive';
    api<Paged<PublicCourse>>('/public/training/courses', { params: { lang, scope: tab, page, limit: 12, ...(archive ? { q: q.trim(), year, field, trainerId, kind } : {}) }, cache: 'no-store' })
      .then(setData).catch(() => setData({ data: [], meta: { totalPages: 1, total: 0 } }));
  }, [tab, lang, page, q, year, field, trainerId, kind, reload]);

  useEffect(() => {
    if (tab !== 'news') return;
    setNews(null);
    api<Paged<Card>>('/public/news', { params: { lang, topics: newsTopic, limit: 9 } }).then(setNews).catch(() => setNews({ data: [], meta: { totalPages: 1, total: 0 } }));
  }, [tab, lang, newsTopic]);

  const switchTab = useCallback((x: Tab) => { setTab(x); setPage(1); }, []);
  const filtered = !!(q.trim() || year || field || trainerId || kind);
  const clear = () => { setQ(''); setYear(''); setField(''); setTrainerId(''); setKind(''); setPage(1); };
  const setF = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { fn(e.target.value); setPage(1); };

  const tabCls = (x: Tab) => `rounded-full px-5 py-2.5 text-sm font-bold transition ${tab === x ? 'bg-secondary text-white' : 'bg-primary/10 text-secondary hover:bg-primary/20'}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold text-secondary md:text-3xl">{t('tr.title')}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">{t('tr.subtitle')}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist">
        {(['current', 'archive', 'news'] as Tab[]).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={tabCls(x)} onClick={() => switchTab(x)}>{t(x === 'current' ? 'tr.tabCurrent' : x === 'archive' ? 'tr.tabArchive' : 'tr.tabNews')}</button>
        ))}
      </div>

      {tab === 'archive' && (
        <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line sm:grid-cols-2 lg:grid-cols-5">
          <input type="search" className={`${inputCls} sm:col-span-2 lg:col-span-5`} maxLength={100} value={q} onChange={setF(setQ)} placeholder={t('tr.searchPh')} aria-label={t('tr.searchPh')} />
          <select className={inputCls} value={year} onChange={setF(setYear)} aria-label={t('tr.year')}><option value="">{t('tr.allYears')}</option>{filters?.years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          <select className={inputCls} value={field} onChange={setF(setField)} aria-label={t('tr.field')}><option value="">{t('tr.allFields')}</option>{filters?.fields.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <select className={inputCls} value={trainerId} onChange={setF(setTrainerId)} aria-label={t('tr.trainer')}><option value="">{t('tr.allTrainers')}</option>{filters?.trainers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select className={inputCls} value={kind} onChange={setF(setKind)} aria-label={t('tr.kind')}><option value="">{t('tr.allKinds')}</option>{COURSE_KINDS.filter((k) => !filters || filters.kinds.includes(k)).map((k) => <option key={k} value={k}>{t(`tr.kind.${k}`)}</option>)}</select>
          {filtered && <Button type="button" variant="outline" onClick={clear}>{t('os.clear')}</Button>}
        </div>
      )}

      {tab === 'news' ? (
        !news ? <Center><Spinner /></Center> : news.data.length === 0 ? <Center>{t('tr.noNews')}</Center> : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{news.data.map((n) => <NewsCard key={n.id} n={n} />)}</div>
            <div className="text-center"><Link href={href(`/news?topics=${encodeURIComponent(newsTopic)}`)} className="text-sm font-semibold text-primary hover:underline">{t('tr.moreNews')}</Link></div>
          </>
        )
      ) : !data ? <Center><Spinner /></Center> : data.data.length === 0 ? <Center>{t(tab === 'current' ? 'tr.noCurrent' : 'tr.noArchive')}</Center> : (
        <>
          <div className="space-y-4">
            {data.data.map((c) => {
              const meta: [string, string][] = ([
                [t('tr.trainer'), c.trainer?.name ?? ''], [t('tr.audience'), c.audience], [t('tr.date'), courseDates(c, (d) => fmtDay(lang, d), t('tr.fromTo'))],
                [t('tr.place'), c.location], [t('tr.hours'), c.hours != null ? String(c.hours) : ''], [t('tr.fee'), c.fee],
              ] as [string, string][]).filter(([, v]) => v);
              return (
                <article key={c.id} className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line sm:flex-row sm:items-center">
                  <Thumb src={c.imageUrl} alt="" className="h-28 w-full shrink-0 rounded-xl sm:w-36" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-extrabold text-secondary"><Link href={href(`/training/view?id=${c.id}`)} className="hover:text-primary">{c.name}</Link></h2>
                    <p className="mt-1 text-sm leading-7 text-gray-600">{meta.map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${BADGE[c.status]}`}>{t(`tr.status.${c.status}`)}</span>
                    {c.status === 'open' && <Button type="button" onClick={() => setReg(c)}>{t('tr.registerNow')}</Button>}
                  </div>
                </article>
              );
            })}
          </div>
          <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />
        </>
      )}

      <p className="rounded-2xl border border-line bg-primary/5 px-4 py-3 text-sm text-gray-700"><b>{t('tr.autoArchiveLabel')}</b> {t('tr.autoArchive')}</p>

      {reg && <CourseRegister courseId={reg.id} courseName={reg.name} open onClose={() => setReg(null)} onDone={() => setReload((n) => n + 1)} />}
    </div>
  );
}
