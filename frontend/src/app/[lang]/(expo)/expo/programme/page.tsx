'use client';
import { useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { Heading, SESSION_TYPES, useExpoData } from '@/components/site/expo-shared';

const dayKey = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Damascus' }) : '');

/** Programme: sessions grouped by day (tabs), with type, hall and speaker. */
export default function ProgrammePage() {
  const { lang, t } = useI18n();
  const data = useExpoData();
  const days = useMemo(() => [...new Set((data?.sessions ?? []).map((s) => dayKey(s.startsAt)))].sort(), [data]);
  const [day, setDay] = useState('');
  const current = day && days.includes(day) ? day : days[0] ?? '';
  const list = (data?.sessions ?? []).filter((s) => dayKey(s.startsAt) === current);
  const time = (iso: string | null) => (iso ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Damascus' }).format(new Date(iso)) : '');
  const dayLabel = (k: string) => (k ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${k}T00:00:00Z`)) : t('ex.dateTbd'));
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Heading sub={t('ex.programmeSub')}>{t('ex.programme')}</Heading>
      {!data ? <Center><Spinner /></Center> : data.sessions.length === 0 ? <Center>{t('ex.noSessions')}</Center> : (
        <>
          <div className="mb-6 flex flex-wrap justify-center gap-2" role="tablist">
            {days.map((d, i) => (
              <button key={d || 'x'} type="button" role="tab" aria-selected={current === d} onClick={() => setDay(d)} className={`rounded-full px-5 py-2 text-sm font-bold transition ${current === d ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>{t('ex.day')} {i + 1} · {dayLabel(d)}</button>
            ))}
          </div>
          <ol className="space-y-3">
            {list.map((s) => (
              <li key={s.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
                <div className="w-20 shrink-0 text-center"><div className="text-lg font-extrabold text-primary">{time(s.startsAt)}</div>{s.endsAt && <div className="text-xs text-gray-500">{time(s.endsAt)}</div>}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold text-secondary">{s.name}</h3><span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-bold text-secondary">{t(`ex.type.${(SESSION_TYPES as readonly string[]).includes(s.type) ? s.type : 'other'}`)}</span></div>
                  {s.description && <p className="mt-1 whitespace-pre-line text-sm leading-7 text-gray-600">{s.description}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-gray-500">{s.speaker && <span>🎤 {s.speaker}</span>}{s.hall && <span>📍 {s.hall}</span>}</div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
