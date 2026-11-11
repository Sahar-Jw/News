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
export interface HubMeta { key: string; ar: string; en: string; hintAr: string; hintEn: string; icon: string; color: string; tabs: HubTabMeta[] }

const S = ['settings.read'];
const settings = (groups: GroupId[], ar = 'الإعدادات', en = 'Settings'): HubTabMeta => ({ key: 'settings', ar, en, perms: S, settingsGroups: groups });

export const HUBS: HubMeta[] = [
  { key: 'home', ar: 'الصفحة الرئيسية', en: 'Home page', hintAr: 'الشريط الرئيسي، ترتيب الأقسام، الاختصارات والبانر', hintEn: 'Hero slider, section order, shortcuts and banner', icon: '⌂', color: '#0f6b4a', tabs: [settings(['home'])] },
  {
    key: 'identity', ar: 'الهوية والتواصل', en: 'Identity & menu', hintAr: 'الشعار والألوان وبيانات التواصل والتذييل والقائمة الرئيسية', hintEn: 'Logo, colours, contact details, footer and main menu', icon: '✦', color: '#b8892b',
    tabs: [settings(['identity', 'other']), { key: 'footer', ar: 'التذييل', en: 'Footer', perms: ['footer.read'] }, { key: 'menu', ar: 'القائمة الرئيسية', en: 'Main menu', perms: ['nav.read'] }],
  },
  {
    key: 'training', ar: 'مركز التدريب', en: 'Training center', hintAr: 'الدورات والمدربون والمتدربون وطلبات المدربين ونصوص الصفحة', hintEn: 'Courses, trainers, trainees, trainer applications and page texts', icon: '✎', color: '#2563eb',
    tabs: [{ key: 'courses', ar: 'الدورات', en: 'Courses', perms: ['courses.read'] }, { key: 'trainers', ar: 'المدربون', en: 'Trainers', perms: ['courses.read'] }, { key: 'trainees', ar: 'المتدربون', en: 'Trainees', perms: ['registrations.read'] }, { key: 'trainerApps', ar: 'طلبات المدربين', en: 'Trainer applications', perms: ['registrations.read'] }, settings(['training'])],
  },
  {
    key: 'expo', ar: 'DCC EXPO', en: 'DCC EXPO', hintAr: 'موقع المعرض المستقل: المحتوى والعارضون والبرنامج والطلبات والهوية والقائمة', hintEn: 'The separate EXPO site: content, exhibitors, programme, requests, identity and menus', icon: '◈', color: '#4b1d7a',
    tabs: [
      { key: 'about', ar: 'التعريف بالمعرض', en: 'About', perms: S }, { key: 'sectors', ar: 'القطاعات', en: 'Sectors', perms: S },
      { key: 'exhibitors', ar: 'العارضون', en: 'Exhibitors', perms: ['expo.read'] }, { key: 'sessions', ar: 'البرنامج', en: 'Programme', perms: ['expo.read'] },
      { key: 'sponsors', ar: 'الرعاة والشركاء', en: 'Sponsors', perms: ['expo.read'] }, { key: 'applications', ar: 'الطلبات', en: 'Requests', perms: ['expo.applications.read'] },
      { key: 'faqs', ar: 'الأسئلة الشائعة', en: 'FAQs', perms: ['faqs.read'] }, { key: 'info', ar: 'المعلومات والتسجيل', en: 'Info & registration', perms: S },
      { key: 'contact', ar: 'التواصل والفريق', en: 'Contact & team', perms: S }, { key: 'identity', ar: 'الهوية والمظهر', en: 'Identity & theme', perms: S },
      { key: 'links', ar: 'القائمة والتذييل', en: 'Navigation & footer', perms: S },
    ],
  },
  {
    key: 'women', ar: 'لجنة سيدات الأعمال', en: 'Women Business Committee', hintAr: 'محتوى اللجنة وهوية صفحتها المستقلة', hintEn: 'Committee content and its separate page identity', icon: '✿', color: '#8b3d63',
    tabs: [{ key: 'content', ar: 'محتوى الصفحة', en: 'Page content', perms: ['committees.read'] }, settings(['women']), { key: 'links', ar: 'القائمة والتذييل', en: 'Navigation & footer', perms: S }],
  },
  {
    key: 'membership', ar: 'الانتساب', en: 'Membership', hintAr: 'طلبات الانتساب ومحتوى الصفحة', hintEn: 'Membership requests and page content', icon: '☑', color: '#0f766e',
    tabs: [{ key: 'applications', ar: 'الطلبات', en: 'Requests', perms: ['membership.read'] }, { key: 'content', ar: 'محتوى الصفحة', en: 'Page content', perms: ['membership.read'] }],
  },
  {
    key: 'incubator', ar: 'حاضنة الأعمال', en: 'Business incubator', hintAr: 'المشاريع والطلبات ونصوص الصفحة', hintEn: 'Projects, requests and page texts', icon: '❖', color: '#c7878d',
    tabs: [{ key: 'projects', ar: 'المشاريع', en: 'Projects', perms: ['incubator.read'] }, { key: 'applications', ar: 'الطلبات', en: 'Requests', perms: ['incubator.applications.read'] }, settings(['incubator'])],
  },
  {
    key: 'get2trade', ar: 'غيت تو تريد', en: 'Get2Trade', hintAr: 'طلبات الحجز والمساحات والباقات ومحتوى الصفحة', hintEn: 'Booking requests, spaces, packages and page content', icon: '▣', color: '#9333ea',
    tabs: [{ key: 'bookings', ar: 'الطلبات', en: 'Requests', perms: ['get2trade.read'] }, { key: 'spaces', ar: 'المساحات', en: 'Spaces', perms: ['get2trade.read'] }, { key: 'packages', ar: 'الباقات', en: 'Packages', perms: ['get2trade.read'] }, { key: 'content', ar: 'محتوى الصفحة', en: 'Page content', perms: ['get2trade.read'] }],
  },
  {
    key: 'services', ar: 'الخدمات والمواعيد', en: 'Services & appointments', hintAr: 'النافذة الواحدة والخدمات والمواعيد والعملاء', hintEn: 'One-stop window, services, appointments and customers', icon: '☰', color: '#0e7490',
    tabs: [
      { key: 'services', ar: 'الخدمات', en: 'Services', perms: ['services.read'] }, { key: 'hours', ar: 'أوقات الدوام', en: 'Opening hours', perms: ['settings.read'] }, { key: 'dates', ar: 'المواعيد', en: 'Appointments', perms: ['appointments.read'] },
      { key: 'dashboard', ar: 'لوحة المواعيد', en: 'Appointments dashboard', perms: ['appointments.dashboard'] }, { key: 'customers', ar: 'العملاء', en: 'Customers', perms: ['customers.read'] }, settings(['services']),
    ],
  },
  { key: 'documents', ar: 'القرارات والتعاميم والمكتبة', en: 'Documents & digital archive', hintAr: 'الوثائق والمكتبة والأرشيف الرقمي', hintEn: 'Documents, library and digital archive', icon: '▤', color: '#7c3aed', tabs: [{ key: 'documents', ar: 'الوثائق', en: 'Documents', perms: ['documents.read'] }, { key: 'library', ar: 'المكتبة والأرشيف الرقمي', en: 'Library & digital archive', perms: ['documents.read'] }] },
  { key: 'board', ar: 'مجلس الإدارة', en: 'Board', hintAr: 'أعضاء المجلس', hintEn: 'Board members', icon: '♚', color: '#b45309', tabs: [{ key: 'board', ar: 'الأعضاء', en: 'Members', perms: ['board.read'] }] },
  { key: 'committees', ar: 'اللجان', en: 'Committees', hintAr: 'اللجان وأعضاؤها ونشاطاتها', hintEn: 'Committees, their members and activities', icon: '☷', color: '#15803d', tabs: [{ key: 'committees', ar: 'اللجان', en: 'Committees', perms: ['committees.read'] }] },
  {
    key: 'media', ar: 'المركز الإعلامي', en: 'Media center', hintAr: 'الألبومات وإعدادات المركز الإعلامي', hintEn: 'Albums and media center settings', icon: '✉', color: '#be123c',
    tabs: [{ key: 'gallery', ar: 'الألبومات', en: 'Albums', perms: ['gallery.read'] }, settings(['media'])],
  },
  { key: 'occasions', ar: 'المناسبات والأجندة', en: 'Occasions & agenda', hintAr: 'إدارة المناسبات والمعارض والأجندة فقط، مستقلة عن الأخبار', hintEn: 'Manage occasions, exhibitions and agenda separately from news', icon: '▦', color: '#be123c', tabs: [{ key: 'events', ar: 'المناسبات والمعارض', en: 'Occasions & exhibitions', perms: ['occasions.read'] }] },
  {
    key: 'pages', ar: 'الصفحات الثابتة', en: 'Static pages', hintAr: 'الصفحات والأسئلة الشائعة', hintEn: 'Pages and FAQs', icon: '▦', color: '#475569',
    tabs: [{ key: 'about', ar: 'عن الغرفة', en: 'About', perms: ['pages.read'] }, { key: 'privacy', ar: 'سياسة الخصوصية', en: 'Privacy policy', perms: ['pages.read'] }, { key: 'terms', ar: 'الشروط والأحكام', en: 'Terms & conditions', perms: ['pages.read'] }, { key: 'faqs', ar: 'الأسئلة الشائعة', en: 'FAQs', perms: ['faqs.read'] }],
  },
  { key: 'audience', ar: 'المشتركون والإعلانات', en: 'Subscribers & ads', hintAr: 'نشرة الغرفة والإعلانات', hintEn: 'Newsletter and ads', icon: '◎', color: '#ea580c', tabs: [{ key: 'subscribers', ar: 'المشتركون', en: 'Subscribers', perms: ['subscribers.read'] }, { key: 'ads', ar: 'الإعلانات', en: 'Ads', perms: ['ads.read'] }] },
];

/** every permission that opens something in the hub: the navbar shows "Settings" to anyone holding at least one */
export const HUB_PERMS = [...new Set(HUBS.flatMap((h) => h.tabs.flatMap((x) => x.perms)))];

/** where each old stand-alone admin route now lives (the old routes redirect here) */
export const hubUrl = (hub: string, tab?: string) => `/admin/settings?page=${hub}${tab ? `&tab=${tab}` : ''}`;
