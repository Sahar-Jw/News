/**
 * Main navigation (document section 7.1): the 16 destinations grouped in 5 dropdowns + Home + Contact,
 * with DCC EXPO as a highlighted button. An item is shown only when `ready` is true, so the menu never
 * links to a page that does not exist yet: the patch that adds a page flips its flag to true.
 * `to` is a site path without the language prefix; `label` is a key of the i18n dictionary.
 */
export type NavLeaf = { label: string; to: string; ready: boolean };
export type NavGroup = { key: string; label: string; items: NavLeaf[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'about',
    label: 'nav.about',
    items: [
      { label: 'nav.aboutChamber', to: '/pages/view?slug=about', ready: true },
      { label: 'site.board', to: '/board', ready: true },
      { label: 'nav.committees', to: '/committees', ready: true },
      { label: 'nav.women', to: '/committees/women', ready: true },
    ],
  },
  {
    key: 'media',
    label: 'nav.media',
    items: [
      { label: 'site.allNews', to: '/news', ready: true },
      { label: 'nav.mediaCenter', to: '/media', ready: true },
      { label: 'pub.gallery', to: '/gallery', ready: true },
      { label: 'nav.newsletter', to: '/subscribe', ready: true },
    ],
  },
  {
    key: 'services',
    label: 'site.services',
    items: [
      { label: 'nav.servicesList', to: '/services', ready: false },
      { label: 'nav.oneStop', to: '/one-stop', ready: true },
      { label: 'nav.membership', to: '/membership', ready: true },
      { label: 'site.documents', to: '/documents', ready: true },
      { label: 'nav.library', to: '/library', ready: true },
      { label: 'site.faq', to: '/faq', ready: true },
    ],
  },
  {
    key: 'dev',
    label: 'nav.dev',
    items: [
      { label: 'nav.training', to: '/training', ready: true },
      { label: 'nav.incubator', to: '/incubator', ready: false },
      { label: 'nav.get2trade', to: '/get2trade', ready: true },
    ],
  },
  {
    key: 'events',
    label: 'nav.events',
    items: [
      { label: 'nav.exhibitions', to: '/occasions/previous', ready: true },
      { label: 'nav.agenda', to: '/occasions/upcoming', ready: true },
    ],
  },
];

/** The highlighted button next to the groups. */
export const NAV_EXPO: NavLeaf = { label: 'nav.expo', to: '/expo', ready: true };
