'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, onSiteChange } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { Card } from '@/components/site/cards';
import { BreakingTicker, Company, ContactSection, Experts, FeaturedCarousel, HeroSlider, Partners, RegularNews, SectionWrap, ServicesGrid, StatsRow, SubscribeSection, TeamSlider, Testimonials } from '@/components/site/home-sections';
import { AdMiddle } from '@/components/site/ad-slot';
import { SECTION_ORDER_KEYS } from '@/components/site/sections-meta';
import { useSite } from '@/components/site/site-context';

interface Home {
  breaking: Card[]; featured: Card[]; news: Card[]; team: Card[]; services: Card[]; testimonials: Card[];
  partners: { id: number; title: string; logo: string }[]; experts: Card[]; statistics: Card[]; company: Card[];
}

export default function HomePage() {
  const { lang, t, href } = useI18n();
  const { settings, loc, ready } = useSite();
  const [home, setHome] = useState<Home | null>(null);
  const [err, setErr] = useState('');

  const jumped = useRef(false);

  const load = useCallback((silent: boolean) => {
    if (!silent) setHome(null);
    return api<Home>('/public/home', { params: { lang }, cache: 'no-store' })
      .then((h) => { setHome(h); setErr(''); })
      .catch((e) => { if (!silent) setErr(e.message); }); // a failed background refresh keeps what is on screen
  }, [lang]);

  useEffect(() => { jumped.current = false; void load(false); }, [load]);

  // live updates: after an admin change (this tab or another) and when the tab regains focus, reload quietly (no spinner)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => void load(true), 250); };
    const off = onSiteChange(soon);
    window.addEventListener('focus', soon);
    return () => { clearTimeout(timer); off(); window.removeEventListener('focus', soon); };
  }, [load]);

  // jump to #sec-x once, after the async content has rendered (not again on every background refresh)
  useEffect(() => {
    if (home && !jumped.current) {
      jumped.current = true;
      if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
    }
  }, [home]);

  if (err) return <Center>{err}</Center>;
  if (!home || !ready) return <Center><Spinner /></Center>;

  const sh = settings.sections_home ?? {};
  const order = [...SECTION_ORDER_KEYS].filter((k) => sh[`${k}_visible`] !== false).sort((a, b) => (sh[`${a}_order`] ?? 99) - (sh[`${b}_order`] ?? 99));
  const title = (k: string) => loc('sections_home', `${k}_title`) || t(`sec.${k}`);

  const render = (k: string) => {
    switch (k) {
      case 'hero': return <HeroSlider key={k} />;
      case 'featured': return home.featured.length ? <SectionWrap key={k} code={k} title={title(k)}><FeaturedCarousel items={home.featured} /></SectionWrap> : null;
      case 'news': return <SectionWrap key={k} code={k} title={title(k)} action={<Link href={href('/news')} className="text-sm font-semibold text-primary">{t('site.allNews')} →</Link>}><RegularNews items={home.news} /></SectionWrap>;
      case 'team': return home.team.length ? <SectionWrap key={k} code={k} title={title(k)}><TeamSlider items={home.team} /></SectionWrap> : null;
      case 'services': return home.services.length ? <SectionWrap key={k} code={k} title={title(k)}><ServicesGrid items={home.services} /></SectionWrap> : null;
      case 'testimonials': return <SectionWrap key={k} code={k} title={title(k)}><Testimonials items={home.testimonials} /></SectionWrap>;
      case 'partners': return home.partners.length ? <SectionWrap key={k} code={k} title={title(k)}><Partners items={home.partners} /></SectionWrap> : null;
      case 'experts': return home.experts.length ? <SectionWrap key={k} code={k} title={title(k)}><Experts items={home.experts} /></SectionWrap> : null;
      case 'statistics': return home.statistics.length ? <SectionWrap key={k} code={k} title={title(k)}><StatsRow items={home.statistics} /></SectionWrap> : null;
      case 'company': return home.company.length ? <SectionWrap key={k} code={k} title={title(k)}><Company items={home.company} /></SectionWrap> : null;
      case 'subscribe': return <SectionWrap key={k} code={k} title={title(k)} compact><SubscribeSection /></SectionWrap>;
      case 'contact': return <SectionWrap key={k} code={k} title={title(k)}><ContactSection /></SectionWrap>;
      default: return null;
    }
  };

  // the bronze ads go halfway down the page
  const sections = order.map(render).filter(Boolean);
  const middle = Math.ceil(sections.length / 2);

  return (
    <>
      <BreakingTicker items={home.breaking} />
      {sections.slice(0, middle)}
      <AdMiddle />
      {sections.slice(middle)}
    </>
  );
}
