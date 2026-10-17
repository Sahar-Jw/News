'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Stars } from '@/components/ui/ui';
import { Card, NewsCard, Thumb } from './cards';
import { ContactForm } from './contact-form';
import { useSite } from './site-context';

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

export function BreakingTicker({ items }: { items: Card[] }) {
  const { t, href } = useI18n();
  if (!items.length) return null;
  return (
    <div className="no-print flex items-center overflow-hidden bg-red-600 text-white">
      <span className="z-10 shrink-0 bg-red-800 px-4 py-2 text-sm font-bold">{t('site.breaking')}</span>
      <div className="relative flex-1 overflow-hidden">
        <div className="ticker-track flex w-max animate-ticker whitespace-nowrap">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 gap-10 py-2 ps-6">
              {items.map((n) => (
                <Link key={`${n.id}-${copy}`} href={href(`/news/view?id=${n.id}`)} className="text-sm hover:underline">● {n.title}</Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
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
          {sl.image && <img src={sl.image} alt="" className="h-full w-full object-cover" />}
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

export function FeaturedGrid({ items }: { items: Card[] }) {
  const { href } = useI18n();
  if (!items.length) return null;
  const [first, ...rest] = items;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Link href={href(`/news/view?id=${first.id}`)} className="group relative block min-h-72 overflow-hidden rounded-xl">
        <Thumb src={first.images[0]} className="absolute inset-0 h-full w-full transition group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <span className="rounded bg-primary px-2 py-0.5 text-xs">{first.mainCategory}</span>
          <h3 className="mt-2 text-xl font-bold leading-snug">{first.title}</h3>
          {first.subject && <p className="mt-1 text-sm text-gray-200">{first.subject}</p>}
        </div>
      </Link>
      <div className="grid gap-4 sm:grid-cols-2">
        {rest.map((n) => (
          <Link key={n.id} href={href(`/news/view?id=${n.id}`)} className="group relative block min-h-36 overflow-hidden rounded-xl">
            <Thumb src={n.images[0]} className="absolute inset-0 h-full w-full transition group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <h3 className="absolute inset-x-0 bottom-0 line-clamp-2 p-3 text-sm font-bold text-white">{n.title}</h3>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function RegularNews({ items }: { items: Card[] }) {
  const { t } = useI18n();
  if (!items.length) return <p className="text-gray-500">{t('site.noNews')}</p>;
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{items.map((n) => <NewsCard key={n.id} n={n} />)}</div>;
}

/** Random six team members, photo first, shown in a sliding strip. */
export function TeamSlider({ items }: { items: Card[] }) {
  const [start, setStart] = useState(0);
  const perView = 4;
  useEffect(() => {
    if (items.length <= perView) return;
    const id = setInterval(() => setStart((v) => (v + 1) % items.length), 3500);
    return () => clearInterval(id);
  }, [items.length]);
  if (!items.length) return null;
  const visible = items.length <= perView ? items : Array.from({ length: perView }, (_, k) => items[(start + k) % items.length]);
  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
      {visible.map((m) => (
        <div key={m.id} className="overflow-hidden rounded-xl border bg-white text-center shadow-sm">
          <Thumb src={m.images[0]} className="aspect-square w-full" alt={m.title} />
          <div className="p-3">
            <div className="font-bold">{m.title}</div>
            {m.subject && <div className="text-sm text-gray-500">{m.subject}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ServicesGrid({ items }: { items: Card[] }) {
  if (!items.length) return null;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((x) => (
        <div key={x.id} className="rounded-xl border bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md">
          {x.images[0] ? <img src={fileUrl(x.images[0])} alt="" className="mx-auto mb-4 h-16 w-16 object-contain" /> : <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl text-primary">✦</div>}
          <h3 className="mb-2 text-lg font-bold">{x.title}</h3>
          <p className="text-sm leading-7 text-gray-600">{x.excerpt || x.subject}</p>
        </div>
      ))}
    </div>
  );
}

export function Testimonials({ items }: { items: Card[] }) {
  const { s } = useSite();
  const fb = s('social', 'facebook_page_url');
  if (!items.length && !fb) return null;
  return (
    <div className={`grid gap-5 ${fb ? 'lg:grid-cols-3' : ''}`}>
      <div className={`grid gap-5 sm:grid-cols-2 ${fb ? 'lg:col-span-2' : 'lg:grid-cols-3'}`}>
        {items.map((x) => (
          <div key={x.id} className="rounded-xl border bg-white p-5 shadow-sm">
            <Stars value={x.rating} />
            <h4 className="mt-2 font-bold">{x.title}</h4>
            <p className="mt-2 text-sm leading-7 text-gray-600">{x.excerpt}</p>
            <div className="mt-4 flex items-center gap-3">
              <Thumb src={x.images[0]} className="h-10 w-10 rounded-full" />
              <span className="text-sm text-gray-500">{x.subject}</span>
            </div>
          </div>
        ))}
      </div>
      {fb && (
        <iframe title="facebook" className="h-[500px] w-full rounded-xl border" loading="lazy" src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(fb)}&tabs=timeline&width=340&height=500&small_header=true`} />
      )}
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
