'use client';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate, fmtDay } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { Thumb } from './cards';
import { EventCard, PublicEvent, participationLabel, timeRange } from './events-hub';
import { ImageSlider } from './image-slider';
import { NotFoundContent } from './not-found-content';
import { YoutubeEmbed } from './youtube-embed';

interface EventNews { id: number; title: string; excerpt: string; image: string | null; publishAt: string | null; kind: string }
interface Detail extends PublicEvent {
  description: string; videos: string[]; coverage: { title: string; url: string; source: string }[];
  parent: { id: number; title: string } | null; related: PublicEvent[]; news: EventNews[];
}
type Section = 'overview' | 'news' | 'visits' | 'activities' | 'media' | 'coverage';

function NewsList({ items }: { items: EventNews[] }) {
  const { lang, href } = useI18n();
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((n) => (
        <li key={n.id}>
          <Link href={href(`/news/view?id=${n.id}`)} className="group flex h-full gap-3 overflow-hidden rounded-2xl bg-white p-3 shadow-card ring-1 ring-line transition hover:ring-accent">
            <Thumb src={n.image} alt={n.title} className="h-20 w-28 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <h4 className="line-clamp-2 text-sm font-bold group-hover:text-primary">{n.title}</h4>
              {n.publishAt && <p className="mt-1 text-xs text-gray-500">{fmtDate(lang, n.publishAt)}</p>}
              {n.excerpt && <p className="mt-1 line-clamp-2 text-xs text-gray-600">{n.excerpt}</p>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function View() {
  const { lang, href } = useI18n();
  const ar = lang === 'ar';
  const id = useSearchParams().get('id');
  const [d, setD] = useState<Detail | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');
  const [section, setSection] = useState<Section>('overview');

  useEffect(() => {
    if (!id || !/^\d+$/.test(id)) { setState('404'); return; }
    setState('load'); setSection('overview');
    api<Detail>(`/public/occasions/${id}`, { params: { lang }, cache: 'no-store' }).then((r) => { setD(r); setState('ok'); }).catch(() => setState('404'));
  }, [id, lang]);

  const groups = useMemo(() => {
    const of = (...kinds: string[]) => (d?.news ?? []).filter((n) => kinds.includes(n.kind));
    return { news: of('news'), visits: of('visit', 'meeting'), activities: of('participation', 'activity'), coverage: of('coverage') };
  }, [d]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !d) return <NotFoundContent lang={lang} />;

  const isEx = d.type === 'exhibition';
  const part = participationLabel(d.participation, ar);
  const sections: [Section, string, boolean][] = [
    ['overview', ar ? 'نظرة عامة' : 'Overview', true],
    ['news', ar ? 'الأخبار' : 'News', groups.news.length > 0],
    ['visits', ar ? 'الزيارات واللقاءات' : 'Visits & meetings', groups.visits.length > 0],
    ['activities', isEx ? (ar ? 'المشاركات والفعاليات' : 'Participations & events') : (ar ? 'الأنشطة والفعاليات' : 'Activities & events'), groups.activities.length > 0 || d.related.length > 0],
    ['media', ar ? 'الصور والفيديو' : 'Photos & video', d.images.length > 0 || d.videos.length > 0],
    ['coverage', ar ? 'التغطية الإعلامية' : 'Media coverage', groups.coverage.length > 0 || d.coverage.length > 0],
  ];
  const info: [string, string][] = [
    [ar ? 'التاريخ' : 'Date', `${fmtDay(lang, d.date)}${d.finishDate !== d.date ? ` — ${fmtDay(lang, d.finishDate)}` : ''}`],
    [ar ? 'الوقت' : 'Time', timeRange(d)],
    [ar ? 'القطاع' : 'Sector', d.sector],
    [ar ? 'الجهة المنظمة' : 'Organizer', d.organizer],
    [ar ? 'نوع المشاركة' : 'Participation', part],
    [ar ? 'المكان' : 'Place', d.location],
    [ar ? 'الفئة المستهدفة' : 'Target audience', d.audience],
    [ar ? 'التسجيل' : 'Registration', d.registrationUrl ? '' : d.registrationNote],
  ];
  const statusText = d.status === 'upcoming' ? (ar ? 'قادم' : 'Upcoming') : d.status === 'current' ? (ar ? 'جارٍ الآن' : 'Happening now') : (ar ? 'سابق' : 'Previous');

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav className="mb-3 text-sm"><Link href={href(`/occasions?tab=${isEx ? 'exhibitions' : 'occasions'}`)} className="text-primary">← {ar ? 'المعارض والفعاليات' : 'Exhibitions & events'}</Link></nav>
      <article className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-line md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${isEx ? 'bg-accent/25 text-secondary' : 'bg-primary/10 text-primary'}`}>{isEx ? (ar ? 'معرض' : 'Exhibition') : (ar ? 'مناسبة' : 'Occasion')}</span>
          <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-semibold text-gray-700">{statusText}</span>
          {part && <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-semibold text-gray-700">{part}</span>}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold leading-snug md:text-3xl">{d.title}</h1>
        {d.parent && <p className="mt-2 text-sm text-gray-600">{ar ? 'ضمن المعرض: ' : 'Part of: '}<Link href={href(`/occasions/view?id=${d.parent.id}`)} className="font-semibold text-primary">{d.parent.title}</Link></p>}
        <div role="tablist" aria-label={ar ? 'أقسام' : 'Sections'} className="mt-6 flex flex-wrap gap-1.5 border-b border-line pb-3">
          {sections.filter((x) => x[2]).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => setSection(key)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${section === key ? 'bg-secondary text-white' : 'text-secondary hover:bg-gray-100'}`}>{label}</button>
          ))}
        </div>
        <div className="mt-6" role="tabpanel">
          {section === 'overview' && (
            <div className="space-y-6">
              {d.images.length > 0 && <ImageSlider images={d.images} title={d.title} />}
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {info.filter(([, v]) => v).map(([k, v]) => <div key={k} className="rounded-xl bg-gray-50 px-4 py-3"><dt className="text-xs font-semibold text-gray-500">{k}</dt><dd className="mt-0.5 font-bold text-secondary">{v}</dd></div>)}
              </dl>
              {d.registrationUrl && d.status !== 'previous' && (
                <div className="flex flex-wrap items-center gap-3">
                  <a href={d.registrationUrl} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110">{ar ? 'سجّل الآن' : 'Register now'}</a>
                  {d.registrationNote && <span className="text-sm text-gray-600">{d.registrationNote}</span>}
                </div>
              )}
              {d.description && <p className="whitespace-pre-line text-[15px] leading-8 text-gray-800">{d.description}</p>}
            </div>
          )}
          {section === 'news' && <NewsList items={groups.news} />}
          {section === 'visits' && <NewsList items={groups.visits} />}
          {section === 'activities' && (
            <div className="space-y-6">
              {d.related.length > 0 && (
                <div>
                  <h2 className="mb-3 text-lg font-bold text-secondary">{ar ? 'الفعاليات المرتبطة' : 'Related events'}</h2>
                  <ul className="grid gap-4 sm:grid-cols-2">{d.related.map((e) => <li key={e.id} className="flex"><div className="flex w-full flex-col [&>a]:flex-1"><EventCard event={e} /></div></li>)}</ul>
                </div>
              )}
              {groups.activities.length > 0 && <NewsList items={groups.activities} />}
            </div>
          )}
          {section === 'media' && (
            <div>
              {d.videos.map((v) => <YoutubeEmbed key={v} id={v} title={d.title} />)}
              {d.images.length > 0 && <div className="mt-8"><ImageSlider images={d.images} title={d.title} /></div>}
            </div>
          )}
          {section === 'coverage' && (
            <div className="space-y-6">
              {groups.coverage.length > 0 && <NewsList items={groups.coverage} />}
              {d.coverage.length > 0 && (
                <ul className="divide-y rounded-2xl ring-1 ring-line">
                  {d.coverage.map((c) => (
                    <li key={c.url}><a href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                      <span className="font-semibold text-secondary">{c.title || c.url}</span>
                      {c.source && <span className="shrink-0 text-xs text-gray-500">{c.source} ↗</span>}
                    </a></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

/** Detail page of an exhibition or an occasion: overview, then tabs for news, visits & meetings, participations & events, photos & video, media coverage. */
export function EventDetail() {
  return <Suspense fallback={<Center><Spinner /></Center>}><View /></Suspense>;
}
