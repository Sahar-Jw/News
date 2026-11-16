'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { HUBS, hubUrl, normalizeNavUrl, resolveHub } from '@/lib/hubs-meta';
import { Center, Spinner } from '@/components/ui/ui';
import { RequirePerm } from '@/components/admin/guard';
import { SettingsEditor } from '@/components/admin/settings-editor';
import { AdsAdmin } from '@/components/admin/ads-admin';
import { AppointmentsAdmin } from '@/components/admin/appointments-admin';
import { BoardAdmin } from '@/components/admin/board-admin';
import { CommitteesAdmin } from '@/components/admin/committees-admin';
import { CoursesAdmin } from '@/components/admin/courses-admin';
import { CustomersAdmin } from '@/components/admin/customers-admin';
import { DatesDashboard } from '@/components/admin/dates-dashboard';
import { DocumentsAdmin } from '@/components/admin/documents-admin';
import { ExpoAdmin } from '@/components/admin/expo-admin';
import { ExpoSettingsAdmin } from '@/components/admin/expo-settings-admin';
import { FaqsAdmin } from '@/components/admin/faqs-admin';
import { StatisticsAdmin } from '@/components/admin/statistics-admin';
import { FooterAdmin } from '@/components/admin/footer-admin';
import { GalleryAdmin } from '@/components/admin/gallery-admin';
import { G2tContent, G2tPackages, G2tSpaces } from '@/components/admin/get2trade-admin';
import { IncubatorProjectsAdmin } from '@/components/admin/incubator-projects-admin';
import { MediaNewsAdmin } from '@/components/admin/media-news-admin';
import { MembershipContent } from '@/components/admin/membership-admin';
import { NavAdmin } from '@/components/admin/nav-admin';
import { OccasionsAdmin } from '@/components/admin/occasions-admin';
import { PagesAdmin } from '@/components/admin/pages-admin';
import { ScheduleAdmin } from '@/components/admin/schedule-admin';
import { ServicesAdmin } from '@/components/admin/services-admin';
import { SubscribersAdmin } from '@/components/admin/subscribers-admin';
import { BackupsAdmin, FormSubmissionsAdmin, FormsBuilderAdmin } from '@/components/admin/forms-admin';
import { TrainersAdmin } from '@/components/admin/trainers-admin';
import { WomenMenuAdmin } from '@/components/admin/women-menu-admin';

/** what each tab shows: "<hub>.<tab>" (the data about hubs and tabs - names, permissions - lives in lib/hubs-meta.ts) */
const SCREENS: Record<string, () => React.ReactNode> = {
  'training.courses': () => <CoursesAdmin />, 'training.trainers': () => <TrainersAdmin />, 'training.trainees': () => <FormSubmissionsAdmin slugs={['course-registration']} />, 'training.trainerApps': () => <FormSubmissionsAdmin slugs={['trainer-application']} />,
  'expo.exhibitors': () => <ExpoAdmin kind="exhibitor" />, 'expo.sponsors': () => <ExpoAdmin kind="sponsor" />, 'expo.sessions': () => <ExpoAdmin kind="session" />, 'expo.applications': () => <FormSubmissionsAdmin slugs={['expo-exhibitor', 'expo-visitor', 'expo-info']} />,
  'home.statistics': () => <StatisticsAdmin />,
  'expo.faqs': () => <FaqsAdmin scope="expo" />,
  'expo.links': () => <WomenMenuAdmin site="expo" />,
  'expo.about': () => <ExpoSettingsAdmin section="about" />, 'expo.sectors': () => <ExpoSettingsAdmin section="sectors" />, 'expo.info': () => <ExpoSettingsAdmin section="info" />,
  'expo.contact': () => <ExpoSettingsAdmin section="contact" />, 'expo.identity': () => <ExpoSettingsAdmin section="identity" />,
  'services.messages': () => <FormSubmissionsAdmin slugs={['contact-one-stop']} />, 'women.messages': () => <FormSubmissionsAdmin slugs={['contact-women']} />,
  'membership.services': () => <ServicesAdmin />, 'membership.applications': () => <FormSubmissionsAdmin slugs={['membership']} />, 'membership.content': () => <MembershipContent />,
  'incubator.projects': () => <IncubatorProjectsAdmin />, 'incubator.applications': () => <FormSubmissionsAdmin slugs={['incubator-application']} />,
  'get2trade.bookings': () => <FormSubmissionsAdmin slugs={['get2trade-booking', 'get2trade-inquiry']} />, 'get2trade.spaces': () => <G2tSpaces />, 'get2trade.packages': () => <G2tPackages />, 'get2trade.content': () => <G2tContent />,
  'services.services': () => <ServicesAdmin />, 'services.hours': () => <ScheduleAdmin />, 'services.dates': () => <AppointmentsAdmin />, 'services.dashboard': () => <DatesDashboard />, 'services.customers': () => <CustomersAdmin />,
  'documents.documents': () => <DocumentsAdmin />, 'library.library': () => <DocumentsAdmin kind="library" />, 'board.board': () => <BoardAdmin />, 'committees.committees': () => <CommitteesAdmin kind="sector" />,
  'media.news': () => <MediaNewsAdmin />, 'gallery.gallery': () => <GalleryAdmin />,
  'occasions.events': () => <OccasionsAdmin view="events" />, 'agenda.events': () => <OccasionsAdmin view="agenda" />,
  'women.content': () => <CommitteesAdmin kind="women" />,
  'women.links': () => <WomenMenuAdmin />,
  'about.about': () => <PagesAdmin slug="about" />, 'privacy.privacy': () => <PagesAdmin slug="privacy" />, 'terms.terms': () => <PagesAdmin slug="terms" />, 'faq.faqs': () => <FaqsAdmin />,
  'subscribers.subscribers': () => <SubscribersAdmin />, 'ads.ads': () => <AdsAdmin />,
  'forms.builder': () => <FormsBuilderAdmin />, 'backups.backups': () => <BackupsAdmin />,
  'identity.footer': () => <FooterAdmin />, 'identity.menu': () => <NavAdmin />,
};

/**
 * Settings hub: pick a page of the site, then work in its tabs (courses / trainers / trainees ..., page texts). The address keeps the
 * choice (?page=training&tab=courses), so a tab can be bookmarked. Users see only the pages and tabs they hold permissions for.
 */
function Hub() {
  const { t, lang, href } = useI18n();
  const { can } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const ar = lang === 'ar';

  // an old link (?page=pages&tab=faqs ...) opens the entry that holds that tab now
  const rawPage = sp.get('page');
  useEffect(() => {
    const r = rawPage ? resolveHub(rawPage, sp.get('tab') ?? undefined) : null;
    if (r) { const q = new URLSearchParams(sp.toString()); q.set('page', r.hub); if (r.tab) q.set('tab', r.tab); router.replace(href(`/admin/settings?${q.toString()}`)); }
  }, [rawPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // every entry is named like its page in the main menu (Arabic and English): rename the menu item and the entry follows
  const [menuNames, setMenuNames] = useState<Record<string, { ar?: string; en?: string }>>({});
  useEffect(() => {
    const load = (l: 'ar' | 'en') => api<{ items: { title: string; url: string }[] }[]>('/public/nav', { params: { lang: l }, cache: 'no-store' }).catch(() => []);
    Promise.all([load('ar'), load('en')]).then(([a, e]) => {
      const m: Record<string, { ar?: string; en?: string }> = {};
      a.forEach((g) => g.items.forEach((i) => { (m[normalizeNavUrl(i.url)] ??= {}).ar = i.title; }));
      e.forEach((g) => g.items.forEach((i) => { (m[normalizeNavUrl(i.url)] ??= {}).en = i.title; }));
      setMenuNames(m);
    });
  }, []);
  const named = (h: (typeof HUBS)[number]) => {
    const hit = h.nav?.map((u) => menuNames[normalizeNavUrl(u)]).find(Boolean);
    return { ...h, ar: hit?.ar || h.ar, en: hit?.en || h.en };
  };

  const hubs = HUBS.map((h) => named({ ...h, tabs: h.tabs.filter((x) => can(...x.perms)) })).filter((h) => h.tabs.length > 0);
  if (hubs.length === 0) return <Center>{t('adm.noAccess')}</Center>;

  const hub = hubs.find((h) => h.key === sp.get('page'));
  const tab = hub ? hub.tabs.find((x) => x.key === sp.get('tab')) ?? hub.tabs[0] : undefined;
  const go = (url: string) => router.push(href(url));

  const content = () => {
    if (!hub || !tab) return null;
    if (tab.settingsGroups) return <SettingsEditor groups={tab.settingsGroups.length ? tab.settingsGroups : undefined} />;
    return SCREENS[`${hub.key}.${tab.key}`]?.() ?? null;
  };

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold">{t('adm.settings')}</h1>
      <p className="mb-5 text-sm text-gray-500">{ar ? 'لكل صفحة من صفحات الموقع إعداداتها الخاصة، باسمها نفسه في القائمة الرئيسية.' : 'Every page of the site has its own settings, named exactly like the page in the main menu.'}</p>

      {!hub ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {hubs.map((h) => (
            <button key={h.key} type="button" onClick={() => go(hubUrl(h.key))} className="rounded-2xl bg-white p-4 text-start shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-primary">
              <span className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: `${h.color}22`, color: h.color }} aria-hidden="true">{h.icon}</span>
                <span className="min-w-0"><span className="block truncate font-bold text-secondary">{ar ? h.ar : h.en}</span><span className="block text-xs text-gray-500">{h.tabs.length} {ar ? 'تبويب' : h.tabs.length === 1 ? 'tab' : 'tabs'}</span></span>
              </span>
              <span className="mt-2 line-clamp-2 block text-xs leading-5 text-gray-600">{ar ? h.hintAr : h.hintEn}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* the other pages, always one click away */}
          <div className="mb-4 flex flex-wrap gap-1.5" role="navigation" aria-label={t('adm.settings')}>
            {hubs.map((h) => (
              <button key={h.key} type="button" onClick={() => go(hubUrl(h.key))} aria-current={h.key === hub.key ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${h.key === hub.key ? 'border-transparent text-white' : 'border-line bg-white text-gray-700 hover:border-primary hover:text-primary'}`}
                style={h.key === hub.key ? { backgroundColor: h.color } : undefined}>
                <span aria-hidden="true">{h.icon}</span>{ar ? h.ar : h.en}
              </button>
            ))}
          </div>

          <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line md:p-6">
            <header className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: `${hub.color}22`, color: hub.color }} aria-hidden="true">{hub.icon}</span>
              <div className="min-w-0"><h2 className="text-xl font-extrabold text-secondary">{ar ? hub.ar : hub.en}</h2><p className="text-xs text-gray-500">{ar ? hub.hintAr : hub.hintEn}</p></div>
            </header>

            {hub.tabs.length > 1 && (
              <div className="mb-5 flex flex-wrap gap-2" role="tablist">
                {hub.tabs.map((x) => (
                  <button key={x.key} type="button" role="tab" aria-selected={x.key === tab?.key} onClick={() => go(hubUrl(hub.key, x.key))}
                    className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${x.key === tab?.key ? 'bg-secondary text-white' : 'bg-primary/10 text-secondary hover:bg-primary/20'}`}>{ar ? x.ar : x.en}</button>
                ))}
              </div>
            )}

            {/* each screen keeps its own permission check; its own title is hidden here because the tab already names it */}
            {tab && <RequirePerm key={`${hub.key}.${tab.key}`} any={tab.perms}><div className="[&_h1]:hidden">{content()}</div></RequirePerm>}
          </section>
        </>
      )}
    </>
  );
}

export default function SettingsPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Hub /></Suspense>;
}
