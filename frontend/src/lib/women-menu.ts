export interface WomenMenuPage {
  type: 'page';
  slug: string;
  labelAr: string;
  labelEn: string;
  isActive: boolean;
  newTab: boolean;
  bodyAr?: string;
  bodyEn?: string;
}

export interface WomenMenuDropdown {
  type: 'dropdown';
  titleAr: string;
  titleEn: string;
  isActive: boolean;
  items: WomenMenuPage[];
}

export type WomenMenuEntry = WomenMenuPage | WomenMenuDropdown;
export interface WomenMenu { navigation: WomenMenuEntry[]; footer: WomenMenuEntry[] }

export const WOMEN_PAGE_CATALOG: WomenMenuPage[] = [
  { type: 'page', slug: 'about', labelAr: 'عن اللجنة', labelEn: 'About the committee', isActive: true, newTab: false },
  { type: 'page', slug: 'organization', labelAr: 'الهيكلية التنظيمية', labelEn: 'Organizational structure', isActive: true, newTab: false },
  { type: 'page', slug: 'initiatives', labelAr: 'المبادرات والمشاريع', labelEn: 'Initiatives & projects', isActive: true, newTab: false },
  { type: 'page', slug: 'activities', labelAr: 'الأنشطة والفعاليات', labelEn: 'Activities & events', isActive: true, newTab: false },
  { type: 'page', slug: 'success', labelAr: 'قصص النجاح', labelEn: 'Success stories', isActive: true, newTab: false },
  { type: 'page', slug: 'news', labelAr: 'الأخبار', labelEn: 'News', isActive: true, newTab: false },
  { type: 'page', slug: 'contact', labelAr: 'تواصل معنا', labelEn: 'Contact us', isActive: true, newTab: false },
  { type: 'page', slug: 'archive', labelAr: 'الأرشيف', labelEn: 'Archive', isActive: true, newTab: false },
  { type: 'page', slug: 'media', labelAr: 'الوسائط', labelEn: 'Media', isActive: true, newTab: false },
];

export const WOMEN_BUILT_IN_PAGES = new Set([
  'home', 'about', 'organization', 'initiatives', 'activities', 'success',
  'news', 'archive', 'media', 'contact',
]);

const page = (slug: string, labelAr: string, labelEn: string): WomenMenuPage => ({
  type: 'page', slug, labelAr, labelEn, isActive: true, newTab: false,
});

export const DEFAULT_WOMEN_MENU: WomenMenu = {
  navigation: [
    {
      type: 'dropdown', titleAr: 'عن اللجنة', titleEn: 'About the committee', isActive: true,
      items: [
        page('about', 'عن اللجنة', 'About the committee'),
        page('organization', 'الهيكلية التنظيمية', 'Organizational structure'),
        page('initiatives', 'المبادرات والمشاريع', 'Initiatives & projects'),
        page('activities', 'الأنشطة والفعاليات', 'Activities & events'),
        page('success', 'قصص النجاح', 'Success stories'),
      ],
    },
    page('news', 'الأخبار', 'News'),
    page('contact', 'تواصل معنا', 'Contact us'),
    page('archive', 'الأرشيف', 'Archive'),
  ],
  footer: [
    {
      type: 'dropdown', titleAr: 'عن اللجنة', titleEn: 'About the committee', isActive: true,
      items: [
        page('about', 'عن اللجنة', 'About the committee'),
        page('organization', 'الهيكلية التنظيمية', 'Organizational structure'),
        page('initiatives', 'المبادرات والمشاريع', 'Initiatives & projects'),
        page('activities', 'الأنشطة والفعاليات', 'Activities & events'),
        page('success', 'قصص النجاح', 'Success stories'),
      ],
    },
    page('news', 'الأخبار', 'News'),
    page('contact', 'تواصل معنا', 'Contact us'),
    page('archive', 'الأرشيف', 'Archive'),
  ],
};

function readPage(value: unknown): WomenMenuPage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.slug !== 'string' || !/^[a-z0-9-]{1,60}$/.test(item.slug)) return null;
  const knownPage = WOMEN_PAGE_CATALOG.find((candidate) => candidate.slug === item.slug);
  if (!knownPage) return null;
  return {
    ...knownPage,
    isActive: item.isActive !== false,
  };
}

function fromLegacy(items: unknown, fallback: WomenMenuEntry[]): WomenMenuEntry[] {
  if (!Array.isArray(items)) return fallback;
  const pages = items.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const old = item as Record<string, unknown>;
    if (typeof old.href !== 'string' || typeof old.labelAr !== 'string' || typeof old.labelEn !== 'string') return [];
    const path = old.href.split('#')[1] || old.href.split('?')[0].split('/').filter(Boolean).pop() || '';
    const slug = path === 'overview' ? 'about' : path;
    const knownPage = WOMEN_PAGE_CATALOG.find((candidate) => candidate.slug === slug);
    return knownPage ? [{ ...knownPage, isActive: old.isActive !== false }] : [];
  });
  const single = pages.filter((entry) => ['news', 'contact', 'archive'].includes(entry.slug));
  const nested = pages.filter((entry) => !['news', 'contact', 'archive'].includes(entry.slug));
  return [
    ...(nested.length ? [{ type: 'dropdown' as const, titleAr: 'عن اللجنة', titleEn: 'About the committee', isActive: true, items: nested }] : []),
    ...single,
  ];
}

function readEntries(value: unknown, fallback: WomenMenuEntry[]): WomenMenuEntry[] {
  if (!Array.isArray(value)) return fallback;
  const entries = value.flatMap((raw): WomenMenuEntry[] => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    if (item.type === 'dropdown' && typeof item.titleAr === 'string' && typeof item.titleEn === 'string' && Array.isArray(item.items)) {
      return [{
        type: 'dropdown',
        titleAr: item.titleAr,
        titleEn: item.titleEn,
        isActive: item.isActive !== false,
        items: item.items.flatMap((child) => {
          const parsed = readPage(child);
          return parsed ? [parsed] : [];
        }),
      }];
    }
    const parsed = readPage(raw);
    return parsed ? [parsed] : [];
  });
  return entries;
}

function completeMenu(entries: WomenMenuEntry[]): WomenMenuEntry[] {
  const seen = new Set<string>();
  const completed = entries.flatMap((entry): WomenMenuEntry[] => {
    if (entry.type === 'page') {
      if (seen.has(entry.slug)) return [];
      seen.add(entry.slug);
      return [entry];
    }
    const items = entry.items.filter((item) => {
      if (seen.has(item.slug)) return false;
      seen.add(item.slug);
      return true;
    });
    return [{ ...entry, items }];
  });
  const missing = WOMEN_PAGE_CATALOG.filter((item) => !seen.has(item.slug)).map((item) => ({ ...item, isActive: false }));
  return [...completed, ...missing];
}

export function readWomenMenu(value: unknown): WomenMenu {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_WOMEN_MENU;
  const saved = value as Record<string, unknown>;
  if (!Array.isArray(saved.navigation) && !Array.isArray(saved.footer)) return DEFAULT_WOMEN_MENU;
  const legacy = (entries: unknown) => Array.isArray(entries) && entries.some((item) =>
    !!item && typeof item === 'object' && !Array.isArray(item) && 'href' in item,
  );
  return {
    navigation: completeMenu(Array.isArray(saved.navigation)
      ? legacy(saved.navigation) ? fromLegacy(saved.navigation, DEFAULT_WOMEN_MENU.navigation) : readEntries(saved.navigation, DEFAULT_WOMEN_MENU.navigation)
      : fromLegacy(saved.navigation, DEFAULT_WOMEN_MENU.navigation)),
    footer: completeMenu(Array.isArray(saved.footer)
      ? legacy(saved.footer) ? fromLegacy(saved.footer, DEFAULT_WOMEN_MENU.footer) : readEntries(saved.footer, DEFAULT_WOMEN_MENU.footer)
      : fromLegacy(saved.footer, DEFAULT_WOMEN_MENU.footer)),
  };
}

export function womenPageHref(slug: string) {
  return slug === 'home' ? '/committees/women' : `/committees/women/section?slug=${encodeURIComponent(slug)}`;
}
