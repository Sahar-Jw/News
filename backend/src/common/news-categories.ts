/**
 * The fixed main categories of the news / media center, in display order.
 * They always appear in the category lists (media center, admin news form), even before any news uses them.
 * Other (free-text) categories keep working and are listed after these.
 */
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

/** The fixed category labels in one language (ar by default), in display order. */
export const fixedNewsCategories = (lang?: string): string[] => NEWS_MAIN_CATEGORIES.map((c) => (lang === 'en' ? c.en : c.ar));

/** The label of one fixed category in the given language. */
export const newsCategoryLabel = (key: NewsMainCategoryKey, lang?: string): string => {
  const c = NEWS_MAIN_CATEGORIES.find((x) => x.key === key)!;
  return lang === 'en' ? c.en : c.ar;
};

/** Every spelling (both languages) of a fixed category: [ar, en]. */
export const newsCategoryLabels = (key: NewsMainCategoryKey): string[] => {
  const c = NEWS_MAIN_CATEGORIES.find((x) => x.key === key)!;
  return [c.ar, c.en];
};

/** Case-insensitive match of a value against the fixed labels (both languages); returns the canonical spelling or null. */
export const matchFixedNewsCategory = (value: string): string | null => {
  const v = (value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  for (const c of NEWS_MAIN_CATEGORIES) {
    if (c.ar.toLowerCase() === v) return c.ar;
    if (c.en.toLowerCase() === v) return c.en;
  }
  return null;
};

/** Puts the fixed categories first (in order) and the other values after them, without duplicates. */
export const withFixedFirst = (lang: string | undefined, others: string[]): string[] => {
  const fixed = fixedNewsCategories(lang);
  const all = [...fixedNewsCategories('ar'), ...fixedNewsCategories('en')].map((x) => x.toLowerCase());
  return [...fixed, ...others.filter((o) => !all.includes((o ?? '').toLowerCase()))];
};
