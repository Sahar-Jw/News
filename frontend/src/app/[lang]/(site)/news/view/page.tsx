'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate, fmtNum } from '@/lib/utils';
import { Center, Spinner, Stars } from '@/components/ui/ui';
import { Card, NewsCard, ShareRow } from '@/components/site/cards';

type Detail = Card & { body: string | null; related: Card[] };

function View() {
  const { lang, t, href } = useI18n();
  const id = useSearchParams().get('id');
  const [n, setN] = useState<Detail | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!id) { setState('404'); return; }
    setState('load');
    api<Detail>(`/public/news/${encodeURIComponent(id)}`).then((d) => { setN(d); setState('ok'); setActive(0); }).catch(() => setState('404'));
  }, [id]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !n) return <Center>{t('site.notFound')}</Center>;

  // a record in the other language keeps working; its own language is shown via lang attributes
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <article lang={n.language} dir={n.language === 'ar' ? 'rtl' : 'ltr'}>
        <Link href={href(`/news?category=${encodeURIComponent(n.mainCategory)}`)} className="rounded bg-primary px-2 py-0.5 text-xs text-white">{n.mainCategory}</Link>
        {n.subcategory && <span className="ms-2 text-xs text-gray-500">/ {n.subcategory}</span>}
        <h1 className="mt-3 text-3xl font-bold leading-snug">{n.title}</h1>
        {n.subject && <p className="mt-2 text-lg text-gray-600">{n.subject}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span>{fmtDate(lang, n.publishAt, true)}</span>
          <span>👁 {fmtNum(lang, n.viewCount)} {t('site.views')}</span>
          {n.rating ? <Stars value={n.rating} /> : null}
        </div>

        {n.images.length > 0 && (
          <div className="mt-5">
            <img src={fileUrl(n.images[active])} alt={n.title} className="max-h-[520px] w-full rounded-xl object-cover" />
            {n.images.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {n.images.map((im, i) => (
                  <button key={im} onClick={() => setActive(i)} className={`h-16 w-24 shrink-0 overflow-hidden rounded border-2 ${i === active ? 'border-primary' : 'border-transparent'}`}>
                    <img src={fileUrl(im)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* body HTML is whitelist-sanitised by the API before it is stored */}
        {n.body && <div className="prose-news mt-6" dangerouslySetInnerHTML={{ __html: n.body }} />}

        {n.topics.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">{t('site.topics')}:</span>
            {n.topics.map((tp) => <span key={tp} className="rounded-full bg-gray-100 px-3 py-1 text-xs">{tp}</span>)}
          </div>
        )}
        <div className="mt-6 border-t pt-4"><ShareRow id={n.id} title={n.title} /></div>
      </article>

      {n.related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-bold">{t('site.related')}</h2>
          <div className="grid gap-5 sm:grid-cols-2">{n.related.map((r) => <NewsCard key={r.id} n={r} />)}</div>
        </section>
      )}
    </div>
  );
}

export default function NewsViewPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><View /></Suspense>;
}
