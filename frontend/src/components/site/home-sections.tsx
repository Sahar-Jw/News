'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDay, prettyUrl, telHref } from '@/lib/utils';
import { Modal, Stars } from '@/components/ui/ui';
import { Card, DefaultAvatar, FitImage, NewsCard, Thumb } from './cards';
import { ContactIcon } from './icons';
import { CountUp, Reveal, Stagger } from './motion';
import { ContactForm } from './contact-form';
import { useSite } from './site-context';

export { BreakingTicker } from './breaking-ticker';
export { SubscribeSection } from './subscribe-section';

/** Background band per section, so the page has rhythm instead of one flat sheet. */
const BANDS: Record<string, 'tint' | 'dark'> = { team: 'tint', experts: 'tint', contact: 'tint', testimonials: 'dark' };

/**
 * Section frame: optional eyebrow (small label above), title, accent bar and optional subtitle.
 * Eyebrow and subtitle come from Settings (sections_home → <section>_eyebrow / <section>_subtitle, per language)
 * and are simply not shown while empty.
 */
export function SectionWrap({ code, title, children, action, compact }: { code: string; title: string; children: React.ReactNode; action?: React.ReactNode; compact?: boolean }) {
  const { loc } = useSite();
  const eyebrow = loc('sections_home', `${code}_eyebrow`);
  const subtitle = loc('sections_home', `${code}_subtitle`);
  const band = BANDS[code];
  const dark = band === 'dark';
  return (
    <section
      id={`sec-${code}`}
      className={`relative scroll-mt-20 ${band === 'tint' ? 'bg-gradient-to-b from-transparent via-primary/[0.07] to-transparent' : ''} ${dark ? 'my-4 overflow-hidden bg-gradient-to-br from-secondary via-secondary to-primary/60 text-white' : ''}`}
    >
      {dark && <><div className="grid-lines pointer-events-none absolute inset-0" aria-hidden="true" /><div className="sheen" aria-hidden="true" /><div className="edge-glow pointer-events-none absolute inset-x-0 top-0" aria-hidden="true" /></>}
      <div className={`relative mx-auto max-w-7xl px-4 ${compact ? 'pb-1 pt-8 md:pb-2 md:pt-10' : 'py-8 md:py-10'}`}>
        <Reveal className="mb-6 text-center">
          {eyebrow && <span className={`inline-block rounded-full px-3.5 py-1 text-xs font-semibold ${dark ? 'bg-accent/20 text-white ring-1 ring-accent/50' : 'bg-accent/15 text-secondary ring-1 ring-accent/40'}`}>{eyebrow}</span>}
          <h2 className={`${eyebrow ? 'mt-3' : ''} text-xl font-extrabold leading-tight md:text-2xl ${dark ? '' : 'text-secondary'}`}>{title}</h2>
          {/* gold ornament: hairlines either side of a small diamond, like the logo's flourishes */}
          <div className="mt-3 flex items-center justify-center gap-2.5" aria-hidden="true">
            <span className="bar-draw h-px w-14 bg-gradient-to-r from-transparent to-accent" />
            <span className="relative h-2.5 w-2.5 rotate-45 border border-accent"><span className="absolute inset-[2px] bg-accent" /></span>
            <span className="bar-draw h-px w-14 bg-gradient-to-l from-transparent to-accent" />
          </div>
          {subtitle && <p className={`mx-auto mt-3 max-w-2xl text-sm leading-7 ${dark ? 'text-white/70' : 'text-[color:var(--muted)]'}`}>{subtitle}</p>}
        </Reveal>
        {children}
        {action && <div className="mt-5 text-center">{action}</div>}
      </div>
    </section>
  );
}

/** A setting link: "/path#hash" stays inside the site, "https://…" opens a new tab. */
function SmartLink({ link, className, children }: { link: string; className: string; children: React.ReactNode }) {
  const { href } = useI18n();
  if (/^https?:\/\//i.test(link)) return <a href={link} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  const [path, hash] = link.split('#');
  return <Link href={`${href(path || '/')}${hash ? `#${hash}` : ''}`} className={className}>{children}</Link>;
}

interface AgendaItem { id: number; title: string; date: string; images: string[] }

/**
 * "Chamber agenda" (wireframe W01): the next occasions, next to a promo banner (DCC EXPO) that is filled from Settings (promo → title, text, button, link, image).
 * Nothing is drawn while there are no upcoming occasions and no banner title.
 */
export function AgendaSection({ code, title }: { code: string; title: string }) {
  const { lang, t, href } = useI18n();
  const { s, loc, img } = useSite();
  const [items, setItems] = useState<AgendaItem[] | null>(null);
  useEffect(() => {
    api<{ data: AgendaItem[] }>('/public/occasions', { params: { lang, scope: 'upcoming', limit: 4 }, cache: 'no-store' }).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [lang]);
  const promoTitle = loc('promo', 'title'), promoText = loc('promo', 'text'), promoButton = loc('promo', 'button');
  const promoLink = String(s('promo', 'link') ?? '').trim(), promoImage = img('promo', 'image');
  // DCC EXPO banner (wireframe P1): always beside the agenda. The "promo" settings, when filled, replace its content.
  const hasPromo = !!promoTitle;
  const expoName = loc('expo', 'name') || 'DCC EXPO';
  const expoTagline = loc('expo', 'tagline');
  const expoVenue = loc('expo', 'venue');
  const expoStart = String(s('expo', 'start_date') ?? ''), expoEnd = String(s('expo', 'end_date') ?? '');
  const expoDates = expoStart ? (expoEnd && expoEnd !== expoStart ? `${fmtDay(lang, expoStart)} – ${fmtDay(lang, expoEnd)}` : fmtDay(lang, expoStart)) : '';
  const expoImage = img('expo', 'hero_image');
  const expoFrom = String(s('expo', 'primary_color') ?? '') || '#4b1d7a', expoAccent = String(s('expo', 'accent_color') ?? '') || '#c9a227';
  if (items === null) return null;
  const bannerCls = 'relative flex min-h-[200px] flex-col justify-center overflow-hidden rounded-2xl p-6 text-white shadow-card';
  return (
    <SectionWrap code={code} title={title} action={items.length ? <Link href={href('/occasions/upcoming')} className="text-sm font-semibold text-primary">{t('home.allEvents')} →</Link> : undefined}>
      <div className={`grid gap-5 ${items.length ? 'lg:grid-cols-2' : ''}`}>
        {items.length > 0 && (
          <ul className="space-y-3">
            {items.map((o) => (
              <li key={o.id}>
                <Link href={href(`/occasions/view?id=${o.id}`)} className="group flex items-center gap-4 rounded-2xl bg-white p-3 shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent">
                  <Thumb src={o.images[0]} alt="" className="h-16 w-24 shrink-0 rounded-xl" />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-primary">{fmtDay(lang, o.date)}</span>
                    <span className="mt-0.5 line-clamp-2 block font-bold text-secondary group-hover:text-primary">{o.title}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {hasPromo ? (
          <div className={`${bannerCls} bg-gradient-to-br from-secondary to-primary`}>
            {promoImage && <img src={promoImage} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
            <div className="relative">
              <h3 className="text-2xl font-extrabold leading-tight">{promoTitle}</h3>
              {promoText && <p className="mt-2 max-w-md text-sm leading-7 text-white/85">{promoText}</p>}
              {promoLink && promoButton && <SmartLink link={promoLink} className="mt-4 inline-block rounded-full bg-accent px-5 py-2 text-sm font-bold text-secondary transition hover:brightness-110">{promoButton}</SmartLink>}
            </div>
          </div>
        ) : (
          <Link href={href('/expo')} className={`${bannerCls} group`} style={{ backgroundImage: `linear-gradient(135deg, ${expoFrom}, ${expoFrom}d9)` }}>
            {expoImage && <img src={expoImage} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-30 transition duration-500 group-hover:scale-105" />}
            <div className="relative">
              <span className="inline-block rounded-full px-3 py-1 text-xs font-bold text-secondary" style={{ backgroundColor: expoAccent }}>{expoDates || t('home.expoSoon')}</span>
              <h3 className="mt-3 text-3xl font-extrabold leading-tight">{expoName}</h3>
              {expoTagline && <p className="mt-1 text-base text-white/90">{expoTagline}</p>}
              {expoVenue && <p className="mt-2 text-sm text-white/75">{expoVenue}</p>}
              <span className="mt-4 inline-block rounded-full px-5 py-2 text-sm font-bold text-secondary transition group-hover:brightness-110" style={{ backgroundColor: expoAccent }}>{t('home.expoCta')} →</span>
            </div>
          </Link>
        )}
      </div>
    </SectionWrap>
  );
}

interface WomenAct { id: number; kind: string; title: string; body?: string; eventDate?: string | null }
interface WomenData { name: string; summary: string; tags: string[]; meetings: WomenAct[]; initiatives: WomenAct[]; recommendations: WomenAct[] }

/**
 * Businesswomen committee slider (own rose / charcoal theme from the committee's logo file).
 * Slide 1 is the committee card (logo, tagline); the next slides are its latest activities. Any slide opens the committee page.
 */
export function WomenCommitteeSection({ code, title }: { code: string; title: string }) {
  const { lang, t, href } = useI18n();
  const [d, setD] = useState<WomenData | null | undefined>(undefined);
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    api<WomenData>('/public/committees/women', { params: { lang }, cache: 'no-store' }).then(setD).catch(() => setD(null));
  }, [lang]);
  const acts = useMemo(() => (d ? [...d.initiatives, ...d.meetings].slice(0, 4) : []), [d]);
  const count = 1 + acts.length;
  useEffect(() => {
    if (count < 2 || hover) return;
    const h = setInterval(() => setI((x) => (x + 1) % count), 6000);
    return () => clearInterval(h);
  }, [count, hover]);
  if (!d) return null;
  const to = href('/committees/women');
  const ROSE = '#C7878D', DARK = '#231F20';
  const go = (n: number) => setI((n + count) % count);
  return (
    <SectionWrap code={code} title={title}>
      <div
        className="relative overflow-hidden rounded-3xl shadow-card"
        style={{ backgroundColor: DARK, color: '#fff' }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      >
        <div className="pointer-events-none absolute -top-24 end-[-4rem] h-72 w-72 rounded-full opacity-20 blur-2xl" style={{ backgroundColor: ROSE }} aria-hidden="true" />
        <div className="relative min-h-[260px]">
          {i === 0 ? (
            <Link href={to} className="grid items-center gap-6 p-6 md:grid-cols-[auto,1fr] md:p-10">
              <img src="/brand/women-committee-icon.svg" alt={d.name} className="mx-auto h-36 w-auto md:h-44" />
              <div className="text-center md:text-start">
                <h3 className="text-2xl font-extrabold leading-tight md:text-3xl">{d.name}</h3>
                <p className="mt-2 text-base font-semibold" style={{ color: ROSE }}>{t('women.tagline')}</p>
                {d.summary && <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-7 text-white/75">{d.summary}</p>}
                <span className="mt-5 inline-block rounded-full px-6 py-2 text-sm font-bold" style={{ backgroundColor: ROSE, color: DARK }}>{t('women.cta')} →</span>
              </div>
            </Link>
          ) : (
            (() => {
              const a = acts[i - 1];
              return (
                <Link href={to} className="flex h-full min-h-[260px] flex-col justify-center gap-3 p-6 md:p-10">
                  <span className="inline-block w-fit rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: ROSE, color: DARK }}>
                    {a.eventDate ? fmtDay(lang, a.eventDate) : d.name}
                  </span>
                  <h3 className="max-w-3xl text-xl font-extrabold leading-snug md:text-2xl">{a.title}</h3>
                  {a.body && <p className="line-clamp-3 max-w-3xl text-sm leading-7 text-white/75">{a.body}</p>}
                  <span className="mt-2 text-sm font-bold" style={{ color: ROSE }}>{t('women.cta')} →</span>
                </Link>
              );
            })()
          )}
        </div>
        {count > 1 && (
          <div className="relative flex items-center justify-center gap-3 pb-4">
            <button type="button" aria-label="‹" onClick={() => go(i - 1)} className="h-7 w-7 rounded-full text-sm ring-1 ring-white/30 hover:bg-white/10">‹</button>
            {Array.from({ length: count }).map((_, n) => (
              <button key={n} type="button" aria-label={String(n + 1)} onClick={() => setI(n)} className="h-2 rounded-full transition-all" style={{ width: n === i ? 24 : 8, backgroundColor: n === i ? ROSE : 'rgba(255,255,255,.35)' }} />
            ))}
            <button type="button" aria-label="›" onClick={() => go(i + 1)} className="h-7 w-7 rounded-full text-sm ring-1 ring-white/30 hover:bg-white/10">›</button>
          </div>
        )}
      </div>
    </SectionWrap>
  );
}

interface AlbumItem { id: number; title: string; kind: 'photos' | 'video'; thumb: string | null }

/** Photo and video strip (wireframe W01): the latest 5 items (albums and videos), each opens its page; a video shows a play badge. */
export function GallerySection({ code, title }: { code: string; title: string }) {
  const { lang, t, href } = useI18n();
  const [items, setItems] = useState<AlbumItem[] | null>(null);
  useEffect(() => {
    api<{ data: AlbumItem[] }>('/public/gallery', { params: { lang, limit: 5 }, cache: 'no-store' }).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [lang]);
  if (!items || items.length === 0) return null;
  return (
    <SectionWrap code={code} title={title} action={<Link href={href('/gallery')} className="text-sm font-semibold text-primary">{t('home.allPhotos')} →</Link>}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {items.map((g) => (
          <Link key={g.id} href={href(`/gallery/view?id=${g.id}`)} className="group relative block overflow-hidden rounded-2xl ring-1 ring-line transition hover:ring-accent">
            <Thumb src={g.thumb} alt={g.title} className="h-32 w-full md:h-36" />
            {g.kind === 'video' && (
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white ring-2 ring-white/70 transition group-hover:scale-110 group-hover:bg-primary/90"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></span>
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-secondary/85 to-transparent px-3 pb-2 pt-6 text-xs font-bold text-white">{g.title}</span>
          </Link>
        ))}
      </div>
    </SectionWrap>
  );
}

/** Quick links under the hero: up to 6 shortcuts from Settings (shortcuts → itemN_title_ar/en + itemN_link). Empty title or link = not shown. */
export function ShortcutsGrid() {
  const { s, loc } = useSite();
  const { href } = useI18n();
  const items = [1, 2, 3, 4, 5, 6]
    .map((n) => ({ n, title: loc('shortcuts', `item${n}_title`), link: String(s('shortcuts', `item${n}_link`) ?? '').trim() }))
    .filter((x) => x.title && x.link);
  if (!items.length) return null;
  const cls = 'group flex h-full flex-col items-center justify-center gap-2 rounded-2xl bg-white px-3 py-5 text-center text-sm font-bold text-secondary shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:text-primary hover:ring-accent';
  const body = (title: string) => (
    <>
      <span className="relative h-2.5 w-2.5 rotate-45 border border-accent transition group-hover:bg-accent" aria-hidden="true" />
      <span className="leading-6">{title}</span>
    </>
  );
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {items.map((x) => {
        if (/^https?:\/\//i.test(x.link)) return <a key={x.n} href={x.link} target="_blank" rel="noopener noreferrer" className={cls}>{body(x.title)}</a>;
        const [path, hash] = x.link.split('#');
        return <Link key={x.n} href={`${href(path || '/')}${hash ? `#${hash}` : ''}`} className={cls}>{body(x.title)}</Link>;
      })}
    </div>
  );
}

/**
 * Home hero. The picture always spans the full width of the page (object-cover). Slides crossfade without scaling the images, the title rises word by word,
 * and story-style bars at the bottom fill while a slide is on screen (pause on hover, clickable).
 */
export function HeroSlider() {
  const { s, loc, img } = useSite();
  const slides = [1, 2, 3, 4, 5]
    .map((n) => ({ image: img('hero', `slide${n}_image`), title: loc('hero', `slide${n}_title`), desc: loc('hero', `slide${n}_description`), has: !!(s('hero', `slide${n}_image`) || s('hero', `slide${n}_title_ar`) || s('hero', `slide${n}_title_en`)) }))
    .filter((x) => x.has);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const many = slides.length > 1;
  useEffect(() => {
    if (!many || paused) return;
    const timer = window.setTimeout(() => setI((current) => (current + 1) % slides.length), 6000);
    return () => window.clearTimeout(timer);
  }, [i, many, paused, slides.length]);
  if (!slides.length) return null;
  return (
    <section id="sec-hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} className="hero relative h-[280px] overflow-hidden rounded-b-[2.5rem] border-b-[3px] border-accent bg-secondary shadow-lift md:h-[440px]" aria-roledescription="carousel">
      {slides.map((sl, k) => {
        const on = k === i;
        return (
          <div key={k} aria-hidden={!on} className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${on ? 'hero-in opacity-100' : 'pointer-events-none opacity-0'}`}>
            <div className="absolute inset-0">
              <FitImage src={sl.image} cover />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-secondary/95 via-secondary/35 to-secondary/5" />
            <div className="absolute inset-0 bg-gradient-to-r from-secondary/50 via-transparent to-transparent rtl:bg-gradient-to-l" />
            <div className="corner-light absolute inset-0 rtl:-scale-x-100" aria-hidden="true" />
            <div className="dots absolute inset-x-0 bottom-0 h-2/3" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-6 pb-12 text-white md:px-12 md:pb-16">
              <div className="hero-desc mb-4 h-1 w-14 rounded-full bg-accent" aria-hidden="true" />
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
        );
      })}
      <div className="sheen" aria-hidden="true" />
      <div className="edge-glow pointer-events-none absolute inset-x-0 bottom-0" aria-hidden="true" />
      {many && (
        <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex max-w-7xl gap-2 px-6 pb-5 md:px-12" role="tablist">
          {slides.map((_, k) => (
            <button key={k} type="button" role="tab" aria-selected={k === i} aria-label={`slide ${k + 1}`} onClick={() => setI(k)} className="h-5 flex-1 py-2">
              <span className="block h-1 overflow-hidden rounded-full bg-white/25">
                {k < i && <span className="block h-full w-full bg-white" />}
                {k === i && <span key={`${i}-${slides.length}`} className="seg-fill block h-full bg-accent" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Round carousel arrow on the physical left / right edge (an SVG, so the browser never mirrors it in RTL). */
function Arrow({ side, onClick, label, below = false, disabled = false }: { side: 'left' | 'right'; onClick: () => void; label: string; below?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={below
        ? 'flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-card transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-40'
        : `absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-secondary/60 text-white ring-1 ring-accent/50 transition hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-40 ${side === 'left' ? 'left-3' : 'right-3'}`}
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
      className="relative h-60 overflow-hidden rounded-3xl bg-secondary shadow-lift ring-2 ring-accent/60 md:h-80"
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
          <div className="absolute inset-0 bg-gradient-to-t from-secondary/90 via-secondary/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 pb-10 text-white md:p-8 md:pb-12">
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-secondary">{x.mainCategory}</span>
            <h3 className="mt-2 line-clamp-2 max-w-3xl pb-1.5 text-lg font-bold leading-[1.7] md:text-2xl md:leading-[1.6]">{x.title}</h3>
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

/** Team: up to six random members (picked by the API on every load), with three picture-only cards visible. */
export function TeamSlider({ items }: { items: Card[] }) {
  const { dir, t } = useI18n();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(0);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setViewW(element.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const gap = 16;
  const perView = 3;
  const n = items.length;
  const slides = n > perView;
  const max = Math.max(0, n - perView);
  useEffect(() => { if (i > max) setI(max); }, [i, max]);
  useEffect(() => {
    if (!slides || paused || i >= max) return;
    const id = setInterval(() => setI((v) => Math.min(v + 1, max)), 3000);
    return () => clearInterval(id);
  }, [slides, paused, i, max]);
  if (!n) return null;
  const rtl = dir === 'rtl';
  const size = Math.min(120, Math.max(64, (viewW - (perView - 1) * gap) / perView));
  const frameW = perView * size + (perView - 1) * gap;
  const go = (d: number) => setI((v) => Math.max(0, Math.min(v + d, max)));
  return (
    <div className="mx-auto w-full max-w-5xl" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} role="region" aria-roledescription="carousel">
      <div ref={viewport} className="w-full py-1">
        <div className="flex justify-center">
          <div className="overflow-hidden" style={{ width: frameW }}>
            <div className={`flex transition-transform duration-500 ease-in-out ${slides ? '' : 'justify-center'}`} style={{ gap, transform: `translateX(${(rtl ? 1 : -1) * i * (size + gap)}px)` }}>
              {items.map((m) => (
                <div key={m.id} title={m.title} style={{ width: size, height: size }} className="shrink-0 overflow-hidden rounded-full border-2 border-white bg-white shadow-card ring-2 ring-accent/70">
                  {m.images[0] ? <img src={fileUrl(m.images[0])} alt={m.title} loading="lazy" className="h-full w-full rounded-full object-cover" /> : <DefaultAvatar className="h-full w-full rounded-full" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {slides && (
        <div dir="ltr" className="mt-5 flex justify-center gap-4">
          <Arrow below side="left" disabled={rtl ? i === max : i === 0} onClick={() => go(rtl ? 1 : -1)} label={rtl ? t('app.next') : t('app.prev')} />
          <Arrow below side="right" disabled={rtl ? i === 0 : i === max} onClick={() => go(rtl ? -1 : 1)} label={rtl ? t('app.prev') : t('app.next')} />
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
    <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((x) => (
        <Link key={x.id} href={href(`/news/view?id=${x.id}`)} className="group block rounded-2xl bg-white p-7 text-center shadow-card ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:shadow-lift">
          {x.images[0] ? (
            <img src={fileUrl(x.images[0])} alt="" className="mx-auto mb-5 h-16 w-16 object-contain" />
          ) : (
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/25 text-primary transition duration-300 group-hover:rotate-6 group-hover:from-primary group-hover:to-primary group-hover:text-white" aria-hidden>
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

export function Testimonials({ items }: { items: Card[] }) {
  if (!items.length) return null;
  return (
    <div className="grid content-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((x) => (
        <div key={x.id} className="relative rounded-2xl bg-white p-6 text-ink shadow-card ring-1 ring-line">
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
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary via-secondary to-primary p-4 shadow-card md:p-4">
      <div className="grid-lines pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="sheen" aria-hidden="true" />
      <Stagger className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((x) => (
          <div key={x.id} className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.07] px-4 py-4 text-center text-white ring-1 ring-accent/40 backdrop-blur-sm">
            <CountUp value={x.excerpt || x.subject || ''} className="break-words font-display text-lg font-extrabold leading-tight text-[#ecdcb8] md:text-xl" />
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

/** Home: a short card that opens the contact page (the full details and the form moved to /contact). */
export function ContactTeaser() {
  const { t, href } = useI18n();
  const { s } = useSite();
  const phone = s('contact', 'phone');
  const email = s('contact', 'email');
  return (
    <Reveal className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center shadow-card ring-1 ring-line md:flex-row md:justify-between md:text-start">
      <div>
        <p className="text-sm leading-7 text-gray-700">{t('ct.teaser')}</p>
        {(phone || email) && (
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm font-semibold text-secondary md:justify-start">
            {phone && <a href={telHref(phone)} className="hover:text-primary"><bdi dir="ltr">{phone}</bdi></a>}
            {email && <a href={`mailto:${email}`} className="hover:text-primary"><bdi dir="ltr">{email}</bdi></a>}
          </p>
        )}
      </div>
      <Link href={href('/contact')} className="shrink-0 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-card transition hover:-translate-y-px hover:shadow-lift">{t('ct.open')}</Link>
    </Reveal>
  );
}

export function ContactSection() {
  const { t } = useI18n();
  const { s, loc } = useSite();
  const [mapOpen, setMapOpen] = useState(false);
  // label, text, icon, always left-to-right (numbers / email / url), optional link
  type Row = { label: string; value: string | null; icon: 'phone' | 'mobile' | 'fax' | 'email' | 'website' | 'address' | 'hours'; ltr: boolean; link?: string; external?: boolean };
  const phone = s('contact', 'phone');
  const mobile = s('contact', 'mobile');
  const email = s('contact', 'email');
  const website = s('contact', 'website_url');
  const rows: Row[] = [
    { label: t('site.phone'), value: phone, icon: 'phone', ltr: true, link: phone ? telHref(phone) : undefined },
    { label: t('site.mobile'), value: s('contact', 'mobile'), icon: 'mobile', ltr: true, link: mobile ? telHref(mobile) : undefined },
    { label: t('site.fax'), value: s('contact', 'fax'), icon: 'fax', ltr: true },
    { label: t('site.email'), value: email, icon: 'email', ltr: true, link: email ? `mailto:${email}` : undefined },
    { label: t('site.website'), value: website ? prettyUrl(website) : null, icon: 'website', ltr: true, link: website || undefined, external: true },
    { label: t('site.address'), value: loc('contact', 'address'), icon: 'address', ltr: false },
    { label: t('site.hours'), value: loc('contact', 'working_hours'), icon: 'hours', ltr: false },
  ];
  const map = s('contact', 'map_url');
  return (
    <div className="grid items-start gap-5 md:grid-cols-2">
      <Reveal className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
        <ul className="divide-y divide-line">
          {rows.filter((r) => r.value).map((r) => {
            const text = r.ltr ? <bdi dir="ltr">{r.value}</bdi> : r.value;
            return (
              <li key={r.label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ContactIcon name={r.icon} size={16} /></span>
                <div className="min-w-0">
                  <div className="text-xs text-gray-500">{r.label}</div>
                  <div className="break-words text-sm font-medium">
                    {r.link ? <a href={r.link} {...(r.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="hover:text-primary hover:underline">{text}</a> : text}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {map && (
          <button type="button" onClick={() => setMapOpen(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 active:scale-[0.97]">
            <ContactIcon name="address" size={16} />{t('site.showMap')}
          </button>
        )}
      </Reveal>
      <Reveal className="self-start rounded-2xl bg-white p-5 shadow-card ring-1 ring-line"><ContactForm /></Reveal>
      {map && (
        <Modal open={mapOpen} onClose={() => setMapOpen(false)} title={t('site.map')} wide>
          <iframe src={map} title={t('site.map')} loading="lazy" className="h-[60vh] w-full rounded-lg border-0" />
        </Modal>
      )}
    </div>
  );
}
