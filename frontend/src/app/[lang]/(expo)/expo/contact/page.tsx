'use client';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { ApplyForm, Heading, useExpoInfo } from '@/components/site/expo-shared';

/** EXPO contact: details + an information request (stored as an "info" application and e-mailed to the EXPO team). */
export default function ExpoContact() {
  const { lang, t } = useI18n();
  const x = useExpoInfo();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Heading>{t('ex.contact')}</Heading>
      <div className="mb-6 grid gap-3 text-sm sm:grid-cols-2">
        {x.start && <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">📅 {fmtDay(lang, x.start)}{x.end && x.end !== x.start ? ` — ${fmtDay(lang, x.end)}` : ''}</div>}
        {x.venue && <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">📍 {x.venue}</div>}
        {x.phone && <a href={`tel:${x.phone.replace(/[^+\d]/g, '')}`} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">☎ <bdi dir="ltr">{x.phone}</bdi></a>}
        {x.email && <a href={`mailto:${x.email}`} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">✉ <bdi dir="ltr">{x.email}</bdi></a>}
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-line"><h3 className="mb-4 font-extrabold text-primary">{t('ex.kind.info')}</h3><ApplyForm kind="info" sectors={[]} /></div>
    </div>
  );
}
