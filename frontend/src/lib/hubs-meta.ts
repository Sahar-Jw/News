import type { GroupId } from '@/lib/setting-groups';

/**
 * Settings hub: every public page of the site is managed from Settings, as one entry with tabs (like the Training page's
 * Current / Archive / News tabs). A tab appears only for users holding one of its permissions, and an entry only when at least
 * one of its tabs does (UI hint only - the API still enforces every permission). This file is data only (no components), so the
 * navbar can import it without loading the admin screens.
 */
export interface HubTabMeta {
  key: string;
  ar: string;
  en: string;
  /** any of these permissions shows the tab */
  perms: string[];
  /** a settings tab: lists the site settings of these groups (see lib/setting-groups.ts) */
  settingsGroups?: GroupId[];
}
export interface HubMeta {
  key: string; ar: string; en: string; hintAr: string; hintEn: string; icon: string; color: string; tabs: HubTabMeta[];
  /** the address(es) of this page in the main menu: the entry takes the menu item's name (Arabic and English), so renaming the menu item renames this entry */
  nav?: string[];
}

const S = ['settings.read'];
const settings = (groups: GroupId[], ar = 'الإعدادات', en = 'Settings'): HubTabMeta => ({ key: 'settings', ar, en, perms: S, settingsGroups: groups });

export const HUBS: HubMeta[] = [
  { key: 'home', ar: 'الصفحة الرئيسية', en: 'Home page', hintAr: 'الشريط الرئيسي، ترتيب الأقسام، الاختصارات والبانر', hintEn: 'Hero slider, section order, shortcuts and banner', icon: '⌂', color: '#0f6b4a', nav: ['/'], tabs: [settings(['home'])] },
  {
    key: 'identity', ar: 'الهوية والتواصل', en: 'Identity & menu', hintAr: 'الشعار والألوان وبيانات التواصل والتذييل والقائمة الرئيسية', hintEn: 'Logo, colours, contact details, footer and main menu', icon: '✦', color: '#b8892b',
    tabs: [settings(['identity', 'other']), { key: 'footer', ar: 'التذييل', en: 'Footer', perms: ['footer.read'] }, { key: 'menu', ar: 'القائمة الرئيسية', en: 'Main menu', perms: ['nav.read'] }],
  },
  {
    key: 'training', ar: 'مركز التدريب', en: 'Training center', hintAr: 'الدورات والمدربون والمتدربون وطلبات المدربين ونصوص الصفحة', hintEn: 'Courses, trainers, trainees, trainer applications and page texts', icon: '✎', color: '#2563eb', nav: ['/training'],
    tabs: [{ key: 'courses', ar: 'الدورات', en: 'Courses', perms: ['courses.read'] }, { key: 'trainers', ar: 'المدربون', en: 'Trainers', perms: ['courses.read'] }, { key: 'trainees', ar: 'المتدربون', en: 'Trainees', perms: ['forms.submissions.read'] }, { key: 'trainerApps', ar: 'طلبات المدربين', en: 'Trainer applications', perms: ['forms.submissions.read'] }, settings(['training'])],
  },
  {
    key: 'expo', ar: 'DCC EXPO', en: 'DCC EXPO', hintAr: 'موقع المعرض المستقل: المحتوى والعارضون والبرنامج والطلبات والهوية والقائمة', hintEn: 'The separate EXPO site: content, exhibitors, programme, requests, identity and menus', icon: '◈', color: '#4b1d7a',
    tabs: [
      { key: 'about', ar: 'التعريف بالمعرض', en: 'About', perms: S }, { key: 'sectors', ar: 'القطاعات', en: 'Sectors', perms: S },
      { key: 'exhibitors', ar: 'العارضون', en: 'Exhibitors', perms: ['expo.read'] }, { key: 'sessions', ar: 'البرنامج', en: 'Programme', perms: ['expo.read'] },
      { key: 'sponsors', ar: 'الرعاة والشركاء', en: 'Sponsors', perms: ['expo.read'] }, { key: 'applications', ar: 'الطلبات', en: 'Requests', perms: ['forms.submissions.read'] },
      { key: 'faqs', ar: 'الأسئلة الشائعة', en: 'FAQs', perms: ['faqs.read'] }, { key: 'info', ar: 'المعلومات والتسجيل', en: 'Info & registration', perms: S },
      { key: 'contact', ar: 'التواصل والفريق', en: 'Contact & team', perms: S }, { key: 'identity', ar: 'الهوية والمظهر', en: 'Identity & theme', perms: S },
      { key: 'links', ar: 'القائمة والتذييل', en: 'Navigation & footer', perms: S },
    ],
  },
  {
    key: 'women', ar: 'لجنة سيدات الأعمال', en: 'Women Business Committee', hintAr: 'محتوى اللجنة وهوية صفحتها المستقلة', hintEn: 'Committee content and its separate page identity', icon: '✿', color: '#8b3d63', nav: ['/committees/women'],
    tabs: [{ key: 'content', ar: 'محتوى الصفحة', en: 'Page content', perms: ['committees.read'] }, settings(['women']), { key: 'links', ar: 'القائمة والتذييل', en: 'Navigation & footer', perms: S }],
  },
  {
    key: 'membership', ar: 'الانتساب والخدمات', en: 'Membership & services', hintAr: 'خدمات الغرفة وطلبات الانتساب ومحتوى الصفحة', hintEn: 'Chamber services, membership requests and page content', icon: '☑', color: '#0f766e', nav: ['/membership'],
    tabs: [{ key: 'services', ar: 'الخدمات', en: 'Services', perms: ['services.read'] }, { key: 'applications', ar: 'الطلبات', en: 'Requests', perms: ['forms.submissions.read'] }, { key: 'content', ar: 'محتوى الصفحة', en: 'Page content', perms: ['membership.read'] }],
  },
  {
    key: 'incubator', ar: 'حاضنة الأعمال', en: 'Business incubator', hintAr: 'المشاريع والطلبات ونصوص الصفحة', hintEn: 'Projects, requests and page texts', icon: '❖', color: '#c7878d', nav: ['/incubator'],
    tabs: [{ key: 'projects', ar: 'المشاريع', en: 'Projects', perms: ['incubator.read'] }, { key: 'applications', ar: 'الطلبات', en: 'Requests', perms: ['forms.submissions.read'] }, settings(['incubator'])],
  },
  {
    key: 'get2trade', ar: 'غيت تو تريد', en: 'Get2Trade', hintAr: 'طلبات الحجز والمساحات والباقات ومحتوى الصفحة', hintEn: 'Booking requests, spaces, packages and page content', icon: '▣', color: '#9333ea', nav: ['/get2trade'],
    tabs: [{ key: 'bookings', ar: 'الطلبات', en: 'Requests', perms: ['forms.submissions.read'] }, { key: 'spaces', ar: 'المساحات', en: 'Spaces', perms: ['get2trade.read'] }, { key: 'packages', ar: 'الباقات', en: 'Packages', perms: ['get2trade.read'] }, { key: 'content', ar: 'محتوى الصفحة', en: 'Page content', perms: ['get2trade.read'] }],
  },
  {
    key: 'services', ar: 'الخدمات والمواعيد', en: 'Services & appointments', hintAr: 'النافذة الواحدة والخدمات والمواعيد والعملاء', hintEn: 'One-stop window, services, appointments and customers', icon: '☰', color: '#0e7490', nav: ['/one-stop'],
    tabs: [
      { key: 'services', ar: 'الخدمات', en: 'Services', perms: ['services.read'] }, { key: 'hours', ar: 'أوقات الدوام', en: 'Opening hours', perms: ['settings.read'] }, { key: 'dates', ar: 'المواعيد', en: 'Appointments', perms: ['appointments.read'] },
      { key: 'dashboard', ar: 'لوحة المواعيد', en: 'Appointments dashboard', perms: ['appointments.dashboard'] }, { key: 'customers', ar: 'العملاء', en: 'Customers', perms: ['customers.read'] }, settings(['services']),
    ],
  },
  { key: 'forms', ar: 'النماذج', en: 'Forms', hintAr: 'بناء النماذج وتعديل حقولها (طلبات كل نموذج تظهر في إعدادات صفحته)', hintEn: 'Build forms and edit their inputs (the requests of each form are in the settings of its own page)', icon: '✎', color: '#0f766e', tabs: [{ key: 'builder', ar: 'النماذج', en: 'Forms', perms: ['forms.read'] }] },
  { key: 'backups', ar: 'النسخ الاحتياطي', en: 'Backups', hintAr: 'النسخ الاحتياطي المجدول واليدوي وتنزيله', hintEn: 'Scheduled and manual backups, with download', icon: '⛁', color: '#0f766e', tabs: [{ key: 'backups', ar: 'النسخ الاحتياطي', en: 'Backups', perms: ['backups.read'] }] },
  { key: 'documents', ar: 'القرارات والتعاميم', en: 'Decisions & circulars', hintAr: 'القرارات والتعاميم والقوانين والأدلة', hintEn: 'Decisions, circulars, laws and guides', icon: '▤', color: '#7c3aed', nav: ['/documents'], tabs: [{ key: 'documents', ar: 'الوثائق', en: 'Documents', perms: ['documents.read'] }] },
  { key: 'library', ar: 'المكتبة والأرشيف الرقمي', en: 'Library & digital archive', hintAr: 'وثائق المكتبة والأرشيف الرقمي', hintEn: 'Library and digital archive documents', icon: '▥', color: '#7c3aed', nav: ['/library'], tabs: [{ key: 'library', ar: 'الوثائق', en: 'Documents', perms: ['documents.read'] }] },
  { key: 'board', ar: 'مجلس الإدارة', en: 'Board', hintAr: 'أعضاء المجلس', hintEn: 'Board members', icon: '♚', color: '#b45309', nav: ['/board'], tabs: [{ key: 'board', ar: 'الأعضاء', en: 'Members', perms: ['board.read'] }] },
  { key: 'committees', ar: 'اللجان', en: 'Committees', hintAr: 'اللجان وأعضاؤها ونشاطاتها', hintEn: 'Committees, their members and activities', icon: '☷', color: '#15803d', nav: ['/committees'], tabs: [{ key: 'committees', ar: 'اللجان', en: 'Committees', perms: ['committees.read'] }] },
  {
    key: 'media', ar: 'المركز الإعلامي', en: 'Media center', hintAr: 'الأخبار (إضافة وتعديل وحذف حسب الفئة) والألبومات وإعدادات المركز الإعلامي', hintEn: 'News (add, edit, delete by category), albums and media center settings', icon: '✉', color: '#be123c', nav: ['/media'],
    tabs: [{ key: 'news', ar: 'الأخبار', en: 'News', perms: ['news.read'] }, settings(['media'])],
  },
  { key: 'gallery', ar: 'معرض الصور', en: 'Image gallery', hintAr: 'الألبومات والصور', hintEn: 'Albums and photos', icon: '▣', color: '#be123c', nav: ['/gallery'], tabs: [{ key: 'gallery', ar: 'الألبومات', en: 'Albums', perms: ['gallery.read'] }] },
  { key: 'occasions', ar: 'المعارض والفعاليات', en: 'Exhibitions & events', hintAr: 'المعارض والفعاليات السابقة', hintEn: 'Previous exhibitions and events', icon: '▦', color: '#be123c', nav: ['/occasions/previous', '/occasions'], tabs: [{ key: 'events', ar: 'المعارض والفعاليات', en: 'Exhibitions & events', perms: ['occasions.read'] }] },
  { key: 'agenda', ar: 'أجندة الغرفة', en: 'Chamber agenda', hintAr: 'الفعاليات القادمة والجارية', hintEn: 'Upcoming and current events', icon: '▦', color: '#be123c', nav: ['/agenda', '/occasions/upcoming'], tabs: [{ key: 'events', ar: 'الأجندة', en: 'Agenda', perms: ['occasions.read'] }] },
  { key: 'about', ar: 'عن الغرفة', en: 'About the chamber', hintAr: 'نص صفحة التعريف بالغرفة', hintEn: 'The about-the-chamber page text', icon: '▦', color: '#475569', nav: ['/pages/view?slug=about', '/pages/about'], tabs: [{ key: 'about', ar: 'عن الغرفة', en: 'About', perms: ['pages.read'] }] },
  { key: 'privacy', ar: 'سياسة الخصوصية', en: 'Privacy policy', hintAr: 'نص سياسة الخصوصية', hintEn: 'The privacy policy text', icon: '▦', color: '#475569', nav: ['/privacy', '/pages/view?slug=privacy', '/pages/privacy'], tabs: [{ key: 'privacy', ar: 'سياسة الخصوصية', en: 'Privacy policy', perms: ['pages.read'] }] },
  { key: 'terms', ar: 'الشروط والأحكام', en: 'Terms & conditions', hintAr: 'نص الشروط والأحكام', hintEn: 'The terms and conditions text', icon: '▦', color: '#475569', nav: ['/terms', '/pages/view?slug=terms', '/pages/terms'], tabs: [{ key: 'terms', ar: 'الشروط والأحكام', en: 'Terms & conditions', perms: ['pages.read'] }] },
  { key: 'faq', ar: 'الأسئلة الشائعة', en: 'FAQ', hintAr: 'أسئلة وأجوبة الصفحة', hintEn: 'The questions and answers of the page', icon: '?', color: '#475569', nav: ['/faq'], tabs: [{ key: 'faqs', ar: 'الأسئلة الشائعة', en: 'FAQs', perms: ['faqs.read'] }] },
  { key: 'subscribers', ar: 'النشرة البريدية', en: 'Newsletter', hintAr: 'المشتركون في نشرة الغرفة', hintEn: 'Chamber newsletter subscribers', icon: '◎', color: '#ea580c', nav: ['/subscribe'], tabs: [{ key: 'subscribers', ar: 'المشتركون', en: 'Subscribers', perms: ['subscribers.read'] }] },
  { key: 'ads', ar: 'الإعلانات', en: 'Ads', hintAr: 'إعلانات الموقع', hintEn: 'Site ads', icon: '◎', color: '#ea580c', tabs: [{ key: 'ads', ar: 'الإعلانات', en: 'Ads', perms: ['ads.read'] }] },
];

/** every permission that opens something in the hub: the navbar shows "Settings" to anyone holding at least one */
export const HUB_PERMS = [...new Set(HUBS.flatMap((h) => h.tabs.flatMap((x) => x.perms)))];

/** where each old stand-alone admin route now lives (the old routes redirect here) */
export const hubUrl = (hub: string, tab?: string) => {
  const r = resolveHub(hub, tab);
  return `/admin/settings?page=${r?.hub ?? hub}${(r ? r.tab : tab) ? `&tab=${r ? r.tab : tab}` : ''}`;
};

/**
 * Old page keys (before every page got its own entry) -> where that tab lives now. Old links and bookmarks keep working:
 * `?page=pages&tab=faqs` opens the FAQ entry, `?page=documents&tab=library` opens the Library entry, and so on.
 */
const LEGACY: Record<string, (tab?: string) => [string, string]> = {
  pages: (t) => (t === 'privacy' ? ['privacy', 'privacy'] : t === 'terms' ? ['terms', 'terms'] : t === 'faqs' ? ['faq', 'faqs'] : ['about', 'about']),
  documents: (t) => (t === 'library' ? ['library', 'library'] : ['documents', 'documents']),
  audience: (t) => (t === 'ads' ? ['ads', 'ads'] : ['subscribers', 'subscribers']),
};
/** the entry and tab that now hold an old (page, tab) pair; null when the page key is current */
export function resolveHub(hub: string, tab?: string): { hub: string; tab?: string } | null {
  if (hub === 'forms' && tab === 'backups') return { hub: 'backups', tab: 'backups' };
  if (hub === 'media' && tab === 'gallery') return { hub: 'gallery', tab: 'gallery' };
  const f = LEGACY[hub];
  if (!f) return null;
  const [h, t] = f(tab);
  return { hub: h, tab: t };
}

/** one address of a page in a comparable shape: no language prefix, no trailing slash, lower case ("/ar/pages/view/?slug=about" -> "/pages/view?slug=about") */
export const normalizeNavUrl = (u: string) => {
  let x = (u || '').trim().toLowerCase().replace(/^https?:\/\/[^/]+/, '').replace(/^\/(ar|en)(?=\/|$|\?)/, '');
  x = x.replace(/\/(?=\?|$)/g, '');
  return x || '/';
};
