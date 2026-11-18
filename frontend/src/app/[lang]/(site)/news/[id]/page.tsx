'use client';
import { useRecordId } from '@/lib/use-record-id';
import { useCrumbTitle } from '@/components/site/breadcrumbs';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { SECTIONS, fmtDate, fmtNum, newsPerm } from '@/lib/utils';
import { Button, Center, Spinner, Stars } from '@/components/ui/ui';
import { Card, NewsCard, ShareRow } from '@/components/site/cards';
import { ImageSlider } from '@/components/site/image-slider';
import { ReadingProgress } from '@/components/site/motion';
import { PdfViewer } from '@/components/site/pdf-viewer';
import { YoutubeEmbed } from '@/components/site/youtube-embed';
import { NotFoundContent } from '@/components/site/not-found-content';

type Detail = Card & { body: string | null; youtubeId?: string | null; related: Card[] };

function View() {
  const { lang, t, href } = useI18n();
  const { can } = useAuth();
  const id = useRecordId('id');
  const [n, setN] = useState<Detail | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404' | 'error'>('load');
  const [attempt, setAttempt] = useState(0);
  useCrumbTitle(n?.title);

  useEffect(() => {
    // no id yet (the router is still filling the address in): wait a moment before deciding there is none
    if (!id) { const w = setTimeout(() => setState('404'), 1500); return () => clearTimeout(w); }
    let alive = true;
    setState('load');
    // only the server's own "not found" is a 404 page. A failed call (a restart, a slow answer, a dropped connection) is asked once more, then shown as an error with a retry button - it is not a missing page
    const load = (left: number) => api<Detail>(`/public/news/${encodeURIComponent(id)}`).then((d) => { if (alive) { setN(d); setState('ok'); } }).catch((e) => {
      if (!alive) return;
      if (e instanceof ApiError && e.status === 404) setState('404');
      else if (left > 0) setTimeout(() => { if (alive) load(left - 1); }, 700);
      else setState('error');
    });
    load(1);
    return () => { alive = false; };
  }, [id, attempt]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === 'error') return (
    <Center><div className="space-y-3 text-center"><p className="text-gray-600">{lang === 'ar' ? 'تعذّر تحميل الخبر الآن.' : 'The news could not be loaded right now.'}</p><Button type="button" onClick={() => setAttempt((a) => a + 1)}>{lang === 'ar' ? 'إعادة المحاولة' : 'Try again'}</Button></div></Center>
  );
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
            <Link href={href(`/media?category=${encodeURIComponent(n.mainCategory)}`)} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">{n.mainCategory}</Link>
          )}
          <div className="flex items-center gap-2">
            {n.subcategory && <Link href={href(`/media?subcategory=${encodeURIComponent(n.subcategory)}`)} className="rounded-full border border-line px-3 py-1 text-xs text-gray-600 transition hover:border-primary hover:text-primary">{n.subcategory}</Link>}
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

        {n.images.length > 0 && <ImageSlider images={n.images} title={n.title} dir={n.language === 'ar' ? 'rtl' : 'ltr'} />}

        {n.youtubeId && <YoutubeEmbed id={n.youtubeId} title={n.title} />}

        {/* body HTML is whitelist-sanitised by the API before it is stored */}
        {n.body && <div className="prose-news mt-6" dangerouslySetInnerHTML={{ __html: n.body }} />}

        {/* the PDF is shown on its own, never inside the picture slider */}
        {(n.pdfs?.length ? n.pdfs : n.pdf ? [n.pdf] : []).map((p, i, all) => (
          <PdfViewer key={p} src={p} title={all.length > 1 ? `${n.title} (${i + 1}/${all.length})` : n.title} />
        ))}

        {n.topics.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">{t('site.topics')}:</span>
            {n.topics.map((tp) => <span key={tp} className="rounded-full bg-gray-100 px-3 py-1 text-xs">{tp}</span>)}
          </div>
        )}
        <div className="mt-6 border-t border-line pt-4"><ShareRow id={n.id} title={n.title} /></div>
        <div className="mt-6">
          <Link
            href={href(n.topics.length > 0 ? `/media?topics=${encodeURIComponent(n.topics.join(','))}` : `/media?category=${encodeURIComponent(n.mainCategory)}`)}
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
