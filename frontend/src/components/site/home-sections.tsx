'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Stars } from '@/components/ui/ui';
import { Card, DefaultAvatar, FitImage, NewsCard, Thumb } from './cards';
import { ContactForm } from './contact-form';
import { useSite } from './site-context';

export { BreakingTicker } from './breaking-ticker';

export function SectionWrap({ code, title, children, action }: { code: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={`sec-${code}`} className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4 border-b-2 border-primary/20 pb-2">
        <h2 className="border-b-4 border-primary pb-2 text-2xl font-bold -mb-[10px]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function HeroSlider() {
  const { s, loc, img } = useSite();
  const slides = [1, 2, 3]
    .map((n) => ({ image: img('hero', `slide${n}_image`), title: loc('hero', `slide${n}_title`), desc: loc('hero', `slide${n}_description`), has: !!(s('hero', `slide${n}_image`) || s('hero', `slide${n}_title_ar`) || s('hero', `slide${n}_title_en`)) }))
    .filter((x) => x.has);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);
  if (!slides.length) return null;
  return (
    <section id="sec-hero" className="relative h-[320px] overflow-hidden bg-secondary md:h-[460px]">
      {slides.map((sl, k) => (
        <div key={k} className={`absolute inset-0 transition-opacity duration-700 ${k === i ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <FitImage src={sl.image} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl p-6 text-white md:p-12">
            <h2 className="max-w-3xl text-2xl font-bold md:text-4xl">{sl.title}</h2>
            {sl.desc && <p className="mt-3 max-w-2xl text-sm md:text-lg">{sl.desc}</p>}
          </div>
        </div>
      ))}
      {slides.length > 1 && (
        <div className="absolute bottom-3 start-1/2 flex -translate-x-1/2 gap-2 rtl:translate-x-1/2">
          {slides.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`slide ${k + 1}`} className={`h-2.5 rounded-full transition-all ${k === i ? 'w-7 bg-white' : 'w-2.5 bg-white/50'}`} />)}
        </div>
      )}
    </section>
  );
}

/** Round carousel arrow on the physical left / right edge (an SVG, so the browser never mirrors it in RTL). */
function Arrow({ side, onClick, label }: { side: 'left' | 'right'; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 ${side === 'left' ? 'left-3' : 'right-3'}`}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={side === 'left' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
      </svg>
    </button>
  );
}

/** Latest featured news (max 5), one at a time: auto-advances, pauses on hover, arrows + dots. */
export function FeaturedCarousel({ items }: { items: Card[] }) {
  const { href, dir, t } = useI18n();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;
  useEffect(() => {
    if (n < 2 || paused) return;
    const id = setInterval(() => setI((v) => (v + 1) % n), 5000);
    return () => clearInterval(id);
  }, [n, paused]);
  useEffect(() => { if (i >= n) setI(0); }, [i, n]);
  if (!n) return null;
  const go = (d: number) => setI((v) => (v + d + n) % n);
  const rtl = dir === 'rtl';
  return (
    <div
      className="relative h-72 overflow-hidden rounded-xl bg-secondary md:h-[26rem]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-roledescription="carousel"
    >
      {items.map((x, k) => (
        <Link
          key={x.id}
          href={href(`/news/view?id=${x.id}`)}
          aria-hidden={k !== i}
          tabIndex={k === i ? 0 : -1}
          className={`absolute inset-0 block transition-opacity duration-700 ${k === i ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <FitImage src={x.images[0]} alt={x.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 pb-10 text-white md:p-8 md:pb-12">
            <span className="rounded bg-primary px-2 py-0.5 text-xs">{x.mainCategory}</span>
            <h3 className="mt-2 line-clamp-2 max-w-3xl text-xl font-bold leading-snug md:text-3xl">{x.title}</h3>
            {x.subject && <p className="mt-1 line-clamp-1 max-w-2xl text-sm text-gray-200 md:text-base">{x.subject}</p>}
          </div>
        </Link>
      ))}
      {n > 1 && (
        <>
          {/* left/right are physical: in Arabic the left arrow goes forward, in English backward */}
          <Arrow side="left" onClick={() => go(rtl ? 1 : -1)} label={rtl ? t('app.next') : t('app.prev')} />
          <Arrow side="right" onClick={() => go(rtl ? -1 : 1)} label={rtl ? t('app.prev') : t('app.next')} />
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2" dir={dir}>
            {items.map((x, k) => <button key={x.id} type="button" onClick={() => setI(k)} aria-label={`${k + 1} / ${n}`} className={`h-2.5 rounded-full transition-all ${k === i ? 'w-7 bg-white' : 'w-2.5 bg-white/50'}`} />)}
          </div>
        </>
      )}
    </div>
  );
}

export function RegularNews({ items }: { items: Card[] }) {
  const { t } = useI18n();
  if (!items.length) return <p className="text-gray-500">{t('site.noNews')}</p>;
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{items.map((n) => <NewsCard key={n.id} n={n} />)}</div>;
}

/** Team: up to six random members (picked by the API on every load), picture only, three at a time. */
export function TeamSlider({ items }: { items: Card[] }) {
  const { dir, t } = useI18n();
  const [perView, setPerView] = useState(3);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setPerView(mq.matches ? 2 : 3);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  // pages of `perView` members; a short last page is filled with the last members so it is never half empty
  const pages = useMemo(() => {
    if (items.length <= perView) return items.length ? [items] : [];
    const out: Card[][] = [];
    for (let k = 0; k < items.length; k += perView) out.push(k + perView <= items.length ? items.slice(k, k + perView) : items.slice(items.length - perView));
    return out;
  }, [items, perView]);
  const n = pages.length;
  useEffect(() => { if (page >= n) setPage(0); }, [page, n]);
  useEffect(() => {
    if (n < 2 || paused) return;
    const id = setInterval(() => setPage((v) => (v + 1) % n), 4000);
    return () => clearInterval(id);
  }, [n, paused]);
  if (!n) return null;
  const rtl = dir === 'rtl';
  const go = (d: number) => setPage((v) => (v + d + n) % n);
  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} role="region" aria-roledescription="carousel">
      <div className="relative">
        <div className="overflow-hidden">
          <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(${(rtl ? 1 : -1) * page * 100}%)` }}>
            {pages.map((pg, k) => (
              <div key={k} aria-hidden={k !== page} className="grid w-full shrink-0 gap-5" style={{ gridTemplateColumns: `repeat(${pg.length}, minmax(0, 1fr))` }}>
                {pg.map((m) => (
                  <div key={m.id} title={m.title} className="aspect-square overflow-hidden rounded-xl border bg-white shadow-sm">
                    {m.images[0] ? <Thumb src={m.images[0]} alt={m.title} className="h-full w-full" /> : <DefaultAvatar className="h-full w-full" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        {n > 1 && (
          <>
            <Arrow side="left" onClick={() => go(rtl ? 1 : -1)} label={rtl ? t('app.next') : t('app.prev')} />
            <Arrow side="right" onClick={() => go(rtl ? -1 : 1)} label={rtl ? t('app.prev') : t('app.next')} />
          </>
        )}
      </div>
      {n > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {pages.map((_, k) => <button key={k} type="button" onClick={() => setPage(k)} aria-label={`${k + 1} / ${n}`} className={`h-2.5 rounded-full transition-all ${k === page ? 'w-7 bg-primary' : 'w-2.5 bg-gray-300'}`} />)}
        </div>
      )}
    </div>
  );
}

/** Service cards: icon, title, subject and a short content excerpt; each opens the full news item. */
export function ServicesGrid({ items }: { items: Card[] }) {
  const { href } = useI18n();
  if (!items.length) return null;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((x) => (
        <Link key={x.id} href={href(`/news/view?id=${x.id}`)} className="group block rounded-xl border bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-md">
          {x.images[0] ? (
            <img src={fileUrl(x.images[0])} alt="" className="mx-auto mb-4 h-16 w-16 object-contain" />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden>
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
            </div>
          )}
          <h3 className="mb-1 text-lg font-bold group-hover:text-primary">{x.title}</h3>
          {x.subject && <p className="mb-2 text-sm font-medium text-gray-500">{x.subject}</p>}
          {x.excerpt && x.excerpt !== x.subject && <p className="line-clamp-3 text-sm leading-7 text-gray-600">{x.excerpt}</p>}
        </Link>
      ))}
    </div>
  );
}

/** Facebook page plugin sized to its container (the plugin itself allows 180-500px) and clipped to the same radius as the cards. */
function FacebookCard({ pageUrl }: { pageUrl: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(Math.floor(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const width = Math.min(500, Math.max(180, w));
  return (
    <div ref={box} className="h-[500px] w-full overflow-hidden rounded-xl border bg-white shadow-sm">
      {w > 0 && (
        <iframe
          key={width}
          title="facebook"
          className="mx-auto block h-full border-0"
          style={{ width }}
          loading="lazy"
          src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(pageUrl)}&tabs=timeline&width=${width}&height=500&small_header=true`}
        />
      )}
    </div>
  );
}

export function Testimonials({ items }: { items: Card[] }) {
  const { s } = useSite();
  const fb = s('social', 'facebook_page_url');
  if (!items.length && !fb) return null;
  return (
    <div className={`grid items-start gap-5 ${fb ? 'lg:grid-cols-3' : ''}`}>
      <div className={`grid content-start gap-5 sm:grid-cols-2 ${fb ? 'lg:col-span-2' : 'lg:grid-cols-3'}`}>
        {items.map((x) => (
          <div key={x.id} className="rounded-xl border bg-white p-5 shadow-sm">
            <Stars value={x.rating} />
            <h4 className="mt-2 font-bold">{x.title}</h4>
            <p className="mt-2 text-sm leading-7 text-gray-600">{x.excerpt}</p>
            <div className="mt-4 flex items-center gap-3">
              {x.images[0] ? <Thumb src={x.images[0]} className="h-10 w-10 rounded-full" /> : <DefaultAvatar className="h-10 w-10 rounded-full" />}
              <span className="text-sm text-gray-500">{x.subject}</span>
            </div>
          </div>
        ))}
      </div>
      {fb && <FacebookCard pageUrl={fb} />}
    </div>
  );
}

/** Logos only – missing logos are never invented. */
export function Partners({ items }: { items: { id: number; title: string; logo: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 items-center gap-6 rounded-xl border bg-white p-6 sm:grid-cols-3 md:grid-cols-5">
      {items.map((p) => <img key={p.id} src={fileUrl(p.logo)} alt={p.title} title={p.title} loading="lazy" className="mx-auto max-h-16 w-auto object-contain" />)}
    </div>
  );
}

export function Experts({ items }: { items: Card[] }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((x) => (
        <div key={x.id} className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <Thumb src={x.images[0]} className="h-48 w-full" alt={x.title} />
          <div className="p-4">
            <h3 className="font-bold">{x.title}</h3>
            {x.subject && <div className="text-sm font-medium text-primary">{x.subject}</div>}
            <p className="mt-2 line-clamp-3 text-sm text-gray-600">{x.excerpt}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Statistics are manual: title = label, content = value. Nothing is computed. */
export function StatsRow({ items }: { items: Card[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
      {items.map((x) => (
        <div key={x.id} className="rounded-xl bg-primary p-6 text-center text-white shadow">
          <div className="text-4xl font-bold">{x.excerpt || x.subject}</div>
          <div className="mt-2 text-sm opacity-90">{x.title}</div>
        </div>
      ))}
    </div>
  );
}

export function Company({ item }: { item: Card | null }) {
  if (!item) return null;
  return (
    <div className="grid items-center gap-8 md:grid-cols-2">
      <div>
        <h3 className="mb-3 text-2xl font-bold">{item.title}</h3>
        {item.body ? <div className="prose-news" dangerouslySetInnerHTML={{ __html: item.body }} /> : <p>{item.subject}</p>}
      </div>
      {item.images[0] && <img src={fileUrl(item.images[0])} alt="" className="w-full rounded-xl object-cover shadow" />}
    </div>
  );
}

export function ContactSection() {
  const { t } = useI18n();
  const { s, loc } = useSite();
  const rows: [string, string | null][] = [[t('site.phone'), s('contact', 'phone')], [t('site.email'), s('contact', 'email')], [t('site.address'), loc('contact', 'address')], [t('site.hours'), loc('contact', 'working_hours')]];
  const map = s('contact', 'map_url');
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-4">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-white p-4"><div className="text-xs text-gray-500">{k}</div><div className="font-medium">{v}</div></div>
        ))}
        {map && <iframe src={map} title="map" loading="lazy" className="h-56 w-full rounded-lg border" />}
      </div>
      <div className="rounded-xl border bg-white p-5 shadow-sm"><ContactForm /></div>
    </div>
  );
}
