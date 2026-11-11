import type { WomenMenu, WomenMenuEntry, WomenMenuPage } from './women-menu';

/**
 * DCC EXPO navigation / footer model. Same shape as the Women Business Committee menu (standalone links and dropdowns of existing pages),
 * so the same editor and the same kind of header work for both sites. Pages are fixed (they are real routes); the admin arranges, renames,
 * shows and hides them.
 */
const page = (slug: string, labelAr: string, labelEn: string, isActive = true): WomenMenuPage => ({ type: 'page', slug, labelAr, labelEn, isActive, newTab: false });

export const EXPO_PAGE_CATALOG: WomenMenuPage[] = [
  page('home', 'الرئيسية', 'Home'),
  page('about', 'عن المعرض', 'About the expo'),
  page('sectors', 'القطاعات المشاركة', 'Participating sectors'),
  page('exhibitors', 'العارضون', 'Exhibitors'),
  page('programme', 'برنامج المعرض', 'Programme'),
  page('register', 'التسجيل والمشاركة', 'Registration'),
  page('news', 'الأخبار والإعلام', 'News & media'),
  page('sponsors', 'الرعاة والشركاء', 'Sponsors & partners'),
  page('faq', 'الأسئلة الشائعة', 'FAQs'),
  page('info', 'معلومات هامة', 'Key information'),
  page('contact', 'تواصل معنا', 'Contact us'),
];

const group = (titleAr: string, titleEn: string, items: WomenMenuPage[]): WomenMenuEntry => ({ type: 'dropdown', titleAr, titleEn, isActive: true, items });
const P = (slug: string) => ({ ...EXPO_PAGE_CATALOG.find((x) => x.slug === slug)! });

export const DEFAULT_EXPO_MENU: WomenMenu = {
  navigation: [
    P('home'),
    group('عن المعرض', 'About', [P('about'), P('sectors'), P('info')]),
    P('exhibitors'), P('programme'), P('register'), P('news'), P('sponsors'), P('faq'), P('contact'),
  ],
  footer: [
    group('المعرض', 'The expo', [P('about'), P('sectors'), P('exhibitors'), P('programme')]),
    group('المشاركة', 'Take part', [P('register'), P('info'), P('sponsors'), P('faq')]),
    P('news'), P('contact'),
  ],
};

export function expoPageHref(slug: string) {
  return slug === 'home' ? '/expo' : `/expo/${slug}`;
}

function readPage(value: unknown): WomenMenuPage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const known = EXPO_PAGE_CATALOG.find((x) => x.slug === item.slug);
  if (!known) return null;
  return { ...known, labelAr: typeof item.labelAr === 'string' ? item.labelAr : known.labelAr, labelEn: typeof item.labelEn === 'string' ? item.labelEn : known.labelEn, isActive: item.isActive !== false };
}

/** The first version of the EXPO menu stored plain links ({labelAr, labelEn, href}); map each to the page it points to. */
function fromLegacy(items: unknown[]): WomenMenuEntry[] {
  const seen = new Set<string>();
  return items.flatMap((raw): WomenMenuEntry[] => {
    if (!raw || typeof raw !== 'object') return [];
    const old = raw as Record<string, unknown>;
    if (typeof old.href !== 'string') return [];
    const hash = old.href.split('#')[1];
    const tail = old.href.split(/[?#]/)[0].split('/').filter(Boolean).pop();
    const slug = hash || (tail === 'expo' ? 'home' : tail) || '';
    const known = EXPO_PAGE_CATALOG.find((x) => x.slug === slug);
    if (!known || seen.has(slug)) return [];
    seen.add(slug);
    return [{ ...known, labelAr: typeof old.labelAr === 'string' ? old.labelAr : known.labelAr, labelEn: typeof old.labelEn === 'string' ? old.labelEn : known.labelEn, isActive: old.isActive !== false }];
  });
}

function readEntries(value: unknown[]): WomenMenuEntry[] {
  return value.flatMap((raw): WomenMenuEntry[] => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    if (item.type === 'dropdown' && typeof item.titleAr === 'string' && typeof item.titleEn === 'string' && Array.isArray(item.items)) {
      return [{ type: 'dropdown', titleAr: item.titleAr, titleEn: item.titleEn, isActive: item.isActive !== false, items: item.items.flatMap((c) => { const p = readPage(c); return p ? [p] : []; }) }];
    }
    const p = readPage(raw);
    return p ? [p] : [];
  });
}

/** Every catalog page appears exactly once (pages missing from a saved menu are added hidden, so the editor can switch them on). */
function complete(entries: WomenMenuEntry[]): WomenMenuEntry[] {
  const seen = new Set<string>();
  const done = entries.flatMap((entry): WomenMenuEntry[] => {
    if (entry.type === 'page') { if (seen.has(entry.slug)) return []; seen.add(entry.slug); return [entry]; }
    return [{ ...entry, items: entry.items.filter((i) => { if (seen.has(i.slug)) return false; seen.add(i.slug); return true; }) }];
  });
  return [...done, ...EXPO_PAGE_CATALOG.filter((x) => !seen.has(x.slug)).map((x) => ({ ...x, isActive: false }))];
}

export function readExpoMenu(value: unknown): WomenMenu {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_EXPO_MENU;
  const saved = value as Record<string, unknown>;
  const part = (entries: unknown, fallback: WomenMenuEntry[]) => {
    if (!Array.isArray(entries)) return fallback;
    const legacy = entries.some((i) => !!i && typeof i === 'object' && !Array.isArray(i) && 'href' in i);
    return complete(legacy ? fromLegacy(entries) : readEntries(entries));
  };
  if (!Array.isArray(saved.navigation) && !Array.isArray(saved.footer)) return DEFAULT_EXPO_MENU;
  return { navigation: part(saved.navigation, DEFAULT_EXPO_MENU.navigation), footer: part(saved.footer, DEFAULT_EXPO_MENU.footer) };
}
