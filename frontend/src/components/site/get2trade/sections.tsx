'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtNum } from '@/lib/utils';
import { Button, Center, Spinner } from '@/components/ui/ui';
import { Card, NewsCard, Thumb } from '@/components/site/cards';
import { Pager } from '@/components/site/pager';
import { useGet2Trade } from './context';

const PER_PAGE = 6;

const Section = ({ title, aside, children, innerRef }: { title: string; aside?: React.ReactNode; children: React.ReactNode; innerRef?: React.Ref<HTMLElement> }) => (
  <section ref={innerRef} className="scroll-mt-24 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{title}</h2>
      {aside}
    </div>
    {children}
  </section>
);

/** compact page controls shown above a list (the numbered pager is below it): ‹ 2 / 5 › and the number of items */
function PageBar({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  const { t, lang } = useI18n();
  if (pages <= 1) return <span className="text-xs text-gray-500">{fmtNum(lang, total)}</span>;
  const btn = 'inline-flex h-8 items-center justify-center rounded-full border border-line bg-white px-3 text-xs font-semibold transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex items-center gap-2" role="group" aria-label={t('app.pages')}>
      <span className="text-xs text-gray-500">{fmtNum(lang, total)}</span>
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>{t('app.prev')}</button>
      <span className="min-w-12 text-center text-sm font-semibold" aria-live="polite">{fmtNum(lang, page)} / {fmtNum(lang, pages)}</span>
      <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>{t('app.next')}</button>
    </div>
  );
}

/** pages through a list that is already loaded; scrolls back to the top of the section when the page changes */
function useClientPaging<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const ref = useRef<HTMLElement>(null);
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const go = (p: number) => { setPage(p); ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  return { ref, page: cur, pages, go, slice: items.slice((cur - 1) * PER_PAGE, cur * PER_PAGE) };
}

const Rich = ({ html }: { html: string }) => {
  const { t } = useI18n();
  return html ? <div className="prose-news" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="text-sm text-gray-500">{t('gt.soon')}</p>;
};

export function AboutTab() {
  const { t } = useI18n();
  const { page } = useGet2Trade();
  if (!page) return null;
  return <Section title={t('gt.about')}><Rich html={page.about} /></Section>;
}

export function ServicesTab() {
  const { t } = useI18n();
  const { page } = useGet2Trade();
  if (!page) return null;
  return (
    <Section title={t('gt.services')}>
      {page.services ? <Rich html={page.services} /> : <ul className="list-disc space-y-1 ps-5 text-sm leading-7 text-gray-700">{['flexible', 'coworking', 'office', 'meeting', 'business'].map((k) => <li key={k}>{t(`gt.svc.${k}`)}</li>)}</ul>}
    </Section>
  );
}

export function PackagesTab() {
  const { t } = useI18n();
  const { page, openForm } = useGet2Trade();
  const list = page?.packages ?? [];
  const paging = useClientPaging(list);
  if (!page) return null;
  return (
    <Section title={t('gt.packages')} innerRef={paging.ref} aside={list.length > 0 && <PageBar page={paging.page} pages={paging.pages} total={list.length} onPage={paging.go} />}>
      {list.length === 0 ? <p className="text-sm text-gray-500">{t('gt.noPackages')}</p> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paging.slice.map((p) => (
              <article key={p.id} className="flex flex-col rounded-2xl border border-line p-5">
                <h3 className="text-lg font-extrabold text-secondary">{p.name}</h3>
                <p className={`mt-1 text-sm font-bold ${p.price ? 'text-primary' : 'text-gray-400'}`}>{p.price || t('gt.priceSoon')}</p>
                {p.features.length > 0 && <ul className="mt-3 flex-1 list-disc space-y-1 ps-5 text-sm leading-7 text-gray-700">{p.features.map((f, i) => <li key={i}>{f}</li>)}</ul>}
                <Button type="button" variant="outline" className="mt-4" onClick={() => openForm(page.isOpen ? 'booking' : 'inquiry', { packageId: p.id })}>{t(page.isOpen ? 'gt.book' : 'gt.inquire')}</Button>
              </article>
            ))}
          </div>
          <Pager page={paging.page} totalPages={paging.pages} onPage={paging.go} />
        </>
      )}
    </Section>
  );
}

export function SpacesTab() {
  const { t } = useI18n();
  const { page, openForm } = useGet2Trade();
  const list = page?.spaces ?? [];
  const paging = useClientPaging(list);
  if (!page) return null;
  return (
    <Section title={t('gt.spaces')} innerRef={paging.ref} aside={list.length > 0 && <PageBar page={paging.page} pages={paging.pages} total={list.length} onPage={paging.go} />}>
      {list.length === 0 ? <p className="text-sm text-gray-500">{t('gt.noSpaces')}</p> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {paging.slice.map((s) => (
              <article key={s.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
                <Thumb src={s.imageUrl} alt={s.name} className="h-40 w-full" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{t(`gt.kind.${s.kind}`)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(s.isAvailable ? 'gt.available' : 'gt.unavailable')}</span>
                  </div>
                  <h3 className="mt-2 font-extrabold text-secondary">{s.name}</h3>
                  {s.description && <p className="mt-1 whitespace-pre-line text-sm leading-7 text-gray-600">{s.description}</p>}
                  <p className="mt-2 text-xs text-gray-500">{[s.capacity ? `${t('gt.capacity')}: ${s.capacity} ${t('gt.people')}` : '', s.areaSqm ? `${t('gt.area')}: ${s.areaSqm} ${t('gt.sqm')}` : ''].filter(Boolean).join(' · ')}</p>
                  <p className={`mt-1 text-sm font-bold ${s.price ? 'text-primary' : 'text-gray-400'}`}>{s.price || t('gt.priceSoon')}</p>
                  <div className="mt-auto pt-4">
                    {s.isAvailable && page.isOpen ? <Button type="button" onClick={() => openForm('booking', { spaceId: s.id })}>{t('gt.book')}</Button> : <Button type="button" variant="outline" onClick={() => openForm('inquiry', { spaceId: s.id })}>{t('gt.inquire')}</Button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pager page={paging.page} totalPages={paging.pages} onPage={paging.go} />
        </>
      )}
    </Section>
  );
}

interface Paged<T> { data: T[]; meta: { totalPages: number; total: number } }

/** company news: paged by the server (the news of the topic chosen in the admin's Get2Trade page content) */
export function NewsTab() {
  const { lang, t, href } = useI18n();
  const { page: g2t } = useGet2Trade();
  const topic = g2t?.newsTopic ?? '';
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Paged<Card> | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => { setPage(1); }, [topic, lang]);
  useEffect(() => {
    if (!topic) { setRes({ data: [], meta: { totalPages: 1, total: 0 } }); return; }
    setRes(null);
    api<Paged<Card>>('/public/news', { params: { lang, topics: topic, page, limit: PER_PAGE } }).then(setRes).catch(() => setRes({ data: [], meta: { totalPages: 1, total: 0 } }));
  }, [topic, lang, page]);

  const go = (p: number) => { setPage(p); ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const pages = res?.meta.totalPages ?? 1;
  return (
    <Section title={t('gt.news')} innerRef={ref} aside={res && res.data.length > 0 && <PageBar page={page} pages={pages} total={res.meta.total} onPage={go} />}>
      {!res ? <Center><Spinner /></Center> : res.data.length === 0 ? <p className="text-sm text-gray-500">{t('gt.noNews')}</p> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{res.data.map((n) => <NewsCard key={n.id} n={n} />)}</div>
          <Pager page={page} totalPages={pages} onPage={go} />
          <div className="mt-4 text-center"><Link href={href(`/media?topics=${encodeURIComponent(topic)}`)} className="text-sm font-semibold text-primary hover:underline">{t('gt.allNews')}</Link></div>
        </>
      )}
    </Section>
  );
}
