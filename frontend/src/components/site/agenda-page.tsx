'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Center, Spinner, inputCls } from '@/components/ui/ui';
import { EventsCalendar, PublicEvent, timeRange } from './events-hub';

interface Result { data: PublicEvent[]; meta: { totalPages: number; total?: number } }

/** One agenda entry: name, date, time, place, organizer, target audience, registration and details. */
function AgendaCard({ e }: { e: PublicEvent }) {
  const { lang, href } = useI18n();
  const ar = lang === 'ar';
  const when = `${fmtDay(lang, e.date)}${e.finishDate !== e.date ? ` — ${fmtDay(lang, e.finishDate)}` : ''}`;
  const time = timeRange(e);
  const rows: [string, React.ReactNode][] = [
    [ar ? 'التاريخ' : 'Date', when],
    [ar ? 'الوقت' : 'Time', time ? <bdi dir="ltr">{time}</bdi> : ''],
    [ar ? 'المكان' : 'Place', e.location],
    [ar ? 'الجهة المنظمة' : 'Organizer', e.organizer],
    [ar ? 'الفئة المستهدفة' : 'Target audience', e.audience],
  ];
  return (
    <article className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-extrabold text-secondary"><Link href={href(`/occasions/view?id=${e.id}`)} className="hover:text-primary">{e.title}</Link></h3>
        {e.status === 'current' && <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">{ar ? 'جارٍ الآن' : 'Happening now'}</span>}
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="inline font-semibold text-gray-500">{k}: </dt><dd className="inline font-semibold text-secondary">{v}</dd></div>)}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {e.registrationUrl
          ? <a href={e.registrationUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-110">{ar ? 'سجّل الآن' : 'Register'}</a>
          : e.registrationNote && <span className="text-sm text-gray-600"><b>{ar ? 'التسجيل: ' : 'Registration: '}</b>{e.registrationNote}</span>}
        <Link href={href(`/occasions/view?id=${e.id}`)} className="rounded-lg border border-line px-4 py-1.5 text-sm font-semibold text-primary hover:bg-gray-50">{ar ? 'التفاصيل' : 'Details'}</Link>
      </div>
    </article>
  );
}

function UpcomingList() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { const h = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(h); }, [q]);
  useEffect(() => { setPage(1); }, [debounced, lang]);
  useEffect(() => {
    let live = true;
    setData(null); setError('');
    api<Result>('/public/occasions', { params: { lang, scope: 'agenda', q: debounced || undefined, page, limit: 10 }, cache: 'no-store' })
      .then((r) => { if (live) setData(r); })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [lang, debounced, page]);

  return (
    <div>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'ابحث باسم الفعالية أو الجهة أو المكان …' : 'Search by name, organizer or place …'} aria-label={ar ? 'بحث' : 'Search'} className={`${inputCls} mb-5`} />
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!data && !error ? <Center><Spinner /></Center> : data && (
        data.data.length === 0
          ? <Center>{ar ? 'لا توجد فعاليات قادمة' : 'No upcoming events'}</Center>
          : <>
            <ul className="space-y-4">{data.data.map((e) => <li key={e.id}><AgendaCard e={e} /></li>)}</ul>
            {data.meta.totalPages > 1 && (
              <div className="mt-5 flex justify-center gap-3">
                <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-line px-3 py-2 disabled:opacity-40">{ar ? 'السابق' : 'Previous'}</button>
                <span className="self-center text-sm">{page} / {data.meta.totalPages}</span>
                <button type="button" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-line px-3 py-2 disabled:opacity-40">{ar ? 'التالي' : 'Next'}</button>
              </div>
            )}
          </>
      )}
    </div>
  );
}

function Agenda() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [tab, setTab] = useState<'list' | 'calendar'>('list');
  const tabs: ['list' | 'calendar', string][] = [['list', ar ? 'الفعاليات القادمة' : 'Upcoming events'], ['calendar', ar ? 'التقويم الشهري' : 'Monthly calendar']];
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-secondary">{ar ? 'أجندة الغرفة' : 'Chamber agenda'}</h1>
        <p className="mt-1 text-sm text-gray-600">{ar ? 'الفعاليات القادمة للغرفة: الموعد والمكان والجهة المنظمة والفئة المستهدفة وطريقة التسجيل.' : 'The Chamber’s upcoming events: date, place, organizer, target audience and how to register.'}</p>
      </header>
      <div role="tablist" aria-label={ar ? 'الأقسام' : 'Sections'} className="mb-6 flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`rounded-full px-5 py-2 text-sm font-bold transition ${tab === k ? 'bg-primary text-white shadow' : 'bg-white text-secondary ring-1 ring-line hover:text-primary'}`}>{l}</button>
        ))}
      </div>
      {tab === 'list' ? <UpcomingList /> : <EventsCalendar card={(e) => <AgendaCard e={e} />} />}
    </div>
  );
}

/** Chamber agenda: the upcoming events as a searchable list, and an interactive monthly calendar (pick a day to see its events). */
export function AgendaPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Agenda /></Suspense>;
}
