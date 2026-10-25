'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, onSiteChange } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDay, fmtNum } from '@/lib/utils';
import { Button, Center, Spinner } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { RequirePerm } from '@/components/admin/guard';
import { StatusBadge, useStatuses } from '@/components/admin/appointment-status';

interface Slim { id: number; customerName: string; customerPhone: string; appointmentDate: string; appointmentTime: string; status: string }
interface Data {
  today: string; total: number;
  byStatus: { code: string; ar: string; en: string; color?: string; count: number }[];
  todayList: Slim[]; next7: Slim[]; perDay: { date: string; count: number }[];
}

// the browser's own day, so "today" is right wherever the viewer is
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function List({ rows, withDate, empty }: { rows: Slim[]; withDate?: boolean; empty: string }) {
  const { lang } = useI18n();
  const st = useStatuses();
  if (!rows.length) return <p className="py-6 text-center text-sm text-gray-500">{empty}</p>;
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{r.customerName}</div>
            <div className="text-xs text-gray-500"><bdi dir="ltr">{r.customerPhone}</bdi></div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-end text-xs text-gray-600">
              {withDate && <div>{fmtDay(lang, r.appointmentDate)}</div>}
              <div className="font-semibold" dir="ltr">{r.appointmentTime}</div>
            </div>
            <StatusBadge code={r.status} label={st.label(r.status)} color={st.color(r.status)} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Dates dashboard: counts per status, today, the next 7 days, and a per-day chart. */
export function DatesDashboard() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try { setData(await api<Data>('/admin/appointments/dashboard', { params: { today: localToday() } })); }
    catch (e: any) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => onSiteChange(() => { void load(); }), [load]); // a date added / changed elsewhere updates the numbers

  const max = Math.max(1, ...(data?.perDay.map((d) => d.count) ?? [1]));

  return (
    <RequirePerm any={['appointments.dashboard']}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('adm.datesDashboard')}</h1>
        <Button variant="outline" size="sm" disabled={busy} onClick={load}>↻ {t('dd.refresh')}</Button>
      </div>
      {!data ? <Center><Spinner /></Center> : (
        <div className="space-y-5">
          {/* counts per status */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border bg-white p-4"><div className="text-xs text-gray-500">{t('dd.total')}</div><div className="mt-1 text-3xl font-extrabold">{fmtNum(lang, data.total)}</div></div>
            {data.byStatus.map((s) => {
              const c = /^#[0-9a-fA-F]{6}$/.test(s.color ?? '') ? (s.color as string) : '#6b7280';
              return (
                <div key={s.code} className="rounded-xl border bg-white p-4" style={{ borderTopColor: c, borderTopWidth: 3 }}>
                  <div className="text-xs text-gray-500">{lang === 'ar' ? s.ar : s.en}</div>
                  <div className="mt-1 text-3xl font-extrabold" style={{ color: c }}>{fmtNum(lang, s.count)}</div>
                </div>
              );
            })}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border bg-white p-4">
              <h2 className="mb-2 font-bold">{t('dd.today')} <span className="text-sm font-normal text-gray-500">· {fmtDay(lang, data.today)}</span></h2>
              <List rows={data.todayList} empty={t('dd.noneToday')} />
            </section>
            <section className="rounded-xl border bg-white p-4">
              <h2 className="mb-2 font-bold">{t('dd.next7')}</h2>
              <List rows={data.next7} withDate empty={t('dd.noneNext')} />
            </section>
          </div>

          {/* dates per day: 7 days back to 14 days ahead */}
          <section className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-bold">{t('dd.perDay')}</h2>
            <div className="overflow-x-auto">
              <div className="flex h-52 min-w-[34rem] items-end gap-1.5" role="img" aria-label={t('dd.perDay')}>
                {data.perDay.map((d) => {
                  const isToday = d.date === data.today;
                  return (
                    <div key={d.date} className="flex h-full flex-1 flex-col justify-end text-center" title={`${fmtDay(lang, d.date)}: ${d.count}`}>
                      <div className="text-[11px] font-semibold text-gray-600">{d.count || ''}</div>
                      <div className={`mx-auto w-full max-w-[1.75rem] rounded-t ${isToday ? 'bg-primary' : 'bg-primary/40'}`} style={{ height: d.count ? `${Math.max(4, (d.count / max) * 85)}%` : '2px', backgroundColor: d.count ? undefined : '#e5e7eb' }} />
                      <div className={`mt-1 text-[11px] ${isToday ? 'font-bold text-primary' : 'text-gray-500'}`}>{Number(d.date.slice(8, 10))}</div>
                      <div className="h-3 text-[9px] text-gray-400">{d.date.slice(8, 10) === '01' || d === data.perDay[0] ? d.date.slice(5, 7) + '/' : ''}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}
    </RequirePerm>
  );
}
