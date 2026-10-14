/** Home page sections that can be ordered / hidden from site settings (category sections_home). */
export const SECTION_ORDER_KEYS = ['hero', 'featured', 'news', 'team', 'services', 'testimonials', 'partners', 'experts', 'statistics', 'company', 'contact'] as const;
export type HomeSection = (typeof SECTION_ORDER_KEYS)[number];
