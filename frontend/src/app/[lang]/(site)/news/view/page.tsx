'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { SECTIONS, fmtDate, fmtNum, newsPerm } from '@/lib/utils';
import { Center, Spinner, Stars } from '@/components/ui/ui';
import { Card, NewsCard, ShareRow } from '@/components/site/cards';
import { ReadingProgress } from '@/components/site/motion';
import { PdfViewer } from '@/components/site/pdf-viewer';
import { NotFoundContent } from '@/components/site/not-found-content';

type Detail = Card & { body: string | null; related: Card[] };

/**
 * Picture slider: moves on its own, stops while the pointer is over it (or a thumbnail is focused).
 * Thumbnails never scroll sideways: up to 6 sit in one row, more are split over two rows.
 */
function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = images.length;
  useEffect(() => { setActive(0); }, [images]);
  useEffect(() => {
    if (n < 2 || paused) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % n), 4000);
    return () => clearInterval(timer);
  }, [n, paused, active]);
  const go = (d: number) => setActive((i) => (i + d + n) % n);
  const cols = n <= 6 ? n : Math.ceil(n / 2);
  return (
    <div className="mt-5" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="relative h-64 overflow-hidden rounded-2xl bg-gray-100 md:h-[26rem]" role="region" aria-roledescription="carousel">
        {images.map((im, i) => (
          <img key={im} src={fileUrl(im)} alt={i === active ? title : ''} aria-hidden={i !== active} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === active ? 'opacity-100' : 'opacity-0'}`} />
        ))}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="previous" className="absolute start-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 rtl:rotate-180">‹</button>
            <button type="button" onClick={() => go(1)} aria-label="next" className="absolute end-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60 rtl:rotate-180">›</button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {images.map((im, i) => (
            <button key={im} type="button" onClick={() => setActive(i)} aria-label={`${i + 1}`} className={`aspect-[4/3] overflow-hidden rounded border-2 transition ${i === active ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100'}`}>
              <img src={fileUrl(im)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function View() {
  const { lang, t, href } = useI18n();
  const { can } = useAuth();
  const id = useSearchParams().get('id');
  const [n, setN] = useState<Detail | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');

  useEffect(() => {
    if (!id) { setState('404'); return; }
    setState('load');
    api<Detail>(`/public/news/${encodeURIComponent(id)}`).then((d) => { setN(d); setState('ok'); }).catch(() => setState('404'));
  }, [id]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !n) return <NotFoundContent lang={lang} />;

  const inSection = (SECTIONS as readonly string[]).includes(n.mainCategory);
  // only people who may edit this kind of record see the button (the API still enforces it)
  const mayEdit = can(newsPerm('update', inSection ? n.mainCategory : undefined));

  // a record in the other language keeps working; its own language is shown via lang attributes
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <ReadingProgress />
      <article lang={n.language} dir={n.language === 'ar' ? 'rtl' : 'ltr'} className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {inSection ? (
            // home-page sections (services, team…) are not news categories: show the translated name, no filter link
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{t(`section.${n.mainCategory}`)}</span>
          ) : (
            <Link href={href(`/news?category=${encodeURIComponent(n.mainCategory)}`)} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">{n.mainCategory}</Link>
          )}
          <div className="flex items-center gap-2">
            {n.subcategory && <Link href={href(`/news?subcategory=${encodeURIComponent(n.subcategory)}`)} className="rounded-full border border-line px-3 py-1 text-xs text-gray-600 transition hover:border-primary hover:text-primary">{n.subcategory}</Link>}
            {mayEdit && <Link href={href(`/admin/news/edit?id=${n.id}${inSection ? `&section=${n.mainCategory}` : ''}`)} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white transition hover:brightness-110">{t('app.edit')}</Link>}
          </div>
        </div>
        <h1 className="mt-4 text-2xl font-extrabold leading-snug md:text-3xl">{n.title}</h1>
        {n.subject && <p className="mt-2 text-base text-gray-600">{n.subject}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span>{fmtDate(lang, n.publishAt, true)}</span>
          <span>👁 {fmtNum(lang, n.viewCount)} {t('site.views')}</span>
          {n.rating ? <Stars value={n.rating} /> : null}
        </div>

        {n.images.length > 0 && <Gallery images={n.images} title={n.title} />}

        {/* body HTML is whitelist-sanitised by the API before it is stored */}
        {n.body && <div className="prose-news mt-6" dangerouslySetInnerHTML={{ __html: n.body }} />}

        {/* the PDF is shown on its own, never inside the picture slider */}
        {n.pdf && <PdfViewer src={n.pdf} title={n.title} />}

        {n.topics.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">{t('site.topics')}:</span>
            {n.topics.map((tp) => <span key={tp} className="rounded-full bg-gray-100 px-3 py-1 text-xs">{tp}</span>)}
          </div>
        )}
        <div className="mt-6 border-t border-line pt-4"><ShareRow id={n.id} title={n.title} /></div>
        <div className="mt-6">
          <Link
            href={href(n.topics.length > 0 ? `/news?topics=${encodeURIComponent(n.topics.join(','))}` : `/news?category=${encodeURIComponent(n.mainCategory)}`)}
            className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/30 transition hover:brightness-110 active:scale-[0.97]"
          >
            {t('site.readMoreAbout')}
            <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1">→</span>
          </Link>
        </div>
      </article>

      {n.related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold">{t('site.related')}</h2>
          <div className="grid gap-5 sm:grid-cols-2">{n.related.map((r) => <NewsCard key={r.id} n={r} />)}</div>
        </section>
      )}
    </div>
  );
}

export default function NewsViewPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><View /></Suspense>;
}
