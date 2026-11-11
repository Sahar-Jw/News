/** The fixed main categories of the media center (same list and order as backend/src/common/news-categories.ts). */
export const NEWS_MAIN_CATEGORIES = [
  { key: 'chamber', ar: 'أخبار الغرفة', en: 'Chamber News' },
  { key: 'board', ar: 'أخبار مجلس الإدارة', en: 'Board of Directors News' },
  { key: 'president', ar: 'أخبار رئيس الغرفة', en: 'Chamber President News' },
  { key: 'committees', ar: 'أخبار اللجان', en: 'Committees News' },
  { key: 'training', ar: 'أخبار مركز التدريب', en: 'Training Center News' },
  { key: 'incubator', ar: 'أخبار حاضنة الأعمال', en: 'Business Incubator News' },
  { key: 'women', ar: 'أخبار لجنة سيدات الأعمال', en: 'Businesswomen Committee News' },
  { key: 'economic', ar: 'الأخبار الاقتصادية', en: 'Economic News' },
  { key: 'events', ar: 'المعارض والفعاليات', en: 'Exhibitions & Events' },
  { key: 'visits', ar: 'الزيارات واللقاءات', en: 'Visits & Meetings' },
] as const;

export type NewsMainCategoryKey = (typeof NEWS_MAIN_CATEGORIES)[number]['key'];

/** The stored category label of a fixed category in the page language. */
export const newsCategoryLabel = (key: NewsMainCategoryKey, lang: string) => {
  const c = NEWS_MAIN_CATEGORIES.find((x) => x.key === key)!;
  return lang === 'en' ? c.en : c.ar;
};

export const isNewsCategoryKey = (k: string | null | undefined): k is NewsMainCategoryKey => NEWS_MAIN_CATEGORIES.some((c) => c.key === k);

/** The key of a fixed category from its stored label in either language (undefined for any other category). */
export const newsCategoryKeyOf = (label: string | null | undefined): NewsMainCategoryKey | undefined => NEWS_MAIN_CATEGORIES.find((c) => c.ar === label || c.en === label)?.key;
