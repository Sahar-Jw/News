'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { Thumb } from './cards';
import { Pager } from './pager';

export interface PublicOccasion { id: number; title: string; date: string; isUpcoming: boolean; images: string[] }

/** Public list of the upcoming (soonest first) or the previous (most recent first) occasions. */
export function OccasionsList({ scope }: { scope: 'upcoming' | 'previous' }) {
  const { lang, t, href } = useI18n();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ data: PublicOccasion[]; meta: { totalPages: number } } | null>(null);

  useEffect(() => { setPage(1); }, [scope, lang]);
  useEffect(() => {
    setData(null);
    api('/public/occasions', { params: { lang, scope, page, limit: 12 } }).then(setData).catch(() => setData({ data: [], meta: { totalPages: 1 } }));
  }, [lang, scope, page]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t(scope === 'upcoming' ? 'pub.upcoming' : 'pub.previous')}</h1>
      {!data ? <Center><Spinner /></Center> : data.data.length === 0 ? <Center>{t('pub.noOccasions')}</Center> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.data.map((o) => (
              <Link key={o.id} href={href(`/occasions/view?id=${o.id}`)} className="group overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg">
                <Thumb src={o.images[0]} alt={o.title} className="h-44 w-full" />
                <div className="p-4">
                  <p className="text-xs font-semibold text-primary">{fmtDay(lang, o.date)}</p>
                  <h2 className="mt-1 line-clamp-2 font-bold group-hover:text-primary">{o.title}</h2>
                </div>
              </Link>
            ))}
          </div>
          <Pager page={page} totalPages={data.meta.totalPages} onPage={setPage} />
        </>
      )}
    </div>
  );
}
