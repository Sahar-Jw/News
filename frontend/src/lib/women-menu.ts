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
  if (typeof item.labelAr !== 'string' || typeof item.labelEn !== 'string') return null;
  return {
    type: 'page',
    slug: item.slug,
    labelAr: item.labelAr,
    labelEn: item.labelEn,
    isActive: item.isActive !== false,
    newTab: item.newTab === true,
    ...(!WOMEN_BUILT_IN_PAGES.has(item.slug) || typeof item.bodyAr === 'string' ? { bodyAr: typeof item.bodyAr === 'string' ? item.bodyAr : '' } : {}),
    ...(!WOMEN_BUILT_IN_PAGES.has(item.slug) || typeof item.bodyEn === 'string' ? { bodyEn: typeof item.bodyEn === 'string' ? item.bodyEn : '' } : {}),
  };
}

function fromLegacy(items: unknown, fallback: WomenMenuEntry[]): WomenMenuEntry[] {
  if (!Array.isArray(items)) return fallback;
  const pages = items.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const old = item as Record<string, unknown>;
    if (typeof old.href !== 'string' || typeof old.labelAr !== 'string' || typeof old.labelEn !== 'string') return [];
    const hash = old.href.split('#')[1];
    const slug = hash === 'about' || hash === 'overview' ? (hash === 'overview' ? 'home' : 'about') : hash || (old.href.includes('/contact') ? 'contact' : 'custom');
    return [{
      ...page(slug, old.labelAr, old.labelEn),
      isActive: old.isActive !== false,
      ...(!WOMEN_BUILT_IN_PAGES.has(slug) ? { bodyAr: '', bodyEn: '' } : {}),
    }];
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

export function readWomenMenu(value: unknown): WomenMenu {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_WOMEN_MENU;
  const saved = value as Record<string, unknown>;
  if (!Array.isArray(saved.navigation) && !Array.isArray(saved.footer)) return DEFAULT_WOMEN_MENU;
  const legacy = (entries: unknown) => Array.isArray(entries) && entries.some((item) =>
    !!item && typeof item === 'object' && !Array.isArray(item) && 'href' in item,
  );
  return {
    navigation: Array.isArray(saved.navigation)
      ? legacy(saved.navigation) ? fromLegacy(saved.navigation, DEFAULT_WOMEN_MENU.navigation) : readEntries(saved.navigation, DEFAULT_WOMEN_MENU.navigation)
      : fromLegacy(saved.navigation, DEFAULT_WOMEN_MENU.navigation),
    footer: Array.isArray(saved.footer)
      ? legacy(saved.footer) ? fromLegacy(saved.footer, DEFAULT_WOMEN_MENU.footer) : readEntries(saved.footer, DEFAULT_WOMEN_MENU.footer)
      : fromLegacy(saved.footer, DEFAULT_WOMEN_MENU.footer),
  };
}

export function womenPageHref(slug: string) {
  return slug === 'home' ? '/committees/women' : `/committees/women/section?slug=${encodeURIComponent(slug)}`;
}
