'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner, inputCls } from '@/components/ui/ui';
import { Heading, useExpoData } from '@/components/site/expo-shared';

/** Exhibitors directory: search by name + filter by sector. */
export default function ExhibitorsPage() {
  const { t, href } = useI18n();
  const data = useExpoData();
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('');
  const shown = (data?.exhibitors ?? []).filter((e) => (!sector || e.sector === sector) && (!q.trim() || `${e.name} ${e.description}`.toLowerCase().includes(q.trim().toLowerCase())));
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Heading sub={t('ex.exhibitorsSub')}>{t('ex.exhibitors')}</Heading>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <input type="search" className={`${inputCls} sm:col-span-2`} maxLength={100} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ex.searchPh')} aria-label={t('ex.searchPh')} />
        <select className={inputCls} value={sector} onChange={(e) => setSector(e.target.value)} aria-label={t('ex.sectors')}><option value="">{t('ex.allSectors')}</option>{data?.sectors.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </div>
      {!data ? <Center><Spinner /></Center> : shown.length === 0 ? <Center>{t('ex.noExhibitors')}</Center> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => (
            <article key={e.id} className="flex flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
              <div className="mb-3 flex items-center gap-3">
                {e.logoUrl ? <img src={e.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" /> : <span className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-lg font-extrabold text-primary">{e.name.slice(0, 1)}</span>}
                <h3 className="font-extrabold text-secondary">{e.name}</h3>
              </div>
              <div className="mb-2 flex flex-wrap gap-2 text-[11px] font-bold">
                {e.sector && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">{e.sector}</span>}
                {e.booth && <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-secondary">{t('ex.booth')}: {e.booth}</span>}
              </div>
              {e.description && <p className="flex-1 whitespace-pre-line text-sm leading-7 text-gray-600">{e.description}</p>}
              {e.website && <a href={e.website} target="_blank" rel="noopener noreferrer" className="mt-3 text-sm font-bold text-primary hover:underline">{t('ex.visit')} ↗</a>}
            </article>
          ))}
        </div>
      )}
      <div className="mt-8 text-center"><Link href={href('/expo/register?kind=exhibitor')} className="inline-block rounded-full bg-accent px-6 py-3 font-extrabold text-secondary shadow transition hover:brightness-110">{t('ex.registerExhibitor')}</Link></div>
    </div>
  );
}
