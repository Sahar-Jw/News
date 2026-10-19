'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Stars } from '@/components/ui/ui';
import { Card, DefaultAvatar, FitImage, NewsCard, Thumb } from './cards';
import { ContactIcon } from './icons';
import { CountUp, Reveal, Stagger } from './motion';
import { ContactForm } from './contact-form';
import { useSite } from './site-context';

export { BreakingTicker } from './breaking-ticker';

/**
 * Section frame: optional eyebrow (small label above), title, accent bar and optional subtitle.
 * Eyebrow and subtitle come from Settings (sections_home → <section>_eyebrow / <section>_subtitle, per language)
 * and are simply not shown while empty.
 */
export function SectionWrap({ code, title, children, action }: { code: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const { loc } = useSite();
  const eyebrow = loc('sections_home', `${code}_eyebrow`);
  const subtitle = loc('sections_home', `${code}_subtitle`);
  return (
    <section id={`sec-${code}`} className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12">
      <Reveal className="mb-9 text-center">
        {eyebrow && <span className="inline-block rounded-full bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">{eyebrow}</span>}
        <h2 className={`${eyebrow ? 'mt-3' : ''} text-xl font-extrabold leading-tight md:text-2xl`}>{title}</h2>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="bar-draw h-1 w-10 rounded-full bg-primary" />
          <span className="h-1 w-2 rounded-full bg-primary/50" />
          <span className="h-1 w-1 rounded-full bg-primary/25" />
        </div>
        {subtitle && <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[color:var(--muted)]">{subtitle}</p>}
      </Reveal>
      {children}
      {action && <div className="mt-8 text-center">{action}</div>}
    </section>
  );
}

/**
 * Home hero. One orchestrated moment: the picture drifts in slowly, the title rises word by word, and story-style
 * bars at the bottom fill while a slide is on screen (they pause on hover and double as the slide selector).
 */
export function HeroSlider() {
  const { s, loc, img } = useSite();
  const slides = [1, 2, 3]
    .map((n) => ({ image: img('hero', `slide${n}_image`), title: loc('hero', `slide${n}_title`), desc: loc('hero', `slide${n}_description`), has: !!(s('hero', `slide${n}_image`) || s('hero', `slide${n}_title_ar`) || s('hero', `slide${n}_title_en`)) }))
    .filter((x) => x.has);
  const [i, setI] = useState(0);
  if (!slides.length) return null;
  const many = slides.length > 1;
  const next = () => setI((v) => (v + 1) % slides.length);
  return (
    <section id="sec-hero" className="hero relative h-[360px] overflow-hidden bg-secondary md:h-[520px]" aria-roledescription="carousel">
      {slides.map((sl, k) => (
        <div key={k} aria-hidden={k !== i} className={`absolute inset-0 transition-opacity duration-1000 ${k === i ? 'hero-in opacity-100' : 'pointer-events-none opacity-0'}`}>
          <div className={`absolute inset-0 ${k === i ? 'kenburns' : ''}`}><FitImage src={sl.image} /></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-6 pb-14 text-white md:px-12 md:pb-20">
            {sl.title && (
              <h2 className="max-w-3xl text-xl font-extrabold leading-snug md:text-3xl">
                {sl.title.split(' ').flatMap((w, wi) => [
                  <span key={wi} className="inline-block overflow-hidden align-bottom"><span className="hero-word inline-block pb-1" style={{ animationDelay: `${150 + wi * 70}ms` }}>{w}</span></span>,
                  ' ',
                ])}
              </h2>
            )}
            {sl.desc && <p className="hero-desc mt-3 max-w-2xl text-sm text-white/85 md:text-base">{sl.desc}</p>}
          </div>
        </div>
      ))}
      {many && (
        <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-7xl gap-2 px-6 pb-4 md:px-12" role="tablist">
          {slides.map((_, k) => (
            <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`slide ${k + 1}`} onClick={() => setI(k)} className="h-5 flex-1 py-2">
              <span className="block h-1 overflow-hidden rounded-full bg-white/30">
                {k < i && <span className="block h-full w-full bg-white" />}
                {k === i && <span key={`${i}-${slides.length}`} onAnimationEnd={next} className="seg-fill block h-full bg-white" />}
              </span>
            </button>
          ))}
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
      className="relative h-72 overflow-hidden rounded-3xl bg-secondary shadow-card md:h-[26rem]"
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
            <h3 className="mt-2 line-clamp-2 max-w-3xl text-lg font-bold leading-snug md:text-2xl">{x.title}</h3>
            {x.subject && <p className="mt-1 line-clamp-1 max-w-2xl text-xs text-gray-200 md:text-sm">{x.subject}</p>}
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
  return <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{items.map((n) => <NewsCard key={n.id} n={n} />)}</Stagger>;
}

/** Team: up to six random members (picked by the API on every load). Small picture-only cards, sliding one at a time. */
export function TeamSlider({ items }: { items: Card[] }) {
  const { dir, t } = useI18n();
  const [small, setSmall] = useState(false);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setSmall(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const size = small ? 96 : 144; // card edge in px
  const gap = 16;
  const perView = small ? 2 : 4;
  const n = items.length;
  const max = Math.max(0, n - perView); // furthest position
  const slides = max > 0;
  useEffect(() => { if (i > max) setI(0); }, [i, max]);
  useEffect(() => {
    if (!slides || paused) return;
    const id = setInterval(() => setI((v) => (v >= max ? 0 : v + 1)), 3000);
    return () => clearInterval(id);
  }, [slides, paused, max]);
  if (!n) return null;
  const rtl = dir === 'rtl';
  const visible = Math.min(n, perView);
  const viewW = visible * size + (visible - 1) * gap;
  const pad = slides ? (small ? 48 : 56) : 0;
  const go = (d: number) => setI((v) => (v + d > max ? 0 : v + d < 0 ? max : v + d));
  return (
    <div className="relative mx-auto max-w-full" style={{ width: viewW + pad * 2, paddingInline: pad }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} role="region" aria-roledescription="carousel">
      <div className="overflow-hidden py-1" style={{ width: viewW }}>
        <div className="flex transition-transform duration-500 ease-in-out" style={{ gap, transform: `translateX(${(rtl ? 1 : -1) * i * (size + gap)}px)` }}>
          {items.map((m) => (
            <div key={m.id} title={m.title} style={{ width: size, height: size }} className="shrink-0 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
              {m.images[0] ? <Thumb src={m.images[0]} alt={m.title} className="h-full w-full" /> : <DefaultAvatar className="h-full w-full" />}
            </div>
          ))}
        </div>
      </div>
      {slides && (
        <>
          <Arrow side="left" onClick={() => go(rtl ? 1 : -1)} label={rtl ? t('app.next') : t('app.prev')} />
          <Arrow side="right" onClick={() => go(rtl ? -1 : 1)} label={rtl ? t('app.prev') : t('app.next')} />
        </>
      )}
    </div>
  );
}

/** Service cards: icon, title, subject and a short content excerpt; each opens the full news item. */
export function ServicesGrid({ items }: { items: Card[] }) {
  const { href } = useI18n();
  if (!items.length) return null;
  return (
    <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((x) => (
        <Link key={x.id} href={href(`/news/view?id=${x.id}`)} className="group block rounded-2xl bg-white p-7 text-center shadow-card ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:shadow-lift">
          {x.images[0] ? (
            <img src={fileUrl(x.images[0])} alt="" className="mx-auto mb-5 h-16 w-16 object-contain" />
          ) : (
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary transition duration-300 group-hover:rotate-6 group-hover:bg-primary group-hover:text-white" aria-hidden>
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
            </div>
          )}
          <h3 className="mb-1 text-base font-bold transition group-hover:text-primary">{x.title}</h3>
          {x.subject && <p className="mb-2 text-sm font-medium text-[color:var(--muted)]">{x.subject}</p>}
          {x.excerpt && x.excerpt !== x.subject && <p className="line-clamp-3 text-sm leading-7 text-gray-600">{x.excerpt}</p>}
        </Link>
      ))}
    </Stagger>
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
    <div ref={box} className="h-[500px] w-full overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
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
          <div key={x.id} className="relative rounded-2xl bg-white p-6 shadow-card ring-1 ring-line">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" className="absolute end-5 top-5 text-primary/15" aria-hidden="true"><path d="M7.2 4C4.9 4 3 5.9 3 8.2V20h8.4V11.6H7.2V8.2h4.2V4H7.2Zm9.6 0c-2.3 0-4.2 1.9-4.2 4.2V20H21V11.6h-4.2V8.2H21V4h-4.2Z" /></svg>
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

export function Partners({ items }: { items: { id: number; title: string; logo: string }[] }) {
  if (!items.length) return null;
  return (
    <Stagger className="grid grid-cols-2 items-center gap-6 rounded-2xl bg-white p-7 shadow-card ring-1 ring-line sm:grid-cols-3 md:grid-cols-5">
      {items.map((p) => <img key={p.id} src={fileUrl(p.logo)} alt={p.title} title={p.title} loading="lazy" className="mx-auto max-h-16 w-auto object-contain opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0" />)}
    </Stagger>
  );
}

/** Latest four experts; each card opens the full news item. */
export function Experts({ items }: { items: Card[] }) {
  const { href } = useI18n();
  if (!items.length) return null;
  return (
    <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((x) => (
        <Link key={x.id} href={href(`/news/view?id=${x.id}`)} className="group block overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:shadow-lift">
          <div className="h-52 w-full overflow-hidden">
            {x.images[0] ? <Thumb src={x.images[0]} className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-105" alt={x.title} /> : <DefaultAvatar className="h-full w-full" />}
          </div>
          <div className="p-5">
            <h3 className="text-sm font-bold transition group-hover:text-primary">{x.title}</h3>
            {x.subject && <div className="mt-0.5 text-xs font-medium text-primary">{x.subject}</div>}
            {x.excerpt && x.excerpt !== x.subject && <p className="mt-2 line-clamp-3 text-sm leading-7 text-gray-600">{x.excerpt}</p>}
          </div>
        </Link>
      ))}
    </Stagger>
  );
}

/** Statistics are manual: title = label, content = value. Nothing is computed. */
/** Up to five figures on one band: the value large on top (counts up when first seen), its title small underneath. */
export function StatsRow({ items }: { items: Card[] }) {
  if (!items.length) return null;
  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-secondary via-secondary to-primary p-4 shadow-card md:p-6">
      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((x) => (
          <div key={x.id} className="flex flex-col items-center justify-center rounded-2xl bg-white/10 px-4 py-7 text-center text-white ring-1 ring-white/15 backdrop-blur-sm">
            <CountUp value={x.excerpt || x.subject || ''} className="break-words font-display text-lg font-extrabold leading-tight md:text-xl" />
            <div className="mt-3 text-xs text-white/80 md:text-sm">{x.title}</div>
          </div>
        ))}
      </Stagger>
    </div>
  );
}
/** Company overview: up to five pictures (random on every load); each opens its news item. */
export function Company({ items }: { items: Card[] }) {
  const { href } = useI18n();
  if (!items.length) return null;
  return (
    <Stagger className="flex flex-wrap justify-center gap-5">
      {items.map((x) => (
        <Link
          key={x.id}
          href={href(`/news/view?id=${x.id}`)}
          title={x.title}
          className="group relative block aspect-[4/3] w-[calc(50%-0.625rem)] overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:shadow-lift sm:w-[calc(33.333%-0.85rem)] lg:w-[calc(20%-1rem)]"
        >
          {x.images[0] ? (
            <FitImage src={x.images[0]} alt={x.title} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/20 text-primary/60" aria-hidden>
              <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" /></svg>
            </div>
          )}
        </Link>
      ))}
    </Stagger>
  );
}

export function ContactSection() {
  const { t } = useI18n();
  const { s, loc } = useSite();
  // [label, value, icon, always left-to-right (phone / email)]
  const rows: [string, string | null, 'phone' | 'email' | 'address' | 'hours', boolean][] = [
    [t('site.phone'), s('contact', 'phone'), 'phone', true],
    [t('site.email'), s('contact', 'email'), 'email', true],
    [t('site.address'), loc('contact', 'address'), 'address', false],
    [t('site.hours'), loc('contact', 'working_hours'), 'hours', false],
  ];
  const map = s('contact', 'map_url');
  return (
    <div className="grid items-start gap-8 md:grid-cols-2">
      <Stagger className="space-y-4">
        {rows.filter(([, v]) => v).map(([k, v, icon, ltr]) => (
          <div key={k} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ContactIcon name={icon} size={18} /></span>
            <div><div className="text-xs text-gray-500">{k}</div><div className="font-medium">{ltr ? <bdi dir="ltr">{v}</bdi> : v}</div></div>
          </div>
        ))}
        {map && <iframe src={map} title="map" loading="lazy" className="h-56 w-full rounded-2xl border-0 shadow-card" />}
      </Stagger>
      <Reveal className="self-start rounded-2xl bg-white p-6 shadow-card ring-1 ring-line"><ContactForm /></Reveal>
    </div>
  );
}
