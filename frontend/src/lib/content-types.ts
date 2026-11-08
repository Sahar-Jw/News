import { hubUrl } from '@/lib/hubs-meta';

/**
 * Every "content type" of the site: a reserved main category (see backend common/content-categories.ts). They are rows of the news table,
 * but each type has its own editor with its own fields, so the news form and the admin menu send you to that editor.
 * `hub` / `tab` = where the editor lives in Settings; `perms` = any of these permissions shows the entry (UI hint only, the API enforces them).
 */
export interface ContentType { code: string; ar: string; en: string; hub: string; tab: string; perms: string[]; group: 'site' | 'committees' | 'training' | 'expo' | 'g2t' | 'docs' }

const T = (code: string, ar: string, en: string, hub: string, tab: string, perms: string[], group: ContentType['group']): ContentType => ({ code, ar, en, hub, tab, perms, group });
const DOC = (kind: string, ar: string, en: string): ContentType => T(`DOC_${kind}`, ar, en, 'documents', 'documents', ['documents.read'], 'docs');

export const CONTENT_TYPES: ContentType[] = [
  T('PAGE', 'الصفحات الثابتة', 'Static pages', 'pages', 'about', ['pages.read'], 'site'),
  T('FAQ', 'الأسئلة الشائعة', 'FAQ', 'pages', 'faqs', ['faqs.read'], 'site'),
  T('BOARD_MEMBER', 'أعضاء مجلس الإدارة', 'Board members', 'board', 'board', ['board.read'], 'site'),
  T('SERVICE', 'خدمات الغرفة', 'Chamber services', 'services', 'services', ['services.read'], 'site'),
  T('OCCASION', 'المناسبات والمعارض', 'Occasions & exhibitions', 'occasions', 'events', ['occasions.read'], 'site'),
  T('INCUBATOR_PROJECT', 'مشاريع الحاضنة', 'Incubator projects', 'incubator', 'projects', ['incubator.read'], 'site'),
  T('MEMBERSHIP_INFO', 'معلومات الانتساب', 'Membership info', 'membership', 'content', ['membership.read'], 'site'),
  T('COMMITTEE', 'اللجان والقطاعات', 'Committees', 'committees', 'committees', ['committees.read'], 'committees'),
  T('WOMEN_COMMITTEE', 'لجنة سيدات الأعمال', 'Businesswomen committee', 'women', 'content', ['committees.read'], 'committees'),
  T('COMMITTEE_MEMBER', 'أعضاء اللجان', 'Committee members', 'committees', 'committees', ['committees.read'], 'committees'),
  T('COMMITTEE_MEETING', 'اجتماعات اللجان', 'Committee meetings', 'committees', 'committees', ['committees.read'], 'committees'),
  T('COMMITTEE_VISIT', 'زيارات اللجان', 'Committee visits', 'committees', 'committees', ['committees.read'], 'committees'),
  T('COMMITTEE_RECOMMENDATION', 'توصيات اللجان', 'Committee recommendations', 'committees', 'committees', ['committees.read'], 'committees'),
  T('COMMITTEE_OUTPUT', 'مخرجات اللجان', 'Committee outputs', 'committees', 'committees', ['committees.read'], 'committees'),
  T('COMMITTEE_EVENT', 'فعاليات اللجان', 'Committee events', 'committees', 'committees', ['committees.read'], 'committees'),
  T('COMMITTEE_INITIATIVE', 'مبادرات اللجان', 'Committee initiatives', 'committees', 'committees', ['committees.read'], 'committees'),
  T('COURSE', 'الدورات التدريبية', 'Training courses', 'training', 'courses', ['courses.read'], 'training'),
  T('TRAINER', 'المدربون', 'Trainers', 'training', 'trainers', ['courses.read'], 'training'),
  T('EXPO_EXHIBITOR', 'عارضو المعرض', 'Expo exhibitors', 'expo', 'exhibitors', ['expo.read'], 'expo'),
  T('EXPO_SPONSOR', 'رعاة المعرض', 'Expo sponsors', 'expo', 'sponsors', ['expo.read'], 'expo'),
  T('EXPO_SESSION', 'جلسات المعرض', 'Expo sessions', 'expo', 'sessions', ['expo.read'], 'expo'),
  T('G2T_PACKAGE', 'باقات غيت تو تريد', 'Get2Trade packages', 'get2trade', 'packages', ['get2trade.read'], 'g2t'),
  T('G2T_SPACE', 'مساحات غيت تو تريد', 'Get2Trade spaces', 'get2trade', 'spaces', ['get2trade.read'], 'g2t'),
  T('G2T_INFO', 'تعريف غيت تو تريد', 'Get2Trade info', 'get2trade', 'content', ['get2trade.read'], 'g2t'),
  DOC('CIRCULAR', 'التعاميم', 'Circulars'), DOC('DECISION', 'القرارات', 'Decisions'), DOC('LAW', 'القوانين والأنظمة', 'Laws & regulations'),
  DOC('GUIDE', 'الأدلة', 'Guides'), DOC('STUDY', 'الدراسات', 'Studies'), DOC('REPORT', 'التقارير', 'Reports'), DOC('BULLETIN', 'النشرات', 'Bulletins'),
  DOC('FORM', 'النماذج', 'Forms'), DOC('HISTORICAL', 'الوثائق التاريخية', 'Historical documents'), DOC('PRESS', 'المواد الصحفية', 'Press materials'),
  DOC('MEDIAKIT', 'الحقيبة الإعلامية', 'Media kit'), { ...DOC('LIBRARY', 'المكتبة', 'Library'), tab: 'library' },
];

export const contentTypeUrl = (c: ContentType) => hubUrl(c.hub, c.tab);
export const contentTypeLabel = (c: ContentType, lang: string) => (lang === 'ar' ? c.ar : c.en);
