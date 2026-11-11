'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { Heading, useExpoData, useExpoInfo } from '@/components/site/expo-shared';

/** Participating sectors: the sectors and specialities the expo targets (one per line: "name | description"), plus the sectors of the registered exhibitors. */
export default function SectorsPage() {
  const { lang, href } = useI18n();
  const ar = lang === 'ar';
  const x = useExpoInfo();
  const data = useExpoData();
  const planned = x.lines('sectors_list').map((line) => { const [name, ...rest] = line.split('|'); return { name: name.trim(), description: rest.join('|').trim() }; }).filter((s) => s.name);
  const counts = new Map<string, number>();
  for (const e of data?.exhibitors ?? []) if (e.sector) counts.set(e.sector, (counts.get(e.sector) ?? 0) + 1);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Heading sub={x.L('sectors_intro')}>{ar ? 'القطاعات المشاركة' : 'Participating sectors'}</Heading>
      {planned.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {planned.map((s) => (
            <article key={s.name} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
              <h3 className="flex items-center gap-2 font-extrabold text-secondary"><span className="h-6 w-1.5 rounded-full bg-accent" />{s.name}</h3>
              {s.description && <p className="mt-2 text-sm leading-7 text-gray-600">{s.description}</p>}
            </article>
          ))}
        </div>
      )}
      {!data ? <Center><Spinner /></Center> : counts.size > 0 && (
        <section className="mt-10">
          <h3 className="mb-3 text-center text-lg font-extrabold text-primary">{ar ? 'قطاعات العارضين المسجلين' : 'Sectors of registered exhibitors'}</h3>
          <div className="flex flex-wrap justify-center gap-2">{[...counts.entries()].map(([name, n]) => <span key={name} className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">{name} <span className="text-xs text-primary/70">({n})</span></span>)}</div>
          <div className="mt-4 text-center"><Link href={href('/expo/exhibitors')} className="font-bold text-primary hover:underline">{ar ? 'تصفح العارضين' : 'Browse exhibitors'} →</Link></div>
        </section>
      )}
      {data && planned.length === 0 && counts.size === 0 && <Center>{ar ? 'سيتم الإعلان عن القطاعات قريباً' : 'Sectors will be announced soon'}</Center>}
    </div>
  );
}
