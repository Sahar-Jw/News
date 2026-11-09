export interface BrandedPageLink {
  labelAr: string;
  labelEn: string;
  href: string;
  isActive?: boolean;
}

export interface BrandedPageLinks {
  navigation: BrandedPageLink[];
  footer: BrandedPageLink[];
}

export const DEFAULT_BRANDED_PAGE_LINKS: Record<'expo' | 'women', BrandedPageLinks> = {
  expo: {
    navigation: [
      { labelAr: 'الرئيسية', labelEn: 'Home', href: '/expo' },
      { labelAr: 'عن المعرض', labelEn: 'About', href: '/expo#about' },
      { labelAr: 'العارضون', labelEn: 'Exhibitors', href: '/expo/exhibitors' },
      { labelAr: 'البرنامج', labelEn: 'Programme', href: '/expo/programme' },
      { labelAr: 'الرعاة', labelEn: 'Sponsors', href: '/expo#sponsors' },
      { labelAr: 'الأخبار', labelEn: 'News', href: '/expo/news' },
      { labelAr: 'الأسئلة الشائعة', labelEn: 'FAQs', href: '/expo/faq' },
      { labelAr: 'تواصل معنا', labelEn: 'Contact', href: '/expo/contact' },
    ],
    footer: [
      { labelAr: 'عن المعرض', labelEn: 'About the expo', href: '/expo#about' },
      { labelAr: 'العارضون', labelEn: 'Exhibitors', href: '/expo/exhibitors' },
      { labelAr: 'البرنامج', labelEn: 'Programme', href: '/expo/programme' },
      { labelAr: 'الأسئلة الشائعة', labelEn: 'FAQs', href: '/expo/faq' },
      { labelAr: 'تواصل معنا', labelEn: 'Contact', href: '/expo/contact' },
    ],
  },
  women: {
    navigation: [
      { labelAr: 'عن اللجنة', labelEn: 'About', href: '/committees/women#about' },
      { labelAr: 'الهيكلية التنظيمية', labelEn: 'Organization', href: '/committees/women#organization' },
      { labelAr: 'المبادرات والمشاريع', labelEn: 'Initiatives & projects', href: '/committees/women#initiatives' },
      { labelAr: 'الأنشطة والفعاليات', labelEn: 'Activities & events', href: '/committees/women#activities' },
      { labelAr: 'قصص النجاح', labelEn: 'Success stories', href: '/committees/women#success' },
      { labelAr: 'الأخبار', labelEn: 'News', href: '/committees/women#news' },
      { labelAr: 'الأرشيف', labelEn: 'Archive', href: '/committees/women#archive' },
      { labelAr: 'تواصل معنا', labelEn: 'Contact', href: '/committees/women#contact' },
      { labelAr: 'الوسائط', labelEn: 'Media', href: '/committees/women#media' },
    ],
    footer: [
      { labelAr: 'عن اللجنة', labelEn: 'About', href: '/committees/women#about' },
      { labelAr: 'الهيكلية التنظيمية', labelEn: 'Organization', href: '/committees/women#organization' },
      { labelAr: 'المبادرات', labelEn: 'Initiatives', href: '/committees/women#initiatives' },
      { labelAr: 'قصص النجاح', labelEn: 'Success stories', href: '/committees/women#success' },
      { labelAr: 'الأرشيف', labelEn: 'Archive', href: '/committees/women#archive' },
      { labelAr: 'تواصل معنا', labelEn: 'Contact', href: '/committees/women#contact' },
      { labelAr: 'الوسائط', labelEn: 'Media', href: '/committees/women#media' },
    ],
  },
};

export const BRANDED_DESTINATIONS: BrandedPageLink[] = [
  { labelAr: 'الصفحة الرئيسية', labelEn: 'Home', href: '/' },
  { labelAr: 'الأخبار', labelEn: 'News', href: '/media' },
  { labelAr: 'المركز الإعلامي', labelEn: 'Media center', href: '/media' },
  { labelAr: 'معرض الصور', labelEn: 'Gallery', href: '/gallery' },
  { labelAr: 'اللجان', labelEn: 'Committees', href: '/committees' },
  { labelAr: 'تواصل معنا', labelEn: 'Contact', href: '/contact' },
  ...DEFAULT_BRANDED_PAGE_LINKS.expo.navigation,
  { labelAr: 'التسجيل في المعرض', labelEn: 'Expo registration', href: '/expo/register' },
  ...DEFAULT_BRANDED_PAGE_LINKS.women.navigation,
];

const isInternalHref = (href: unknown): href is string =>
  typeof href === 'string' && /^\/(?!\/)[^\s\\]*$/.test(href);

function readList(value: unknown, fallback: BrandedPageLink[]): BrandedPageLink[] {
  if (!Array.isArray(value)) return fallback;
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const link = item as Record<string, unknown>;
    if (typeof link.labelAr !== 'string' || typeof link.labelEn !== 'string' || !isInternalHref(link.href)) return [];
    return [{ labelAr: link.labelAr, labelEn: link.labelEn, href: link.href, isActive: link.isActive !== false }];
  });
}

export function readBrandedPageLinks(value: unknown, page: 'expo' | 'women'): BrandedPageLinks {
  const fallback = DEFAULT_BRANDED_PAGE_LINKS[page];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const saved = value as Record<string, unknown>;
  return {
    navigation: readList(saved.navigation, fallback.navigation),
    footer: readList(saved.footer, fallback.footer),
  };
}

export function isValidBrandedLink(link: BrandedPageLink): boolean {
  return Boolean(link.labelAr.trim() || link.labelEn.trim()) && isInternalHref(link.href);
}
