// DB-BACKED NUMBERS: not used for now. The statistics service no longer imports this file; it is kept so the real database counts can be switched on again later.
import { DOCUMENT_KIND_LIST, CC, CONTENT_CATEGORY_LABELS, docCode } from '../../common/content-categories';

/** What a metric can read: the content records (FAQ, documents, committees ...) and the database for everything else. */
export interface MetricCtx {
  /** how many ACTIVE content records of one or several types (one COUNT query; `where` narrows it further, written on the news alias `n`) */
  cc: (codes: string | string[], where?: { sql: string; params?: Record<string, unknown> }) => Promise<number>;
  sql: (query: string) => Promise<number>;
  /** published ordinary news, optionally of one language */
  news: (lang?: 'ar' | 'en') => Promise<number>;
}

export interface MetricDef {
  key: string;
  groupAr: string;
  groupEn: string;
  ar: string;
  en: string;
  value: (c: MetricCtx) => Promise<number>;
}

const count = (code: string | string[], where?: { sql: string; params?: Record<string, unknown> }) => (c: MetricCtx) => c.cc(code, where);
const EXHIBITION = { sql: `n.extra ->> 'eventType' = 'exhibition'` };
const OCCASION_ONLY = { sql: `n.extra ->> 'eventType' IS DISTINCT FROM 'exhibition'` };
const today = () => new Date().toISOString().slice(0, 10);

const GROUPS = {
  news: ['الأخبار', 'News'], media: ['الوسائط', 'Media'], docs: ['الوثائق', 'Documents'], events: ['المعارض والمناسبات', 'Exhibitions & occasions'],
  committees: ['اللجان والمجلس', 'Committees & board'], training: ['التدريب', 'Training'], expo: ['DCC EXPO', 'DCC EXPO'], services: ['الخدمات', 'Services'], people: ['الجمهور والطلبات', 'Audience & requests'],
} as const;
const m = (g: keyof typeof GROUPS, key: string, ar: string, en: string, value: MetricDef['value']): MetricDef => ({ key, groupAr: GROUPS[g][0], groupEn: GROUPS[g][1], ar, en, value });
const lbl = (code: string) => CONTENT_CATEGORY_LABELS[code] ?? { ar: code, en: code };

/**
 * The real numbers a statistic can show. Every one is counted from the database when asked (nothing is typed in by hand);
 * only what is published / active counts. Adding a number = adding one line here.
 */
export const METRICS: MetricDef[] = [
  m('news', 'news_published', 'الأخبار المنشورة (كل اللغات)', 'Published news (all languages)', (c) => c.news()),
  m('news', 'news_published_ar', 'الأخبار المنشورة بالعربية', 'Published news in Arabic', (c) => c.news('ar')),
  m('news', 'news_published_en', 'الأخبار المنشورة بالإنجليزية', 'Published news in English', (c) => c.news('en')),
  m('media', 'gallery_albums', 'ألبومات المعرض', 'Gallery albums', (c) => c.sql('SELECT COUNT(*) FROM galleries')),
  m('media', 'gallery_photos', 'الصور في المعرض', 'Gallery photos', (c) => c.sql(`SELECT COALESCE(SUM(jsonb_array_length(images)), 0) FROM galleries WHERE images IS NOT NULL AND jsonb_typeof(images) = 'array'`)),
  m('media', 'gallery_videos', 'الفيديوهات في المعرض', 'Gallery videos', (c) => c.sql('SELECT COUNT(*) FROM galleries WHERE youtube_url IS NOT NULL')),
  m('docs', 'documents_total', 'كل الوثائق', 'All documents', count(DOCUMENT_KIND_LIST.map((k) => docCode(k)))),
  ...DOCUMENT_KIND_LIST.map((k) => m('docs', `doc_${k}`, lbl(docCode(k)).ar, lbl(docCode(k)).en, count(docCode(k)))),
  m('events', 'exhibitions', 'المعارض', 'Exhibitions', count(CC.OCCASION, EXHIBITION)),
  m('events', 'occasions', 'المناسبات', 'Occasions', count(CC.OCCASION, OCCASION_ONLY)),
  m('events', 'events_upcoming', 'المعارض والمناسبات القادمة والجارية', 'Upcoming and current exhibitions & occasions', (c) => c.cc(CC.OCCASION, { sql: `COALESCE(CAST(n.finishAt AS TEXT), n.extra ->> 'eventDate', '') >= :today`, params: { today: today() } })),
  m('committees', 'board_members', 'أعضاء مجلس الإدارة', 'Board members', count(CC.BOARD_MEMBER)),
  m('committees', 'committees', 'اللجان والقطاعات', 'Committees', count(CC.COMMITTEE)),
  m('committees', 'committee_members', 'أعضاء اللجان', 'Committee members', count(CC.COMMITTEE_MEMBER)),
  m('committees', 'committee_meetings', 'اجتماعات اللجان', 'Committee meetings', count(CC.COMMITTEE_MEETING)),
  m('committees', 'committee_visits', 'زيارات اللجان', 'Committee visits', count(CC.COMMITTEE_VISIT)),
  m('committees', 'committee_initiatives', 'مبادرات اللجان', 'Committee initiatives', count(CC.COMMITTEE_INITIATIVE)),
  m('committees', 'committee_recommendations', 'توصيات اللجان', 'Committee recommendations', count(CC.COMMITTEE_RECOMMENDATION)),
  m('training', 'courses', 'الدورات التدريبية', 'Training courses', count(CC.COURSE)),
  m('training', 'trainers', 'المدربون', 'Trainers', count(CC.TRAINER)),
  m('expo', 'expo_exhibitors', 'عارضو المعرض', 'Expo exhibitors', count(CC.EXPO_EXHIBITOR)),
  m('expo', 'expo_sponsors', 'رعاة المعرض', 'Expo sponsors', count(CC.EXPO_SPONSOR)),
  m('expo', 'expo_sessions', 'جلسات المعرض', 'Expo sessions', count(CC.EXPO_SESSION)),
  m('services', 'services', 'خدمات الغرفة', 'Chamber services', count(CC.SERVICE)),
  m('services', 'incubator_projects', 'مشاريع الحاضنة', 'Incubator projects', count(CC.INCUBATOR_PROJECT)),
  m('services', 'faqs', 'الأسئلة الشائعة', 'FAQs', count(CC.FAQ)),
  m('people', 'subscribers', 'مشتركو النشرة البريدية', 'Newsletter subscribers', (c) => c.sql('SELECT COUNT(*) FROM subscribers WHERE is_active = true AND is_verified = true')),
  m('people', 'users', 'الحسابات المسجلة', 'Registered accounts', (c) => c.sql('SELECT COUNT(*) FROM users WHERE is_active = true')),
  m('people', 'form_submissions', 'الطلبات الواردة عبر النماذج', 'Requests received through forms', (c) => c.sql('SELECT COUNT(*) FROM form_submissions')),
];
export const METRIC_KEYS = new Set(METRICS.map((x) => x.key));
