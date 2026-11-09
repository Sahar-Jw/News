import { SPECIAL_CATEGORY_CODES } from './constants';

/** Document kinds (the documents page tabs). Each one is its own main category: DOC_CIRCULAR, DOC_DECISION ... */
export const DOCUMENT_KIND_LIST = ['circular', 'decision', 'law', 'guide', 'study', 'report', 'bulletin', 'form', 'historical', 'press', 'mediakit', 'library'] as const;

/**
 * Everything that used to have a table of its own (FAQ, documents, board, committees, services, training, expo, Get2Trade, membership,
 * incubator, static pages) is now a row of `news` whose main category is one of these codes. The code is the ONLY thing that tells the
 * types apart; the type's own fields (fees, dates, bilingual texts ...) live in the JSON column `news.extra`. See modules/content.
 */
export const CC = {
  FAQ: 'FAQ',
  PAGE: 'PAGE',
  BOARD_MEMBER: 'BOARD_MEMBER',
  COMMITTEE: 'COMMITTEE',
  WOMEN_COMMITTEE: 'WOMEN_COMMITTEE',
  COMMITTEE_MEMBER: 'COMMITTEE_MEMBER',
  COMMITTEE_MEETING: 'COMMITTEE_MEETING',
  COMMITTEE_VISIT: 'COMMITTEE_VISIT',
  COMMITTEE_RECOMMENDATION: 'COMMITTEE_RECOMMENDATION',
  COMMITTEE_INITIATIVE: 'COMMITTEE_INITIATIVE',
  COMMITTEE_OUTPUT: 'COMMITTEE_OUTPUT',
  COMMITTEE_EVENT: 'COMMITTEE_EVENT',
  COMMITTEE_SUCCESS: 'COMMITTEE_SUCCESS',
  SERVICE: 'SERVICE',
  TRAINER: 'TRAINER',
  COURSE: 'COURSE',
  EXPO_EXHIBITOR: 'EXPO_EXHIBITOR',
  EXPO_SPONSOR: 'EXPO_SPONSOR',
  EXPO_SESSION: 'EXPO_SESSION',
  G2T_PACKAGE: 'G2T_PACKAGE',
  G2T_SPACE: 'G2T_SPACE',
  G2T_INFO: 'G2T_INFO',
  MEMBERSHIP_INFO: 'MEMBERSHIP_INFO',
  INCUBATOR_PROJECT: 'INCUBATOR_PROJECT',
  OCCASION: 'OCCASION',
} as const;

export const docCode = (kind: string) => `DOC_${kind.toUpperCase()}`;
export const DOC_CODES: string[] = DOCUMENT_KIND_LIST.map(docCode);
export const kindOfDocCode = (code: string) => code.replace(/^DOC_/, '').toLowerCase();

export const CONTENT_CATEGORY_CODES: string[] = [...Object.values(CC), ...DOC_CODES];

/** Every reserved main-category code: the special home sections + the content types above. None of them is ordinary news. */
export const RESERVED_CATEGORY_CODES: string[] = [...SPECIAL_CATEGORY_CODES, ...CONTENT_CATEGORY_CODES];

/** Arabic / English names of the content main categories (for screens that list them). */
export const CONTENT_CATEGORY_LABELS: Record<string, { ar: string; en: string }> = {
  FAQ: { ar: 'الأسئلة الشائعة', en: 'FAQ' },
  PAGE: { ar: 'الصفحات الثابتة', en: 'Static pages' },
  BOARD_MEMBER: { ar: 'مجلس الإدارة', en: 'Board of directors' },
  COMMITTEE: { ar: 'اللجان والقطاعات', en: 'Committees' },
  WOMEN_COMMITTEE: { ar: 'لجنة سيدات الأعمال', en: 'Businesswomen committee' },
  COMMITTEE_MEMBER: { ar: 'أعضاء اللجان', en: 'Committee members' },
  COMMITTEE_MEETING: { ar: 'اجتماعات اللجان', en: 'Committee meetings' },
  COMMITTEE_VISIT: { ar: 'زيارات اللجان', en: 'Committee visits' },
  COMMITTEE_RECOMMENDATION: { ar: 'توصيات اللجان', en: 'Committee recommendations' },
  COMMITTEE_INITIATIVE: { ar: 'مبادرات اللجان', en: 'Committee initiatives' },
  COMMITTEE_OUTPUT: { ar: 'مخرجات اللجان', en: 'Committee outputs' },
  COMMITTEE_EVENT: { ar: 'فعاليات اللجان', en: 'Committee events' },
  COMMITTEE_SUCCESS: { ar: 'قصص نجاح سيدات الأعمال', en: 'Businesswomen success stories' },
  SERVICE: { ar: 'خدمات الغرفة', en: 'Chamber services' },
  TRAINER: { ar: 'المدربون', en: 'Trainers' },
  COURSE: { ar: 'الدورات التدريبية', en: 'Training courses' },
  EXPO_EXHIBITOR: { ar: 'عارضو المعرض', en: 'Expo exhibitors' },
  EXPO_SPONSOR: { ar: 'رعاة المعرض', en: 'Expo sponsors' },
  EXPO_SESSION: { ar: 'جلسات المعرض', en: 'Expo sessions' },
  G2T_PACKAGE: { ar: 'باقات غيت تو تريد', en: 'Get2Trade packages' },
  G2T_SPACE: { ar: 'مساحات غيت تو تريد', en: 'Get2Trade spaces' },
  G2T_INFO: { ar: 'تعريف غيت تو تريد', en: 'Get2Trade info' },
  MEMBERSHIP_INFO: { ar: 'معلومات الانتساب', en: 'Membership info' },
  INCUBATOR_PROJECT: { ar: 'مشاريع الحاضنة', en: 'Incubator projects' },
  OCCASION: { ar: 'المناسبات والمعارض', en: 'Occasions & exhibitions' },
  DOC_CIRCULAR: { ar: 'التعاميم', en: 'Circulars' },
  DOC_DECISION: { ar: 'القرارات', en: 'Decisions' },
  DOC_LAW: { ar: 'القوانين والأنظمة', en: 'Laws & regulations' },
  DOC_GUIDE: { ar: 'الأدلة', en: 'Guides' },
  DOC_STUDY: { ar: 'الدراسات', en: 'Studies' },
  DOC_REPORT: { ar: 'التقارير', en: 'Reports' },
  DOC_BULLETIN: { ar: 'النشرات', en: 'Bulletins' },
  DOC_FORM: { ar: 'النماذج', en: 'Forms' },
  DOC_HISTORICAL: { ar: 'الوثائق التاريخية', en: 'Historical documents' },
  DOC_PRESS: { ar: 'المواد الصحفية', en: 'Press materials' },
  DOC_MEDIAKIT: { ar: 'الحقيبة الإعلامية', en: 'Media kit' },
  DOC_LIBRARY: { ar: 'المكتبة', en: 'Library' },
};
