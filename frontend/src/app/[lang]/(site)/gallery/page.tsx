'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtNum } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { Thumb } from '@/components/site/cards';
import { Pager } from '@/components/site/pager';

interface PublicGallery { id: number; title: string; images: string[] }

export default function GalleryPage() {
  const { lang, t, href } = useI18n();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ data: PublicGallery[]; meta: { totalPages: number } } | null>(null);

  useEffect(() => {
    setData(null);
    api('/public/gallery', { params: { lang, page, limit: 12 } }).then(setData).catch(() => setData({ data: [], meta: { totalPages: 1 } }));
  }, [lang, page]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('pub.gallery')}</h1>
      {!data ? <Center><Spinner /></Center> : data.data.length === 0 ? <Center>{t('pub.noGalleries')}</Center> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {data.data.map((g) => (
              <Link key={g.id} href={href(`/gallery/view?id=${g.id}`)} className="group overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg">
                <Thumb src={g.images[0]} alt={g.title} className="h-44 w-full" />
                <div className="p-4">
                  <h2 className="line-clamp-2 font-bold group-hover:text-primary">{g.title}</h2>
                  <p className="mt-1 text-xs text-gray-500">{fmtNum(lang, g.images.length)} {t('pub.photos')}</p>
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
