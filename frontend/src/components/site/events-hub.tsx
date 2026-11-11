'use client';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Center, Spinner, inputCls } from '@/components/ui/ui';
import { Thumb } from './cards';
import { CategoryNews } from '@/components/site/category-news';

export type EventTab = 'exhibitions' | 'occasions' | 'calendar';
export type EventStatus = 'upcoming' | 'current' | 'previous';
export interface PublicEvent {
  id: number; title: string; date: string; finishDate: string; type: 'occasion' | 'exhibition'; status: EventStatus; isUpcoming: boolean;
  sector: string; organizer: string; location: string; participation: '' | 'organized' | 'participating'; images: string[];
  startTime: string; endTime: string; audience: string; registrationUrl: string; registrationNote: string;
}
interface Result { data: PublicEvent[]; meta: { totalPages: number; total?: number } }
interface Facets { sectors: string[]; organizers: string[]; years: string[] }

const TABS: EventTab[] = ['exhibitions', 'occasions', 'calendar'];
const STATUSES: EventStatus[] = ['upcoming', 'current', 'previous'];
const LABEL = {
  exhibitions: ['المعارض', 'Exhibitions'], occasions: ['المناسبات', 'Occasions'], calendar: ['التقويم', 'Calendar'],
  upcoming: ['القادمة', 'Upcoming'], current: ['الحالية', 'Current'], previous: ['السابقة', 'Previous'],
} as const;

/** "10:00 – 12:00", "10:00", or '' */
export const timeRange = (e: { startTime: string; endTime: string }) => (e.startTime && e.endTime ? `${e.startTime} – ${e.endTime}` : e.startTime || '');

export const participationLabel = (p: string, ar: boolean) => p === 'organized' ? (ar ? 'تنظمها الغرفة' : 'Organized by the Chamber') : p === 'participating' ? (ar ? 'تشارك فيها الغرفة' : 'Chamber participates') : '';

const damascusMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Damascus' }).slice(0, 7);
const damascusToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Damascus' });
const offsetMonth = (month: string, delta: number) => {
  const [year, value] = month.split('-').map(Number);
  return new Date(Date.UTC(year, value - 1 + delta, 1)).toISOString().slice(0, 7);
};
const monthDays = (month: string) => {
  const [year, value] = month.split('-').map(Number);
  const leading = new Date(Date.UTC(year, value - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((leading + count) / 7) * 7 }, (_, i) => {
    const day = i - leading + 1;
    return day > 0 && day <= count ? `${month}-${String(day).padStart(2, '0')}` : '';
  });
};

/** One event card (used by the lists, the calendar's day panel and the related-events block of a detail page). */
export function EventCard({ event }: { event: PublicEvent }) {
  const { lang, href } = useI18n();
  const ar = lang === 'ar';
  const part = participationLabel(event.participation, ar);
  return (
    <Link href={href(`/occasions/view?id=${event.id}`)} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg">
      <Thumb src={event.images[0]} alt={event.title} className="h-40 w-full" />
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold text-primary">{fmtDay(lang, event.date)}{event.finishDate !== event.date ? ` — ${fmtDay(lang, event.finishDate)}` : ''}{timeRange(event) && <span dir="ltr" className="ms-2 text-gray-500">{timeRange(event)}</span>}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${event.type === 'exhibition' ? 'bg-accent/25 text-secondary' : 'bg-primary/10 text-primary'}`}>{event.type === 'exhibition' ? (ar ? 'معرض' : 'Exhibition') : (ar ? 'مناسبة' : 'Occasion')}</span>
          {part && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-700">{part}</span>}
        </div>
        <h3 className="mt-2 line-clamp-2 font-bold group-hover:text-primary">{event.title}</h3>
        {(event.sector || event.organizer || event.location) && (
          <dl className="mt-2 space-y-0.5 text-xs text-gray-600">
            {event.sector && <div><dt className="inline font-semibold">{ar ? 'القطاع: ' : 'Sector: '}</dt><dd className="inline">{event.sector}</dd></div>}
            {event.organizer && <div><dt className="inline font-semibold">{ar ? 'الجهة المنظمة: ' : 'Organizer: '}</dt><dd className="inline">{event.organizer}</dd></div>}
            {event.location && <div><dt className="inline font-semibold">{ar ? 'المكان: ' : 'Place: '}</dt><dd className="inline">{event.location}</dd></div>}
          </dl>
        )}
      </div>
    </Link>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const { t } = useI18n();
  if (pages <= 1) return null;
  return (
    <div className="mt-5 flex justify-center gap-3">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-line px-3 py-2 disabled:opacity-40">{t('tbl.first')}</button>
      <span className="self-center text-sm">{page} / {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border border-line px-3 py-2 disabled:opacity-40">{t('tbl.last')}</button>
    </div>
  );
}

/** Exhibitions or occasions: status tabs (upcoming / current / previous = archive), filters by name, date, sector, organizer, participation. */
function EventList({ type, initialStatus }: { type: 'exhibition' | 'occasion'; initialStatus: EventStatus }) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [status, setStatus] = useState<EventStatus>(initialStatus);
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [participation, setParticipation] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(1);
  const [facets, setFacets] = useState<Facets>({ sectors: [], organizers: [], years: [] });
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => { const h = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(h); }, [q]);
  useEffect(() => { setPage(1); }, [status, debounced, sector, organizer, participation, year, lang]);
  useEffect(() => {
    api<Facets>('/public/occasions/facets', { params: { type, lang }, cache: 'no-store' }).then(setFacets).catch(() => setFacets({ sectors: [], organizers: [], years: [] }));
  }, [type, lang]);
  useEffect(() => {
    let live = true;
    setData(null); setError('');
    api<Result>('/public/occasions', { params: { lang, type, scope: status, q: debounced || undefined, sector: sector || undefined, organizer: organizer || undefined, participation: participation || undefined, year: year || undefined, page, limit: 12 }, cache: 'no-store' })
      .then((r) => { if (live) setData(r); })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [lang, type, status, debounced, sector, organizer, participation, year, page]);

  const filtered = !!(debounced || sector || organizer || participation || year);
  const reset = () => { setQ(''); setSector(''); setOrganizer(''); setParticipation(''); setYear(''); };
  const statusLabel = (s: EventStatus) => s === 'previous' && type === 'exhibition' ? (ar ? 'أرشيف المعارض' : 'Exhibitions archive') : LABEL[s][ar ? 0 : 1];
  const sel = `${inputCls} !w-auto min-w-36`;

  return (
    <div>
      <div role="tablist" aria-label={ar ? 'الحالة' : 'Status'} className="mb-4 flex flex-wrap gap-2 border-b border-line pb-3">
        {STATUSES.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${status === s ? 'bg-secondary text-white' : 'text-secondary hover:bg-gray-100'}`}>{statusLabel(s)}</button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-end gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'ابحث باسم المعرض أو القطاع أو الجهة …' : 'Search by name, sector or organizer …'} aria-label={ar ? 'بحث' : 'Search'} className={`${inputCls} !w-auto min-w-56 flex-1`} />
        {facets.sectors.length > 0 && <select aria-label={ar ? 'القطاع' : 'Sector'} className={sel} value={sector} onChange={(e) => setSector(e.target.value)}><option value="">{ar ? 'كل القطاعات' : 'All sectors'}</option>{facets.sectors.map((s) => <option key={s} value={s}>{s}</option>)}</select>}
        {facets.organizers.length > 0 && <select aria-label={ar ? 'الجهة المنظمة' : 'Organizer'} className={sel} value={organizer} onChange={(e) => setOrganizer(e.target.value)}><option value="">{ar ? 'كل الجهات المنظمة' : 'All organizers'}</option>{facets.organizers.map((s) => <option key={s} value={s}>{s}</option>)}</select>}
        {type === 'exhibition' && <select aria-label={ar ? 'نوع المشاركة' : 'Participation'} className={sel} value={participation} onChange={(e) => setParticipation(e.target.value)}><option value="">{ar ? 'كل أنواع المشاركة' : 'All participation types'}</option><option value="organized">{participationLabel('organized', ar)}</option><option value="participating">{participationLabel('participating', ar)}</option></select>}
        {facets.years.length > 0 && <select aria-label={ar ? 'السنة' : 'Year'} className={sel} value={year} onChange={(e) => setYear(e.target.value)}><option value="">{ar ? 'كل السنوات' : 'All years'}</option>{facets.years.map((y) => <option key={y} value={y}>{y}</option>)}</select>}
        {filtered && <button type="button" onClick={reset} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-primary hover:bg-gray-50">{ar ? 'مسح التصفية' : 'Clear filters'}</button>}
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!data && !error ? <Center><Spinner /></Center> : data && (
        data.data.length === 0
          ? <Center>{type === 'exhibition' ? (ar ? 'لا توجد معارض' : 'No exhibitions found') : (ar ? 'لا توجد مناسبات' : 'No occasions found')}</Center>
          : <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.data.map((e) => <li key={e.id} className="flex"><div className="flex w-full flex-col [&>a]:flex-1"><EventCard event={e} /></div></li>)}</ul>
            <Pager page={page} pages={data.meta.totalPages} onPage={setPage} />
          </>
      )}
    </div>
  );
}

/** Interactive month calendar of exhibitions and occasions: pick a day to list its events, filter by kind, jump to today. */
export function EventsCalendar({ card }: { card?: (e: PublicEvent) => React.ReactNode } = {}) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const today = damascusToday();
  const [month, setMonth] = useState(damascusMonth());
  const [kind, setKind] = useState<'' | 'exhibition' | 'occasion'>('');
  const [selected, setSelected] = useState(today);
  const [data, setData] = useState<PublicEvent[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setData(null); setError('');
    api<Result>('/public/occasions', { params: { lang, scope: 'all', month, type: kind || undefined, page: 1, limit: 50 }, cache: 'no-store' })
      .then((r) => { if (live) setData(r.data); })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [lang, month, kind]);

  const days = useMemo(() => monthDays(month), [month]);
  const byDay = useMemo(() => {
    const m = new Map<string, PublicEvent[]>();
    for (const e of data ?? []) for (const d of days) if (d && d >= e.date && d <= e.finishDate) m.set(d, [...(m.get(d) ?? []), e]);
    return m;
  }, [data, days]);
  const chosen = byDay.get(selected) ?? [];
  const weekDays = ar ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const go = (m: string) => { setMonth(m); setSelected(m === today.slice(0, 7) ? today : `${m}-01`); };
  const dot = (e: PublicEvent) => e.type === 'exhibition' ? 'bg-accent' : 'bg-primary';
  const kinds: ['' | 'exhibition' | 'occasion', string][] = [['', ar ? 'الكل' : 'All'], ['exhibition', ar ? 'المعارض' : 'Exhibitions'], ['occasion', ar ? 'المناسبات' : 'Occasions']];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(offsetMonth(month, -1))} aria-label={ar ? 'الشهر السابق' : 'Previous month'} className="rounded-lg border border-line bg-white px-3 py-2 font-bold hover:text-primary">{ar ? '›' : '‹'}</button>
          <h2 className="min-w-40 text-center text-lg font-bold text-secondary" aria-live="polite">{new Intl.DateTimeFormat(ar ? 'ar' : 'en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))}</h2>
          <button type="button" onClick={() => go(offsetMonth(month, 1))} aria-label={ar ? 'الشهر التالي' : 'Next month'} className="rounded-lg border border-line bg-white px-3 py-2 font-bold hover:text-primary">{ar ? '‹' : '›'}</button>
          <button type="button" onClick={() => go(damascusMonth())} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold hover:text-primary">{ar ? 'اليوم' : 'Today'}</button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5" role="group" aria-label={ar ? 'نوع الحدث' : 'Event type'}>
            {kinds.map(([v, l]) => <button key={v} type="button" aria-pressed={kind === v} onClick={() => setKind(v)} className={`rounded-full px-3 py-1 text-xs font-bold ${kind === v ? 'bg-primary text-white' : 'bg-white text-secondary ring-1 ring-line'}`}>{l}</button>)}
          </div>
          <p className="flex items-center gap-3 text-xs text-gray-600" aria-hidden="true"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-accent" />{ar ? 'معرض' : 'Exhibition'}</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-primary" />{ar ? 'مناسبة' : 'Occasion'}</span></p>
        </div>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className={`overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line ${data ? '' : 'opacity-60'}`} aria-busy={!data}>
        <div className="grid grid-cols-7 border-b border-line bg-gray-50 text-center text-xs font-bold text-gray-600">
          {weekDays.map((d) => <div key={d} className="px-1 py-2"><span className="sm:hidden">{ar ? d.slice(0, 3) : d.slice(0, 1)}</span><span className="hidden sm:inline">{d}</span></div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((date, i) => {
            const events = date ? byDay.get(date) ?? [] : [];
            const on = date === selected;
            return (
              <button key={`${date || 'x'}-${i}`} type="button" disabled={!date} onClick={() => setSelected(date)} aria-pressed={on}
                aria-label={date ? `${fmtDay(lang, date)}${events.length ? `: ${events.map((e) => e.title).join(', ')}` : ''}` : undefined}
                className={`min-h-14 border-b border-e border-line p-1 text-start align-top transition sm:min-h-24 sm:p-1.5 ${date ? 'hover:bg-primary/5' : 'bg-gray-50/60'} ${on ? 'bg-primary/10 ring-2 ring-inset ring-primary' : ''}`}>
                {date && <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold ${date === today ? 'bg-primary text-white' : events.length ? 'text-primary' : 'text-gray-500'}`}>{Number(date.slice(-2))}</span>}
                {events.length > 0 && (
                  <>
                    <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">{events.slice(0, 4).map((e) => <i key={e.id} className={`h-1.5 w-1.5 rounded-full ${dot(e)}`} />)}</span>
                    <span className="mt-1 hidden space-y-0.5 sm:block" aria-hidden="true">
                      {events.slice(0, 2).map((e) => <span key={e.id} className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] font-semibold ${e.type === 'exhibition' ? 'bg-accent/25 text-secondary' : 'bg-primary/10 text-primary'}`}><i className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot(e)}`} /><span className="truncate">{e.title}</span></span>)}
                      {events.length > 2 && <span className="block px-1 text-[10px] text-gray-500">+{events.length - 2}</span>}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <section className="mt-6" aria-live="polite">
        <h3 className="mb-3 text-lg font-bold text-secondary">{fmtDay(lang, selected)}</h3>
        {!data ? <Center><Spinner /></Center> : chosen.length === 0
          ? <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-gray-500 ring-1 ring-line">{ar ? 'لا توجد معارض أو مناسبات في هذا اليوم' : 'No exhibitions or occasions on this day'}</p>
          : card
            ? <ul className="space-y-4">{chosen.map((e) => <li key={e.id}>{card(e)}</li>)}</ul>
            : <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{chosen.map((e) => <li key={e.id} className="flex"><div className="flex w-full flex-col [&>a]:flex-1"><EventCard event={e} /></div></li>)}</ul>}
      </section>
    </div>
  );
}

function Hub({ initialTab, initialStatus }: { initialTab: EventTab; initialStatus: EventStatus }) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const param = useSearchParams().get('tab');
  const [tab, setTab] = useState<EventTab>(TABS.includes(param as EventTab) ? (param as EventTab) : initialTab);
  const choose = (t: EventTab) => { setTab(t); try { window.history.replaceState(null, '', `?tab=${t}`); } catch { /* ignore */ } };
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold text-secondary">{ar ? 'المعارض والفعاليات' : 'Exhibitions & events'}</h1>
        <p className="mt-1 text-sm text-gray-600">{ar ? 'المعارض والمناسبات التي تنظمها الغرفة أو تشارك فيها، مع الأخبار والصور والتغطية الإعلامية.' : 'Exhibitions and occasions the Chamber organizes or takes part in, with news, photos and media coverage.'}</p>
      </header>
      <div role="tablist" aria-label={ar ? 'الأقسام' : 'Sections'} className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => choose(t)}
            className={`rounded-full px-5 py-2 text-sm font-bold transition ${tab === t ? 'bg-primary text-white shadow' : 'bg-white text-secondary ring-1 ring-line hover:text-primary'}`}>{LABEL[t][ar ? 0 : 1]}</button>
        ))}
      </div>
      {tab === 'exhibitions' && <EventList type="exhibition" initialStatus={initialStatus} />}
      {tab === 'occasions' && <EventList type="occasion" initialStatus={initialStatus} />}
      {tab === 'calendar' && <EventsCalendar />}
      <CategoryNews category="events" className="mt-10 !px-0 !pb-0" />
    </div>
  );
}

/** The exhibitions & events page: Exhibitions / Occasions / Calendar tabs (`?tab=` picks one; `initialTab` is the route's default). */
export function EventsHub({ initialTab = 'exhibitions', initialStatus = 'upcoming' }: { initialTab?: EventTab; initialStatus?: EventStatus }) {
  return <Suspense fallback={<Center><Spinner /></Center>}><Hub initialTab={initialTab} initialStatus={initialStatus} /></Suspense>;
}
