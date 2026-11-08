'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { Thumb } from './cards';

export type OccasionScope = 'upcoming' | 'current' | 'previous' | 'exhibitions';
export interface PublicOccasion { id: number; title: string; date: string; finishDate: string; type: 'occasion' | 'exhibition'; status: string; isUpcoming: boolean; images: string[] }
interface Result { data: PublicOccasion[]; meta: { totalPages: number } }

const damascusMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Damascus' }).slice(0, 7);
const offsetMonth = (month: string, delta: number) => {
  const [year, value] = month.split('-').map(Number);
  return new Date(Date.UTC(year, value - 1 + delta, 1)).toISOString().slice(0, 7);
};
const monthDays = (month: string) => {
  const [year, value] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, value - 1, 1));
  const count = new Date(Date.UTC(year, value, 0)).getUTCDate();
  const leading = first.getUTCDay();
  return Array.from({ length: Math.ceil((leading + count) / 7) * 7 }, (_, index) => {
    const day = index - leading + 1;
    return day > 0 && day <= count ? `${month}-${String(day).padStart(2, '0')}` : '';
  });
};

const LABELS: Record<OccasionScope, [string, string]> = {
  upcoming: ['المناسبات القادمة', 'Upcoming occasions'],
  current: ['المناسبات الحالية', 'Current occasions'],
  previous: ['المناسبات السابقة', 'Previous occasions'],
  exhibitions: ['المعارض', 'Exhibitions'],
};

/** Bilingual month calendar and event cards, backed by the unified news content endpoint. */
export function OccasionsList({ scope }: { scope: OccasionScope }) {
  const { lang, t, href } = useI18n();
  const [month, setMonth] = useState(() => scope === 'previous' ? offsetMonth(damascusMonth(), -1) : damascusMonth());
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const ar = lang === 'ar';

  useEffect(() => {
    setPage(1);
  }, [scope, lang, month]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    api<Result>('/public/occasions', { params: { lang, scope, month, page, limit: 50 }, cache: 'no-store' })
      .then((result) => { if (active) setData(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [lang, scope, month, page]);

  const days = useMemo(() => monthDays(month), [month]);
  const byDay = useMemo(() => {
    const result = new Map<string, PublicOccasion[]>();
    for (const event of data?.data ?? []) {
      for (let day = 1; day <= 31; day++) {
        const date = `${month}-${String(day).padStart(2, '0')}`;
        if (date.slice(0, 7) !== month || date < event.date || date > event.finishDate) continue;
        result.set(date, [...(result.get(date) ?? []), event]);
      }
    }
    return result;
  }, [data, month]);

  const title = ar ? LABELS[scope][0] : LABELS[scope][1];
  const scopeLinks: OccasionScope[] = ['upcoming', 'current', 'exhibitions', 'previous'];
  const weekDays = ar ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav className="mb-5 flex flex-wrap gap-2" aria-label={ar ? 'المناسبات والمعارض' : 'Occasions and exhibitions'}>
        {scopeLinks.map((item) => <Link key={item} href={href(`/occasions/${item}`)} aria-current={scope === item ? 'page' : undefined} className={`rounded-full px-4 py-2 text-sm font-bold ${scope === item ? 'bg-primary text-white' : 'bg-white text-secondary ring-1 ring-line hover:text-primary'}`}>{ar ? LABELS[item][0] : LABELS[item][1]}</Link>)}
      </nav>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMonth((value) => offsetMonth(value, -1))} aria-label={ar ? 'الشهر السابق' : 'Previous month'} className="rounded-lg border border-line bg-white px-3 py-2 font-bold hover:text-primary">‹</button>
          <h2 className="min-w-36 text-center text-sm font-bold text-secondary" aria-live="polite">
            {new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))}
          </h2>
          <button type="button" onClick={() => setMonth((value) => offsetMonth(value, 1))} aria-label={ar ? 'الشهر التالي' : 'Next month'} className="rounded-lg border border-line bg-white px-3 py-2 font-bold hover:text-primary">›</button>
          <button type="button" onClick={() => setMonth(damascusMonth())} className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold hover:text-primary">{ar ? 'هذا الشهر' : 'This month'}</button>
        </div>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!data && !error ? <Center><Spinner /></Center> : data && (
        <>
          <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
            <div className="grid grid-cols-7 border-b border-line bg-gray-50 text-center text-xs font-semibold text-gray-600">
              {weekDays.map((day) => <div key={day} className="px-1 py-3">{day}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {days.map((date, index) => {
                const events = date ? byDay.get(date) ?? [] : [];
                return (
                  <div key={`${date || 'empty'}-${index}`} className={`min-h-24 border-b border-e border-line p-1.5 sm:min-h-28 sm:p-2 ${date ? '' : 'bg-gray-50/60'}`}>
                    {date && <span className={`text-xs font-semibold ${events.length ? 'text-primary' : 'text-gray-500'}`}>{Number(date.slice(-2))}</span>}
                    <div className="mt-1 space-y-1">
                      {events.slice(0, 2).map((event) => <Link key={event.id} href={href(`/occasions/view?id=${event.id}`)} title={event.title} className={`block truncate rounded px-1 py-0.5 text-[10px] font-semibold ${event.type === 'exhibition' ? 'bg-accent/20 text-secondary' : 'bg-primary/10 text-primary'}`}>{event.title}</Link>)}
                      {events.length > 2 && <span className="block text-[10px] text-gray-500">+{events.length - 2}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <h2 className="mb-4 mt-8 text-xl font-bold text-secondary">{ar ? 'فعاليات هذا الشهر' : 'This month'}</h2>
          {data.data.length === 0 ? <Center>{t('pub.noOccasions')}</Center> : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {data.data.map((event) => (
                <Link key={event.id} href={href(`/occasions/view?id=${event.id}`)} className="group overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg">
                  <Thumb src={event.images[0]} alt={event.title} className="h-44 w-full" />
                  <div className="p-4">
                    <p className="text-xs font-semibold text-primary">{fmtDay(lang, event.date)}{event.finishDate !== event.date ? ` — ${fmtDay(lang, event.finishDate)}` : ''}</p>
                    <span className="mt-2 inline-block rounded-full bg-accent/20 px-2.5 py-0.5 text-[10px] font-bold text-secondary">{ar ? (event.type === 'exhibition' ? 'معرض' : 'مناسبة') : (event.type === 'exhibition' ? 'Exhibition' : 'Occasion')}</span>
                    <h3 className="mt-1 line-clamp-2 font-bold group-hover:text-primary">{event.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {data.meta.totalPages > 1 && <div className="mt-5 flex justify-center gap-3"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-line px-3 py-2 disabled:opacity-40">{t('tbl.first')}</button><span className="self-center text-sm">{page} / {data.meta.totalPages}</span><button type="button" disabled={page >= data.meta.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-line px-3 py-2 disabled:opacity-40">{t('tbl.last')}</button></div>}
        </>
      )}
    </div>
  );
}
