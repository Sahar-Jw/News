'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Spinner, inputCls } from '@/components/ui/ui';
import { Card, NewsCard, Thumb } from '@/components/site/cards';
import { CourseRegister } from '@/components/site/course-register';
import { Pager } from '@/components/site/pager';
import { useSite } from '@/components/site/site-context';
import { COURSE_KINDS, PublicCourse, courseFacts } from '@/components/site/training-shared';
import { IconTile } from '@/components/site/pro-icon';
import { NewsFormDialog } from '@/components/admin/news-form';
import { newsCategoryLabel } from '@/lib/news-categories';
import { useNewsSaved } from '@/lib/news-events';
import { ManageBtn, ManageLink, PageManageBar } from '@/components/site/page-manage-bar';
import { CoursesAdmin } from '@/components/admin/courses-admin';
import { TrainersAdmin } from '@/components/admin/trainers-admin';

type Tab = 'current' | 'archive' | 'news';
interface Paged<T> { data: T[]; meta: { totalPages: number; total: number } }
interface Filters { years: number[]; fields: string[]; kinds: string[]; trainers: { id: number; name: string }[] }

const BADGE: Record<string, string> = { open: 'bg-emerald-50 text-emerald-700', full: 'bg-amber-50 text-amber-700', closed: 'bg-gray-100 text-gray-600', ended: 'bg-gray-100 text-gray-600' };

/** Administrative Training Center (wireframe page 9): current courses, archive (search by year/field/trainer/type) and center news. */
export default function TrainingPage() {
  const { lang, t, href } = useI18n();
  const { loc } = useSite();
  const { can } = useAuth();
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
  const [quickAdd, setQuickAdd] = useState<'course' | 'trainer' | null>(null);
  const [adding, setAdding] = useState(false);
  const [newsTick, setNewsTick] = useState(0);
  useNewsSaved(() => setNewsTick((n) => n + 1));

  const newsTopic = loc('training', 'news_topic');

  // the search boxes (year / field / trainer / type) are filled from what exists in the courses of the open tab
  useEffect(() => {
    if (tab === 'news') return;
    api<Filters>('/public/training/filters', { params: { lang, scope: tab }, cache: 'no-store' }).then(setFilters).catch(() => setFilters(null));
  }, [lang, tab, reload]);

  useEffect(() => {
    if (tab === 'news') return;
    setData(null);
    api<Paged<PublicCourse>>('/public/training/courses', { params: { lang, scope: tab, page, limit: 12, q: q.trim(), year, field, trainerId, kind }, cache: 'no-store' })
      .then(setData).catch(() => setData({ data: [], meta: { totalPages: 1, total: 0 } }));
  }, [tab, lang, page, q, year, field, trainerId, kind, reload]);

  useEffect(() => {
    if (tab !== 'news') return;
    setNews(null);
    // the center's own news: everything filed under the Training Center News category, plus anything tagged with the page's topic
    const calls = [api<Paged<Card>>('/public/news', { params: { lang, category: newsCategoryLabel('training', lang), limit: 9 }, cache: 'no-store' })];
    if (newsTopic) calls.push(api<Paged<Card>>('/public/news', { params: { lang, topics: newsTopic, limit: 9 }, cache: 'no-store' }));
    Promise.all(calls.map((c) => c.catch(() => null))).then((res) => {
      const seen = new Set<number>();
      const rows = res.flatMap((r) => r?.data ?? []).filter((n) => !seen.has(n.id) && !!seen.add(n.id));
      rows.sort((a, b) => String(b.publishAt ?? '').localeCompare(String(a.publishAt ?? '')) || b.id - a.id);
      setNews({ data: rows.slice(0, 9), meta: { totalPages: 1, total: rows.length } });
    });
  }, [tab, lang, newsTopic, newsTick]);

  const switchTab = useCallback((x: Tab) => { setTab(x); setPage(1); setFilters(null); setQ(''); setYear(''); setField(''); setTrainerId(''); setKind(''); }, []);
  const filtered = !!(q.trim() || year || field || trainerId || kind);
  const clear = () => { setQ(''); setYear(''); setField(''); setTrainerId(''); setKind(''); setPage(1); };
  const setF = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { fn(e.target.value); setPage(1); };

  const mayCourses = can('courses.read'), mayRegistrations = can('registrations.read'), maySettings = can('settings.read');
  const tabCls = (x: Tab) => `rounded-full px-5 py-2.5 text-sm font-bold transition ${tab === x ? 'bg-secondary text-white' : 'bg-primary/10 text-secondary hover:bg-primary/20'}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold text-secondary md:text-3xl">{t('tr.title')}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">{t('tr.subtitle')}</p>
        <div className="mt-4"><Link href={href('/training/trainer-apply')} className="inline-block rounded-full border border-primary/30 bg-white px-5 py-2 text-sm font-bold text-primary shadow-sm transition hover:bg-primary/5">{t('tr.becomeTrainer')}</Link></div>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
      </header>

      {/* manager tools (hidden from visitors): every button opens the matching tab of the Training entry in Settings, and only for people holding its permission */}
      <PageManageBar show={mayCourses || mayRegistrations || maySettings}>
        {can('courses.create') && <ManageBtn onClick={() => setQuickAdd('course')}>＋ {t('mg.addCourse')}</ManageBtn>}
        {mayCourses && <ManageLink to="/admin/settings?page=training&tab=courses">{t('mg.courses')}</ManageLink>}
        {can('courses.create') && <ManageBtn tone="ghost" onClick={() => setQuickAdd('trainer')}>＋ {t('mg.addTrainer')}</ManageBtn>}
        {mayCourses && <ManageLink to="/admin/settings?page=training&tab=trainers">{t('mg.trainers')}</ManageLink>}
        {mayRegistrations && <ManageLink to="/admin/settings?page=training&tab=trainees">{t('mg.trainees')}</ManageLink>}
        {mayRegistrations && <ManageLink to="/admin/settings?page=training&tab=trainerApps">{t('mg.trainerApps')}</ManageLink>}
        {maySettings && <ManageLink to="/admin/settings?page=training&tab=settings">⚙ {t('mg.pageTexts')}</ManageLink>}
      </PageManageBar>
      {/* the add forms open right here, as windows */}
      {quickAdd === 'course' && <CoursesAdmin quick={{ onClose: () => setQuickAdd(null), onSaved: () => setReload((n) => n + 1) }} />}
      {quickAdd === 'trainer' && <TrainersAdmin quick={{ onClose: () => setQuickAdd(null), onSaved: () => setReload((n) => n + 1) }} />}

      <div className="flex flex-wrap gap-2" role="tablist">
        {(['current', 'archive', 'news'] as Tab[]).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x} className={tabCls(x)} onClick={() => switchTab(x)}>{t(x === 'current' ? 'tr.tabCurrent' : x === 'archive' ? 'tr.tabArchive' : 'tr.tabNews')}</button>
        ))}
      </div>

      {tab !== 'news' && (
        <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line sm:grid-cols-2 lg:grid-cols-5">
          <input type="search" className={`${inputCls} sm:col-span-2 lg:col-span-5`} maxLength={100} value={q} onChange={setF(setQ)} placeholder={t('tr.searchPh')} aria-label={t('tr.searchPh')} />
          <select className={inputCls} value={year} onChange={setF(setYear)} aria-label={t('tr.year')}><option value="">{t('tr.allYears')}</option>{filters?.years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          <select className={inputCls} value={field} onChange={setF(setField)} aria-label={t('tr.field')}><option value="">{t('tr.allFields')}</option>{filters?.fields.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <select className={inputCls} value={trainerId} onChange={setF(setTrainerId)} aria-label={t('tr.trainer')}><option value="">{t('tr.allTrainers')}</option>{filters?.trainers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select className={inputCls} value={kind} onChange={setF(setKind)} aria-label={t('tr.kind')}><option value="">{t('tr.allKinds')}</option>{COURSE_KINDS.filter((k) => !filters || filters.kinds.includes(k)).map((k) => <option key={k} value={k}>{t(`tr.kind.${k}`)}</option>)}</select>
          {filtered && <Button type="button" variant="outline" onClick={clear}>{t('os.clear')}</Button>}
        </div>
      )}

      {tab === 'news' && can('news.create') && (
        <div><button type="button" onClick={() => setAdding(true)} className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-white hover:brightness-110">＋ {t('md.addNews')}</button></div>
      )}
      {adding && <NewsFormDialog category="training" onClose={() => setAdding(false)} />}

      {tab === 'news' ? (
        !news ? <Center><Spinner /></Center> : news.data.length === 0 ? <Center>{t('tr.noNews')}</Center> : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{news.data.map((n) => <NewsCard key={n.id} n={n} />)}</div>
            <div className="text-center"><Link href={href(`/media?topics=${encodeURIComponent(newsTopic)}`)} className="text-sm font-semibold text-primary hover:underline">{t('tr.moreNews')}</Link></div>
          </>
        )
      ) : !data ? <Center><Spinner /></Center> : data.data.length === 0 ? <Center>{t(tab === 'current' ? 'tr.noCurrent' : 'tr.noArchive')}</Center> : (
        <>
          <div className="space-y-4">
            {data.data.map((c) => {
              const facts = courseFacts(c, t, lang);
              return (
                <article key={c.id} className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line sm:flex">
                  {/* the picture is on the start side (right in Arabic), everything else beside it */}
                  <Link href={href(`/training/${c.id}`)} className="block shrink-0 bg-gray-100 sm:w-60 md:w-72" aria-label={c.name} tabIndex={-1}>
                    <Thumb src={c.imageUrl} alt="" className="h-48 w-full sm:h-full sm:min-h-[15rem]" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{t(`tr.kind.${c.kind}`)}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${BADGE[c.status]}`}>{t(`tr.status.${c.status}`)}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-extrabold leading-snug text-secondary md:text-xl"><Link href={href(`/training/${c.id}`)} className="hover:text-primary">{c.name}</Link></h2>
                    {facts.length > 0 && (
                      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                        {facts.map((f) => (
                          <div key={f.label} className="flex min-w-0 items-start gap-2.5">
                            <IconTile name={f.icon} size={16} className="h-8 w-8 !rounded-lg" />
                            <div className="min-w-0"><dt className="text-xs font-semibold text-gray-500">{f.label}</dt><dd className="break-words text-sm font-bold leading-6 text-secondary">{f.value}</dd></div>
                          </div>
                        ))}
                      </dl>
                    )}
                    <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-5">
                      <Link href={href(`/training/${c.id}`)} className="rounded-full border border-primary/30 bg-white px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/5">{t('tr.viewCourse')}</Link>
                      {c.status === 'open' && <Button type="button" onClick={() => setReg(c)}>{t('tr.registerNow')}</Button>}
                    </div>
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
