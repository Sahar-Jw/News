'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { ImageSlider } from './image-slider';
import { NotFoundContent } from './not-found-content';

interface Item { id: number; title: string; images: string[]; date?: string }

function View({ endpoint, back, backLabel }: { endpoint: string; back: string; backLabel: string }) {
  const { lang, t, href } = useI18n();
  const id = useSearchParams().get('id');
  const [item, setItem] = useState<Item | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');

  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) { setState('404'); return; }
    setState('load');
    api<Item>(`${endpoint}/${id}`, { params: { lang } }).then((d) => { setItem(d); setState('ok'); }).catch(() => setState('404'));
  }, [id, lang, endpoint]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !item) return <NotFoundContent lang={lang} />;
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <article className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line md:p-10">
        {item.date && <p className="text-sm font-semibold text-primary">{fmtDay(lang, item.date)}</p>}
        <h1 className="mt-2 text-2xl font-extrabold leading-snug md:text-3xl">{item.title}</h1>
        {item.images.length > 0 && <ImageSlider images={item.images} title={item.title} />}
        <div className="mt-6"><Link href={href(back)} className="text-sm text-primary">← {t(backLabel)}</Link></div>
      </article>
    </div>
  );
}

/** Detail page of an occasion or a gallery: title (+ date) and the news-style picture slider. */
export function TitledImagesView(props: { endpoint: string; back: string; backLabel: string }) {
  return <Suspense fallback={<Center><Spinner /></Center>}><View {...props} /></Suspense>;
}
