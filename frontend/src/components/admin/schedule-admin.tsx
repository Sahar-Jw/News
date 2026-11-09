'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { RequirePerm } from '@/components/admin/guard';
import { dayName, defaultSchedule, readSchedule, type Schedule } from '@/lib/one-stop-schedule';

interface Row { id: number; key: string; category: string; value: unknown }

/** Opening hours of the One-Stop window: the weekly reception hours, holidays and temporary changes (one JSON setting: one_stop.schedule). */
export function ScheduleAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const editable = can('settings.update');
  const [sc, setSc] = useState<Schedule | null>(null);
  const [rowId, setRowId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ data: Row[] }>('/admin/settings', { params: { category: 'one_stop', limit: 'all' }, cache: 'no-store' })
      .then(({ data }) => {
        const row = data.find((r) => r.key === 'schedule');
        if (!row) throw new Error('Missing one_stop.schedule setting; run the migrations.');
        setRowId(row.id);
        setSc(readSchedule(typeof row.value === 'string' ? safeParse(row.value) : row.value) ?? defaultSchedule());
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  if (err) return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>;
  if (!sc) return null;
  const set = (patch: Partial<Schedule>) => setSc({ ...sc, ...patch });
  const setDay = (i: number, patch: Partial<Schedule['week'][number]>) => set({ week: sc.week.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const dis = !editable;

  const save = async () => {
    for (const h of sc.holidays) if (!h.from || (h.to && h.to < h.from)) return toast(t('sch.badRange'), 'err');
    for (const c of sc.changes) if (!c.from || (c.to && c.to < c.from)) return toast(t('sch.badRange'), 'err');
    for (const d of sc.week) if (d.open && d.to <= d.from) return toast(t('sch.badHours'), 'err');
    setBusy(true);
    try {
      await api(`/admin/settings/${rowId}`, { method: 'PATCH', body: { value: sc } });
      toast(t('app.saved'));
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const firstOpen = sc.week.find((d) => d.open) ?? sc.week[0];
  return (
    <RequirePerm any={['settings.read']}>
      <h1 className="mb-1 text-2xl font-bold">{t('sch.title')}</h1>
      <p className="mb-5 text-sm text-gray-600">{t('sch.hint')}</p>

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-extrabold text-secondary">{t('sch.week')}</h2>
          <Button type="button" size="sm" variant="outline" disabled={dis} onClick={() => set({ week: sc.week.map((d) => (d.open ? { ...d, from: firstOpen.from, to: firstOpen.to } : d)) })}>{t('sch.applyAll')}</Button></div>
        <div className="space-y-2">
          {sc.week.map((d, i) => (
            <div key={d.day} className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 px-3 py-2">
              <label className="flex w-36 items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={dis} checked={d.open} onChange={(e) => setDay(i, { open: e.target.checked })} />{dayName(d.day, lang)}</label>
              {d.open ? (
                <div className="flex items-center gap-2 text-sm" dir="ltr">
                  <input type="time" disabled={dis} className={`${inputCls} !w-32`} value={d.from} onChange={(e) => setDay(i, { from: e.target.value })} />
                  <span>→</span>
                  <input type="time" disabled={dis} className={`${inputCls} !w-32`} value={d.to} onChange={(e) => setDay(i, { to: e.target.value })} />
                </div>
              ) : <span className="text-sm text-gray-500">{t('sch.closed')}</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
        <div className="mb-1 flex items-center justify-between gap-2"><h2 className="font-extrabold text-secondary">{t('sch.holidays')}</h2>
          <Button type="button" size="sm" variant="outline" disabled={dis} onClick={() => set({ holidays: [...sc.holidays, { from: '', to: '', labelAr: '', labelEn: '' }] })}>＋ {t('sch.addHoliday')}</Button></div>
        <p className="mb-3 text-xs text-gray-500">{t('sch.holidaysHint')}</p>
        {sc.holidays.length === 0 && <p className="text-sm text-gray-500">{t('sch.none')}</p>}
        <div className="space-y-2">
          {sc.holidays.map((h, i) => (
            <div key={i} className="grid gap-2 rounded-xl bg-gray-50 p-3 md:grid-cols-[9rem,9rem,1fr,1fr,auto]">
              <Field label={t('sch.from')}><input type="date" disabled={dis} dir="ltr" className={inputCls} value={h.from} onChange={(e) => set({ holidays: sc.holidays.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) })} /></Field>
              <Field label={t('sch.to')}><input type="date" disabled={dis} dir="ltr" className={inputCls} value={h.to} onChange={(e) => set({ holidays: sc.holidays.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })} /></Field>
              <Field label={t('sch.nameAr')}><input disabled={dis} dir="rtl" maxLength={120} className={inputCls} value={h.labelAr} onChange={(e) => set({ holidays: sc.holidays.map((x, j) => (j === i ? { ...x, labelAr: e.target.value } : x)) })} /></Field>
              <Field label={t('sch.nameEn')}><input disabled={dis} dir="ltr" maxLength={120} className={inputCls} value={h.labelEn} onChange={(e) => set({ holidays: sc.holidays.map((x, j) => (j === i ? { ...x, labelEn: e.target.value } : x)) })} /></Field>
              <Button type="button" size="sm" variant="ghost" className="self-end text-red-600" disabled={dis} onClick={() => set({ holidays: sc.holidays.filter((_, j) => j !== i) })}>✕</Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
        <div className="mb-1 flex items-center justify-between gap-2"><h2 className="font-extrabold text-secondary">{t('sch.changes')}</h2>
          <Button type="button" size="sm" variant="outline" disabled={dis} onClick={() => set({ changes: [...sc.changes, { from: '', to: '', closed: false, hoursFrom: '08:00', hoursTo: '12:00', noteAr: '', noteEn: '' }] })}>＋ {t('sch.addChange')}</Button></div>
        <p className="mb-3 text-xs text-gray-500">{t('sch.changesHint')}</p>
        {sc.changes.length === 0 && <p className="text-sm text-gray-500">{t('sch.none')}</p>}
        <div className="space-y-2">
          {sc.changes.map((c, i) => {
            const up = (patch: Partial<typeof c>) => set({ changes: sc.changes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="space-y-2 rounded-xl bg-gray-50 p-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label={t('sch.from')}><input type="date" disabled={dis} dir="ltr" className={`${inputCls} !w-40`} value={c.from} onChange={(e) => up({ from: e.target.value })} /></Field>
                  <Field label={t('sch.to')}><input type="date" disabled={dis} dir="ltr" className={`${inputCls} !w-40`} value={c.to} onChange={(e) => up({ to: e.target.value })} /></Field>
                  <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" disabled={dis} checked={c.closed} onChange={(e) => up({ closed: e.target.checked })} />{t('sch.closedAll')}</label>
                  {!c.closed && (
                    <div className="flex items-center gap-2 pb-1" dir="ltr">
                      <input type="time" disabled={dis} className={`${inputCls} !w-32`} value={c.hoursFrom} onChange={(e) => up({ hoursFrom: e.target.value })} /><span>→</span>
                      <input type="time" disabled={dis} className={`${inputCls} !w-32`} value={c.hoursTo} onChange={(e) => up({ hoursTo: e.target.value })} />
                    </div>
                  )}
                  <Button type="button" size="sm" variant="ghost" className="ms-auto text-red-600" disabled={dis} onClick={() => set({ changes: sc.changes.filter((_, j) => j !== i) })}>✕</Button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Field label={t('sch.noteAr')}><input disabled={dis} dir="rtl" maxLength={300} className={inputCls} value={c.noteAr} onChange={(e) => up({ noteAr: e.target.value })} /></Field>
                  <Field label={t('sch.noteEn')}><input disabled={dis} dir="ltr" maxLength={300} className={inputCls} value={c.noteEn} onChange={(e) => up({ noteEn: e.target.value })} /></Field>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {editable && <div className="flex justify-end"><Button type="button" disabled={busy} onClick={save}>{t('app.save')}</Button></div>}
    </RequirePerm>
  );
}

function safeParse(v: string): unknown { try { return JSON.parse(v); } catch { return null; } }
