'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDay, fmtNum } from '@/lib/utils';
import { Center, Spinner, inputCls } from '@/components/ui/ui';
import { WomenCalendar, type CalItem } from '@/components/women/women-calendar';
import { Thumb } from './cards';
import { Pager } from './pager';
import { EVENTS_PER_PAGE, EventsManageBar, PublicEvent, participationLabel, timeRange } from './events-hub';

interface Result { data: PublicEvent[]; meta: { totalPages: number; total?: number } }
type Scope = 'agenda' | 'upcoming' | 'current';

const damascusToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Damascus' });

/** One agenda entry: picture with a date badge, status, then time, place, organizer, target audience, registration and details. */
function AgendaCard({ e }: { e: PublicEvent }) {
  const { lang, href } = useI18n();
  const ar = lang === 'ar';
  const link = href(`/occasions/view?id=${e.id}`);
  const when = `${fmtDay(lang, e.date)}${e.finishDate !== e.date ? ` — ${fmtDay(lang, e.finishDate)}` : ''}`;
  const time = timeRange(e);
  const month = new Intl.DateTimeFormat(ar ? 'ar' : 'en', { month: 'short', timeZone: 'UTC' }).format(new Date(`${e.date}T00:00:00Z`));
  const part = participationLabel(e.participation, ar);
  const rows: [string, string, React.ReactNode][] = [
    ['📅', ar ? 'التاريخ' : 'Date', when],
    ['🕒', ar ? 'الوقت' : 'Time', time ? <bdi dir="ltr">{time}</bdi> : ''],
    ['📍', ar ? 'المكان' : 'Place', e.location],
    ['🏛', ar ? 'الجهة المنظمة' : 'Organizer', e.organizer],
    ['👥', ar ? 'الفئة المستهدفة' : 'Target audience', e.audience],
  ];
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link href={link} className="relative block" aria-label={e.title}>
        <Thumb src={e.images[0]} alt={e.title} className="h-40 w-full" />
        <span className="absolute start-3 top-3 flex w-12 flex-col items-center rounded-xl bg-white py-1 text-center shadow-card ring-1 ring-line" aria-hidden="true">
          <b className="text-lg font-extrabold leading-tight text-primary">{fmtNum(lang, Number(e.date.slice(8, 10)))}</b>
          <span className="text-[10px] font-bold uppercase text-secondary">{month}</span>
        </span>
        {e.status === 'current' && <span className="absolute end-3 top-3 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow">{ar ? 'جارٍ الآن' : 'Happening now'}</span>}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${e.type === 'exhibition' ? 'bg-accent/25 text-secondary' : 'bg-primary/10 text-primary'}`}>{e.type === 'exhibition' ? (ar ? 'معرض' : 'Exhibition') : (ar ? 'مناسبة' : 'Occasion')}</span>
          {part && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-700">{part}</span>}
        </div>
        <h3 className="mt-2 line-clamp-2 text-base font-extrabold text-secondary"><Link href={link} className="hover:text-primary">{e.title}</Link></h3>
        <dl className="mt-3 space-y-1.5 text-xs text-gray-600">
          {rows.filter(([, , v]) => v).map(([icon, k, v]) => (
            <div key={k} className="flex gap-2"><dt className="shrink-0" aria-hidden="true">{icon}</dt><dd className="min-w-0"><span className="sr-only">{k}: </span><span className="font-semibold text-secondary">{v}</span></dd></div>
          ))}
        </dl>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {e.registrationUrl
            ? <a href={e.registrationUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-white transition hover:brightness-110">{ar ? 'سجّل الآن' : 'Register'}</a>
            : e.registrationNote && <span className="text-xs text-gray-600"><b>{ar ? 'التسجيل: ' : 'Registration: '}</b>{e.registrationNote}</span>}
          <Link href={link} className="rounded-lg border border-line px-4 py-1.5 text-sm font-semibold text-primary hover:bg-gray-50">{ar ? 'التفاصيل' : 'Details'}</Link>
        </div>
      </div>
    </article>
  );
}

function Agenda() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [scope, setScope] = useState<Scope>('agenda');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [cal, setCal] = useState<CalItem[]>([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { const h = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(h); }, [q]);
  useEffect(() => { setPage(1); }, [debounced, day, lang, scope]);
  // the calendar marks the days of every upcoming / current event, loaded 50 at a time
  useEffect(() => {
    let live = true;
    (async () => {
      const all: PublicEvent[] = [];
      for (let p = 1; p <= 8; p++) {
        const r = await api<Result>('/public/occasions', { params: { lang, scope: 'agenda', page: p, limit: 50 }, cache: 'no-store' }).catch(() => null);
        if (!r) break;
        all.push(...r.data);
        if (p >= r.meta.totalPages) break;
      }
      if (live) setCal(all.map((e) => ({ id: e.id, start: e.date, end: e.finishDate || e.date, live: true })));
    })();
    return () => { live = false; };
  }, [lang]);
  useEffect(() => {
    let live = true;
    setData(null); setError('');
    api<Result>('/public/occasions', { params: { lang, scope, day: day || undefined, q: debounced || undefined, page, limit: EVENTS_PER_PAGE }, cache: 'no-store' })
      .then((r) => { if (live) setData(r); })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [lang, debounced, day, page, scope]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <EventsManageBar />
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-secondary">{ar ? 'أجندة الغرفة' : 'Chamber agenda'}</h1>
        <p className="mt-1 text-sm text-gray-600">{ar ? 'الفعاليات القادمة للغرفة: الموعد والمكان والجهة المنظمة والفئة المستهدفة وطريقة التسجيل.' : 'The Chamber’s upcoming events: date, place, organizer, target audience and how to register.'}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0">
          {/* one row: the status tabs and the search */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label={ar ? 'الحالة' : 'Status'} className="flex shrink-0 gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-line">
              {([['agenda', ar ? 'الكل' : 'All'], ['upcoming', ar ? 'القادمة' : 'Upcoming'], ['current', ar ? 'الحالية' : 'Current']] as [Scope, string][]).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={scope === k} onClick={() => setScope(k)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${scope === k ? 'bg-secondary text-white' : 'text-secondary hover:bg-gray-100'}`}>{l}</button>
              ))}
            </div>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'ابحث باسم الفعالية أو الجهة أو المكان …' : 'Search by name, organizer or place …'} aria-label={ar ? 'بحث' : 'Search'} className={`${inputCls} !w-auto min-w-48 flex-1`} />
          </div>
          {day && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-primary/10 px-4 py-2.5 text-sm ring-1 ring-primary/20">
              <span className="font-semibold text-secondary">{ar ? 'الفعاليات في' : 'Events on'} {fmtDay(lang, day)}{data ? ` (${data.meta.total ?? data.data.length})` : ''}</span>
              <button type="button" onClick={() => setDay(null)} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary ring-1 ring-line transition hover:ring-accent">✕ {ar ? 'إزالة اليوم' : 'Clear day'}</button>
            </div>
          )}
          {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {!data && !error ? <Center><Spinner /></Center> : data && (
            data.data.length === 0
              ? <Center>{ar ? 'لا توجد فعاليات قادمة' : 'No upcoming events'}</Center>
              : <>
                <ul className="grid gap-5 sm:grid-cols-2">{data.data.map((e) => <li key={e.id}><AgendaCard e={e} /></li>)}</ul>
                <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />
              </>
          )}
        </div>
        <aside className="order-first lg:sticky lg:top-24 lg:order-none"><WomenCalendar items={cal} today={damascusToday()} selected={day} onSelect={setDay} /></aside>
      </div>
    </div>
  );
}

/** Chamber agenda: the upcoming events as cards (6 per page), a calendar beside them (pick a day to see its events) and the page's manage buttons on top. */
export function AgendaPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Agenda /></Suspense>;
}
