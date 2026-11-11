'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Block, Bullets, Heading, useExpoInfo } from '@/components/site/expo-shared';

/** The key information an exhibitor and a visitor need (dates, place, and two checklists set in Settings → DCC EXPO). */
export default function InfoPage() {
  const { lang, href } = useI18n();
  const ar = lang === 'ar';
  const x = useExpoInfo();
  const facts: [string, string][] = [
    [ar ? 'التاريخ' : 'Dates', x.start ? `${fmtDay(lang, x.start)}${x.end && x.end !== x.start ? ` — ${fmtDay(lang, x.end)}` : ''}` : ''],
    [ar ? 'المكان' : 'Venue', x.venue], [ar ? 'العنوان' : 'Address', x.address], [ar ? 'الهاتف' : 'Phone', x.phone], [ar ? 'البريد' : 'E-mail', x.email],
  ];
  const shown = facts.filter(([, v]) => v);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Heading sub={ar ? 'كل ما يحتاجه العارض والزائر قبل الحضور.' : 'Everything an exhibitor or a visitor needs before coming.'}>{ar ? 'معلومات هامة' : 'Key information'}</Heading>
      {shown.length > 0 && <dl className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shown.map(([k, v]) => <div key={k} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line"><dt className="text-xs font-semibold text-gray-500">{k}</dt><dd className="mt-1 font-bold text-secondary" dir="auto">{v}</dd></div>)}</dl>}
      <div className="grid gap-5 md:grid-cols-2">
        <Block title={ar ? 'للعارضين' : 'For exhibitors'}>{x.lines('info_exhibitors').length ? <Bullets items={x.lines('info_exhibitors')} /> : <p className="text-sm text-gray-500">{ar ? 'ستُنشر المعلومات قريباً.' : 'Coming soon.'}</p>}</Block>
        <Block title={ar ? 'للزوار' : 'For visitors'}>{x.lines('info_visitors').length ? <Bullets items={x.lines('info_visitors')} /> : <p className="text-sm text-gray-500">{ar ? 'ستُنشر المعلومات قريباً.' : 'Coming soon.'}</p>}</Block>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {x.registerOpen && <Link href={href('/expo/register?kind=exhibitor')} className="rounded-full bg-accent px-6 py-3 font-extrabold text-secondary shadow transition hover:brightness-110">{ar ? 'سجّل كعارض' : 'Register as exhibitor'}</Link>}
        {x.registerOpen && <Link href={href('/expo/register?kind=visitor')} className="rounded-full border-2 border-primary px-6 py-3 font-bold text-primary transition hover:bg-primary/10">{ar ? 'سجّل كزائر' : 'Register as visitor'}</Link>}
        <Link href={href('/expo/faq')} className="rounded-full border-2 border-primary/40 px-6 py-3 font-bold text-primary transition hover:bg-primary/10">{ar ? 'الأسئلة الشائعة' : 'FAQs'}</Link>
      </div>
    </div>
  );
}
