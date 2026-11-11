'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate, fmtDay, fmtNum } from '@/lib/utils';
import { Card, NewsCard } from '@/components/site/cards';
import { FloorPlanMap, Heading, SESSION_TYPES, SponsorTiers, sessionTypeLabel, useExpoData, useExpoInfo } from '@/components/site/expo-shared';

/** DCC EXPO home (wireframe page 14): hero, stat tiles, about / why, programme, exhibitors, sponsors, news. */
export default function ExpoHome() {
  const { lang, t, href } = useI18n();
  const x = useExpoInfo();
  const data = useExpoData();
  const [news, setNews] = useState<Card[]>([]);
  useEffect(() => {
    if (!x.newsTopic) return setNews([]);
    api<{ data: Card[] }>('/public/news', { params: { lang, topics: x.newsTopic, limit: 3 } }).then((r) => setNews(r.data)).catch(() => setNews([]));
  }, [lang, x.newsTopic]);

  const stats: [string, string][] = [
    [data ? fmtNum(lang, data.exhibitors.length) : '…', t('ex.stat.exhibitors')],
    [data ? fmtNum(lang, data.sectors.length) : '…', t('ex.stat.sectors')],
    [data ? fmtNum(lang, data.sessions.length) : '…', t('ex.stat.sessions')],
    [x.phase === 'upcoming' && x.daysLeft != null ? fmtNum(lang, x.daysLeft) : x.phase === 'live' ? '●' : '—', x.phase === 'live' ? t('ex.live') : x.phase === 'ended' ? t('ex.ended') : t('ex.stat.daysLeft')],
  ];
  const why = x.lines('why');
  const about = x.L('about');
  const sessions = (data?.sessions ?? []).slice(0, 4);
  const exhibitors = (data?.exhibitors ?? []).slice(0, 8);

  return (
    <>
      <section className="relative overflow-hidden bg-secondary text-white" style={x.hero ? { backgroundImage: `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)), url(${x.hero})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        {!x.hero && <div className="absolute inset-0 bg-gradient-to-br from-primary/70 via-secondary to-secondary" aria-hidden="true" />}
        <div className="relative mx-auto max-w-5xl px-4 py-16 text-center md:py-24">
          <div className="text-sm font-bold tracking-[.3em] text-accent">{x.name}</div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">{x.tagline}</h1>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-white/90">
            {x.start && <span>📅 {fmtDay(lang, x.start)}{x.end && x.end !== x.start ? ` — ${fmtDay(lang, x.end)}` : ''}</span>}
            {x.venue && <span>📍 {x.venue}</span>}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {x.registerOpen && <Link href={href('/expo/register?kind=exhibitor')} className="rounded-full bg-accent px-6 py-3 font-extrabold text-secondary shadow-lg transition hover:brightness-110">{t('ex.registerExhibitor')}</Link>}
            {x.registerOpen && <Link href={href('/expo/register?kind=visitor')} className="rounded-full border-2 border-white/70 px-6 py-3 font-bold transition hover:bg-white/15">{t('ex.registerVisitor')}</Link>}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-8 grid max-w-5xl grid-cols-2 gap-3 px-4 md:grid-cols-4" aria-label={t('ex.stats')}>
        {stats.map(([n, l]) => (
          <div key={l} className="rounded-2xl bg-white p-5 text-center shadow-card ring-1 ring-line">
            <div className="text-3xl font-extrabold text-primary">{n}</div>
            <div className="mt-1 text-xs font-semibold text-gray-600">{l}</div>
          </div>
        ))}
      </section>

      {(about || why.length > 0) && (
        <section id="about" className="mx-auto max-w-5xl scroll-mt-20 px-4 pt-14">
          <Heading>{t('ex.about')}</Heading>
          <div className={`grid gap-6 ${why.length ? 'md:grid-cols-2' : ''}`}>
            {about && <p className="whitespace-pre-line rounded-2xl bg-white p-6 text-sm leading-8 text-gray-700 shadow-card ring-1 ring-line">{about}</p>}
            {why.length > 0 && (
              <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-line">
                <h3 className="mb-3 font-extrabold text-primary">{t('ex.why')}</h3>
                <ul className="space-y-2 text-sm leading-7 text-gray-700">{why.map((w, i) => <li key={i} className="flex gap-2"><span className="mt-1 text-accent">◆</span><span>{w}</span></li>)}</ul>
              </div>
            )}
          </div>
          <div className="mt-4 text-center"><Link href={href('/expo/about')} className="font-bold text-primary hover:underline">{lang === 'ar' ? 'اقرأ المزيد عن المعرض' : 'Read more about the expo'} →</Link></div>
        </section>
      )}

      {data && data.sectors.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pt-14">
          <Heading>{t('ex.sectors')}</Heading>
          <div className="flex flex-wrap justify-center gap-2">{data.sectors.map((s) => <span key={s} className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">{s}</span>)}</div>
        </section>
      )}

      {sessions.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pt-14">
          <Heading>{t('ex.programme')}</Heading>
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
                <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white">{s.startsAt ? fmtDate(lang, s.startsAt, true) : '—'}</span>
                <span className="font-bold text-secondary">{s.name}</span>
                <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-[11px] font-bold text-secondary">{sessionTypeLabel(s.type, lang === 'ar') ?? t(`ex.type.${(SESSION_TYPES as readonly string[]).includes(s.type) ? s.type : 'other'}`)}</span>
                {s.hall && <span className="text-xs text-gray-500">📍 {s.hall}</span>}
              </li>
            ))}
          </ul>
          <div className="mt-4 text-center"><Link href={href('/expo/programme')} className="font-bold text-primary hover:underline">{t('ex.fullProgramme')} →</Link></div>
        </section>
      )}

      {(x.floorPlan || x.floorPlanImage) && <section className="mx-auto max-w-5xl px-4 pt-14">
        <Heading>{t('ex.floorPlan')}</Heading>
        {x.floorPlanImage && data ? <FloorPlanMap image={x.floorPlanImage} exhibitors={data.exhibitors} /> : null}
        {x.floorPlan && <div className="mt-3 whitespace-pre-line rounded-2xl bg-white p-6 text-sm leading-7 text-gray-700 shadow-card ring-1 ring-line">{x.floorPlan}</div>}
      </section>}

      {exhibitors.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pt-14">
          <Heading>{t('ex.exhibitors')}</Heading>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {exhibitors.map((e) => (
              <div key={e.id} className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-center shadow-card ring-1 ring-line">
                {e.logoUrl ? <img src={e.logoUrl} alt="" className="h-14 w-full object-contain" /> : <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-xl font-extrabold text-primary">{e.name.slice(0, 1)}</span>}
                <span className="text-sm font-bold text-secondary">{e.name}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center"><Link href={href('/expo/exhibitors')} className="font-bold text-primary hover:underline">{t('ex.allExhibitors')} →</Link></div>
        </section>
      )}

      {data && data.sponsors.length > 0 && (
        <section id="sponsors" className="mx-auto max-w-5xl scroll-mt-20 px-4 pt-14">
          <Heading>{t('ex.sponsors')}</Heading>
          <SponsorTiers sponsors={data.sponsors} />
        </section>
      )}

      {news.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pt-14">
          <Heading>{t('ex.news')}</Heading>
          <div className="grid gap-4 md:grid-cols-3">{news.map((n) => <NewsCard key={n.id} n={n} />)}</div>
          <div className="mt-4 text-center"><Link href={href('/expo/news')} className="font-bold text-primary hover:underline">{t('tr.moreNews')} →</Link></div>
        </section>
      )}
    </>
  );
}
