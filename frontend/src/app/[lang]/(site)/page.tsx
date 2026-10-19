'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { Card } from '@/components/site/cards';
import { BreakingTicker, Company, ContactSection, Experts, FeaturedCarousel, HeroSlider, Partners, RegularNews, SectionWrap, ServicesGrid, StatsRow, TeamSlider, Testimonials } from '@/components/site/home-sections';
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

  useEffect(() => {
    setHome(null);
    api<Home>('/public/home', { params: { lang }, cache: 'no-store' }).then(setHome).catch((e) => setErr(e.message));
  }, [lang]);

  // jump to #sec-x after the async content has rendered
  useEffect(() => {
    if (home && location.hash) document.querySelector(location.hash)?.scrollIntoView();
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
      case 'contact': return <SectionWrap key={k} code={k} title={title(k)}><ContactSection /></SectionWrap>;
      default: return null;
    }
  };

  return (
    <>
      <BreakingTicker items={home.breaking} />
      {order.map(render)}
    </>
  );
}
