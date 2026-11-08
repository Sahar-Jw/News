import { DEFAULT_APPOINTMENT_STATUSES, statusSettingRows } from '../modules/appointments/appointment-statuses';
import { Language, PERM, SpecialCategory, NEWS_CREATE_PERMISSIONS, NEWS_DELETE_PERMISSIONS, NEWS_READ_PERMISSIONS, NEWS_UPDATE_PERMISSIONS } from '../common/constants';
import { SettingValueType } from '../modules/settings/site-setting.entity';

export interface CitySeed {
  code: string;
  nameAr: string;
  nameEn: string;
}

export const CITY_SEEDS: CitySeed[] = [
  { code: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh' },
  { code: 'jeddah', nameAr: 'جدة', nameEn: 'Jeddah' },
  { code: 'cairo', nameAr: 'القاهرة', nameEn: 'Cairo' },
  { code: 'amman', nameAr: 'عمّان', nameEn: 'Amman' },
  { code: 'beirut', nameAr: 'بيروت', nameEn: 'Beirut' },
  { code: 'doha', nameAr: 'الدوحة', nameEn: 'Doha' },
  { code: 'kuwait-city', nameAr: 'مدينة الكويت', nameEn: 'Kuwait City' },
  { code: 'abu-dhabi', nameAr: 'أبوظبي', nameEn: 'Abu Dhabi' },
  { code: 'muscat', nameAr: 'مسقط', nameEn: 'Muscat' },
];

export interface RoleSeed {
  code: string;
  nameAr: string;
  nameEn: string;
  type: string;
  /** '*' = every permission */
  permissions: string[] | '*';
}

export const ROLE_SEEDS: RoleSeed[] = [
  { code: 'technical_admin', nameAr: 'مدير تقني', nameEn: 'Technical Administrator', type: 'admin', permissions: '*' },
  {
    code: 'administrator',
    nameAr: 'مدير',
    nameEn: 'Administrator',
    type: 'admin',
    permissions: [
      PERM.NEWS_EXPORT, PERM.NEWS_PUBLISH, PERM.NEWS_FEATURE,
      // full CRUD on regular news and on every section
      ...NEWS_READ_PERMISSIONS, ...NEWS_CREATE_PERMISSIONS, ...NEWS_UPDATE_PERMISSIONS, ...NEWS_DELETE_PERMISSIONS,
      PERM.NEWS_CATEGORY_CREATE, PERM.NEWS_CATEGORY_CHANGE,
      PERM.USERS_READ, PERM.USERS_UPDATE, PERM.USERS_ROLE_CHANGE, PERM.USERS_DELETE, PERM.USERS_ACTIVATE, PERM.USERS_EXPORT, PERM.USERS_PASSWORD_RESET, PERM.USERS_CV_DOWNLOAD,
      PERM.SETTINGS_READ, PERM.SETTINGS_UPDATE,
      PERM.NAV_READ, PERM.NAV_UPDATE, PERM.FOOTER_READ, PERM.FOOTER_UPDATE,
      PERM.EXPO_READ, PERM.EXPO_CREATE, PERM.EXPO_UPDATE, PERM.EXPO_DELETE,
      PERM.EXPO_APPLICATIONS_READ, PERM.EXPO_APPLICATIONS_UPDATE, PERM.EXPO_APPLICATIONS_EXPORT, PERM.EXPO_APPLICATIONS_DELETE,
      PERM.FAQS_READ, PERM.FAQS_CREATE, PERM.FAQS_UPDATE, PERM.FAQS_DELETE,
      PERM.COMMITTEES_READ, PERM.COMMITTEES_CREATE, PERM.COMMITTEES_UPDATE, PERM.COMMITTEES_DELETE,
      PERM.CITIES_READ, PERM.CITIES_CREATE, PERM.CITIES_UPDATE, PERM.CITIES_DELETE, PERM.COUNTRIES_CREATE,
      PERM.MESSAGES_READ, PERM.MESSAGES_EXPORT, PERM.PERMISSIONS_READ,
    ],
  },
  {
    code: 'content_editor',
    nameAr: 'محرر محتوى',
    nameEn: 'Content Editor',
    type: 'staff',
    permissions: [PERM.NEWS_READ, PERM.NEWS_CREATE, PERM.NEWS_UPDATE, PERM.NEWS_PUBLISH, PERM.NEWS_FEATURE],
  },
  { code: 'registered', nameAr: 'مستخدم مسجّل', nameEn: 'Registered User', type: 'member', permissions: [] },
];

export interface SettingSeed {
  category: string;
  key: string;
  type: SettingValueType;
  value: string | null;
}

const s = (category: string, key: string, type: SettingValueType, value: string | null = null): SettingSeed => ({ category, key, type, value });

export const HOME_SECTIONS: { code: string; titleAr: string; titleEn: string }[] = [
  { code: 'hero', titleAr: 'الرئيسية', titleEn: 'Home' },
  { code: 'shortcuts', titleAr: 'اختصارات سريعة', titleEn: 'Quick links' },
  { code: 'featured', titleAr: 'الأخبار المميزة', titleEn: 'Featured News' },
  { code: 'news', titleAr: 'آخر الأخبار', titleEn: 'Latest News' },
  { code: 'agenda', titleAr: 'أجندة الغرفة', titleEn: 'Chamber agenda' },
  { code: 'women', titleAr: 'لجنة سيدات الأعمال', titleEn: 'Women Business Committee' },
  { code: 'gallery', titleAr: 'معرض الصور والفيديو', titleEn: 'Photo & video gallery' },
  { code: 'team', titleAr: 'فريقنا', titleEn: 'Our Team' },
  { code: 'services', titleAr: 'خدماتنا', titleEn: 'Our Services' },
  { code: 'testimonials', titleAr: 'آراء العملاء', titleEn: 'Testimonials' },
  { code: 'partners', titleAr: 'شركاؤنا', titleEn: 'Our Partners' },
  { code: 'experts', titleAr: 'خبراؤنا', titleEn: 'Our Experts' },
  { code: 'statistics', titleAr: 'إحصائياتنا', titleEn: 'Our Statistics' },
  { code: 'company', titleAr: 'الشركات الشريكة', titleEn: 'Partner Companies' },
  { code: 'subscribe', titleAr: 'اشترك في نشرتنا', titleEn: 'Subscribe to our newsletter' },
  { code: 'contact', titleAr: 'تواصل معنا', titleEn: 'Contact Us' },
];

/** Default quick links of the home page (all point to pages that already exist). */
export const SHORTCUT_DEFAULTS: { ar: string; en: string; link: string }[] = [
  { ar: 'آخر الأخبار', en: 'Latest news', link: '/news' },
  { ar: 'معرض الصور', en: 'Photo gallery', link: '/gallery' },
  { ar: 'المناسبات القادمة', en: 'Upcoming occasions', link: '/occasions/upcoming' },
  { ar: 'المناسبات السابقة', en: 'Previous occasions', link: '/occasions/previous' },
  { ar: 'الأسئلة الشائعة', en: 'FAQ', link: '/faq' },
  { ar: 'تواصل معنا', en: 'Contact us', link: '/contact' },
];

/** Default main menu (only pages that exist). Used by the seed on an empty database; the migration inserts the same rows. Edited later from Settings -> Main menu. */
export const NAV_DEFAULTS: { ar: string; en: string; items: { ar: string; en: string; url: string }[] }[] = [
  { ar: 'عن الغرفة', en: 'About', items: [
    { ar: 'عن الغرفة', en: 'About the chamber', url: '/pages/view?slug=about' },
    { ar: 'مجلس الإدارة', en: 'Board of Directors', url: '/board' },
    { ar: 'اللجان والقطاعات', en: 'Committees & sectors', url: '/committees' },
    { ar: 'لجنة سيدات الأعمال', en: 'Businesswomen committee', url: '/committees/women' },
  ] },
  { ar: 'الأخبار والإعلام', en: 'News & media', items: [
    { ar: 'كل الأخبار', en: 'All news', url: '/news' },
    { ar: 'المركز الإعلامي', en: 'Media center', url: '/media' },
    { ar: 'معرض الصور', en: 'Image gallery', url: '/gallery' },
    { ar: 'النشرة البريدية', en: 'Newsletter', url: '/subscribe' },
  ] },
  { ar: 'الخدمات', en: 'Services', items: [
    { ar: 'النافذة الواحدة', en: 'One-stop window', url: '/one-stop' },
    { ar: 'القرارات والتعاميم', en: 'Decisions & circulars', url: '/documents' },
    { ar: 'المكتبة والأرشيف الرقمي', en: 'Library & digital archive', url: '/library' },
    { ar: 'الأسئلة الشائعة', en: 'FAQ', url: '/faq' },
  ] },
  { ar: 'التطوير والأعمال', en: 'Development & business', items: [
    { ar: 'مركز التدريب الإداري', en: 'Management training center', url: '/training' },
  ] },
  { ar: 'المعارض والفعاليات', en: 'Exhibitions & events', items: [
    { ar: 'المعارض والفعاليات', en: 'Exhibitions & events', url: '/occasions/previous' },
    { ar: 'أجندة الغرفة', en: 'Chamber agenda', url: '/occasions/upcoming' },
  ] },
];

export const SETTING_SEEDS: SettingSeed[] = [
  // branding
  s('branding', 'site_name_ar', 'text', 'الموقع الإخباري'),
  s('branding', 'site_name_en', 'text', 'News Site'),
  s('branding', 'site_description_ar', 'text', ''),
  s('branding', 'site_description_en', 'text', ''),
  // browser-tab title / SEO title per language (empty = the site name is used)
  s('branding', 'meta_title_ar', 'text'),
  s('branding', 'meta_title_en', 'text'),
  s('branding', 'logo', 'file'),
  s('branding', 'favicon', 'file'),
  s('branding', 'company_name_ar', 'text', ''),
  s('branding', 'company_name_en', 'text', ''),
  s('branding', 'founded_date', 'text'),
  // contact (optional items are hidden when empty)
  s('contact', 'phone', 'text'),
  s('contact', 'mobile', 'text'),
  s('contact', 'fax', 'text'),
  s('contact', 'email', 'text'),
  s('contact', 'website_url', 'url'),
  s('contact', 'address_ar', 'text'),
  s('contact', 'address_en', 'text'),
  s('contact', 'working_hours_ar', 'text'),
  s('contact', 'working_hours_en', 'text'),
  s('contact', 'map_url', 'url'),
  // One-Stop window: opening hours + a temporary notice (shown only between notice_from and notice_to, or always when both are empty)
  s('one_stop', 'hours_ar', 'text'),
  s('one_stop', 'hours_en', 'text'),
  s('one_stop', 'days_ar', 'text'),
  s('one_stop', 'days_en', 'text'),
  s('one_stop', 'notice_ar', 'text'),
  s('one_stop', 'notice_en', 'text'),
  s('one_stop', 'notice_from', 'text'),
  s('one_stop', 'notice_to', 'text'),
  // Administrative Training Center: who gets the registration e-mails, and the news topic shown in the "center news" tab
  s('training', 'officer_email', 'text'),
  s('training', 'news_topic_ar', 'text'),
  s('training', 'news_topic_en', 'text'),
  // DCC EXPO: event info, identity colours and who receives the requests (exhibitors / sponsors / programme are rows of expo_items)
  s('expo', 'name_ar', 'text', 'DCC EXPO'),
  s('expo', 'name_en', 'text', 'DCC EXPO'),
  s('expo', 'tagline_ar', 'text', 'معرض غرفة تجارة دمشق'),
  s('expo', 'tagline_en', 'text', 'Damascus Chamber of Commerce Expo'),
  s('expo', 'about_ar', 'text'),
  s('expo', 'about_en', 'text'),
  s('expo', 'why_ar', 'text'),
  s('expo', 'why_en', 'text'),
  s('expo', 'start_date', 'text'),
  s('expo', 'end_date', 'text'),
  s('expo', 'venue_ar', 'text'),
  s('expo', 'venue_en', 'text'),
  s('expo', 'hero_image', 'file'),
  s('expo', 'logo', 'file'),
  s('expo', 'primary_color', 'color', '#4b1d7a'),
  s('expo', 'accent_color', 'color', '#c9a227'),
  s('expo', 'header_color', 'color', '#3b155f'),
  s('expo', 'footer_color', 'color', '#2d1049'),
  s('expo', 'background_color', 'color', '#faf8fc'),
  s('expo', 'text_color', 'color', '#1f2937'),
  s('expo', 'floor_plan_ar', 'text'),
  s('expo', 'floor_plan_en', 'text'),
  s('expo', 'footer_text_ar', 'text'),
  s('expo', 'footer_text_en', 'text'),
  s('expo', 'page_links', 'json', JSON.stringify({
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
  })),
  s('expo', 'contact_email', 'text'),
  s('expo', 'contact_phone', 'text'),
  s('expo', 'news_topic_ar', 'text', 'المعرض'),
  s('expo', 'news_topic_en', 'text', 'EXPO'),
  s('expo', 'register_open', 'boolean', 'true'),
  // Women Business Committee page identity; the committee profile and its activities are managed separately
  s('women', 'name_ar', 'text', 'لجنة سيدات الأعمال'),
  s('women', 'name_en', 'text', 'Women Business Committee'),
  s('women', 'tagline_ar', 'text', 'تمكين سيدات الأعمال'),
  s('women', 'tagline_en', 'text', 'Empowering Women in Business'),
  s('women', 'logo', 'file'),
  s('women', 'primary_color', 'color', '#8b3d63'),
  s('women', 'accent_color', 'color', '#d2a84a'),
  s('women', 'header_color', 'color', '#54213d'),
  s('women', 'footer_color', 'color', '#3c172c'),
  s('women', 'background_color', 'color', '#fff9fb'),
  s('women', 'text_color', 'color', '#34232c'),
  s('women', 'footer_text_ar', 'text'),
  s('women', 'footer_text_en', 'text'),
  s('women', 'page_links', 'json', JSON.stringify({
    navigation: [
      { labelAr: 'عن اللجنة', labelEn: 'About', href: '/committees/women#about' },
      { labelAr: 'الأعضاء', labelEn: 'Members', href: '/committees/women#members' },
      { labelAr: 'الاجتماعات والزيارات', labelEn: 'Meetings & visits', href: '/committees/women#meetings' },
      { labelAr: 'المبادرات', labelEn: 'Initiatives', href: '/committees/women#initiatives' },
      { labelAr: 'الوسائط', labelEn: 'Media', href: '/committees/women#media' },
    ],
    footer: [
      { labelAr: 'عن اللجنة', labelEn: 'About', href: '/committees/women#about' },
      { labelAr: 'الأعضاء', labelEn: 'Members', href: '/committees/women#members' },
      { labelAr: 'المبادرات', labelEn: 'Initiatives', href: '/committees/women#initiatives' },
      { labelAr: 'الوسائط', labelEn: 'Media', href: '/committees/women#media' },
    ],
  })),
  // Business Incubator page: goals / how it works / opportunities are one item per line; officer_email gets the notifications; apply_open turns the form on/off
  s('incubator', 'about_ar', 'text'),
  s('incubator', 'about_en', 'text'),
  s('incubator', 'vision_ar', 'text'),
  s('incubator', 'vision_en', 'text'),
  s('incubator', 'goals_ar', 'text'),
  s('incubator', 'goals_en', 'text'),
  s('incubator', 'how_ar', 'text'),
  s('incubator', 'how_en', 'text'),
  s('incubator', 'opportunities_ar', 'text'),
  s('incubator', 'opportunities_en', 'text'),
  s('incubator', 'news_topic_ar', 'text', 'حاضنة الأعمال'),
  s('incubator', 'news_topic_en', 'text', 'Business Incubator'),
  s('incubator', 'officer_email', 'text'),
  s('incubator', 'apply_open', 'boolean', 'true'),
  // social
  s('social', 'facebook_url', 'url'),
  s('social', 'x_url', 'url'),
  s('social', 'instagram_url', 'url'),
  s('social', 'linkedin_url', 'url'),
  s('social', 'youtube_url', 'url'),
  s('social', 'whatsapp_url', 'url'),
  s('social', 'telegram_url', 'url'),
  // hero slider: 5 slides
  ...[1, 2, 3, 4, 5].flatMap((n) => [
    s('hero', `slide${n}_image`, 'file'),
    s('hero', `slide${n}_title_ar`, 'text'),
    s('hero', `slide${n}_title_en`, 'text'),
    s('hero', `slide${n}_description_ar`, 'text'),
    s('hero', `slide${n}_description_en`, 'text'),
  ]),
  // home "quick links" section: up to 6 shortcuts (an empty title hides the shortcut; a link starting with / stays inside the site)
  ...SHORTCUT_DEFAULTS.flatMap((d, i) => [
    s('shortcuts', `item${i + 1}_title_ar`, 'text', d.ar),
    s('shortcuts', `item${i + 1}_title_en`, 'text', d.en),
    s('shortcuts', `item${i + 1}_link`, 'text', d.link),
  ]),
  // promo banner next to the agenda on the home page (DCC EXPO); empty title = no banner
  s('promo', 'title_ar', 'text'), s('promo', 'title_en', 'text'),
  s('promo', 'text_ar', 'text'), s('promo', 'text_en', 'text'),
  s('promo', 'button_ar', 'text'), s('promo', 'button_en', 'text'),
  s('promo', 'link', 'text'), s('promo', 'image', 'file'),
  // Media Center tabs: which news category each tab reads (the admin writes the same label when posting the news)
  s('media', 'statements_category', 'text', 'بيانات رسمية'),
  s('media', 'interviews_category', 'text', 'مقابلات'),
  s('media', 'coverage_category', 'text', 'تغطيات إعلامية'),
  // Footer: titles, the newsletter text, the tagline and the rights line (the link columns live in footer_groups / footer_links)
  s('footer', 'contact_title_ar', 'text', 'تواصل معنا'),
  s('footer', 'contact_title_en', 'text', 'Contact us'),
  s('footer', 'social_title_ar', 'text', 'منصات التواصل'),
  s('footer', 'social_title_en', 'text', 'Social media'),
  s('footer', 'newsletter_title_ar', 'text', 'نشرة البريد'),
  s('footer', 'newsletter_title_en', 'text', 'Newsletter'),
  s('footer', 'newsletter_text_ar', 'text', 'اشترك ليصلك جديد الغرفة'),
  s('footer', 'newsletter_text_en', 'text', 'Subscribe to receive the chamber news'),
  s('footer', 'tagline_ar', 'text', 'غرفة تجارة دمشق - بيت كل تاجر'),
  s('footer', 'tagline_en', 'text', 'Damascus Chamber of Commerce — the home of every merchant'),
  s('footer', 'rights_ar', 'text', '© جميع الحقوق محفوظة لغرفة تجارة دمشق'),
  s('footer', 'rights_en', 'text', '© All rights reserved to the Damascus Chamber of Commerce'),
  s('footer', 'show_newsletter', 'boolean', 'true'),
  // homepage sections: titles, order, visibility
  ...HOME_SECTIONS.flatMap((sec, i) => [
    s('sections_home', `${sec.code}_title_ar`, 'text', sec.titleAr),
    s('sections_home', `${sec.code}_title_en`, 'text', sec.titleEn),
    s('sections_home', `${sec.code}_order`, 'number', String(i + 1)),
    s('sections_home', `${sec.code}_visible`, 'boolean', 'true'),
    // optional small label above the title and a line under it, per language (empty = not shown)
    ...(sec.code === 'hero'
      ? []
      : [
          s('sections_home', `${sec.code}_eyebrow_ar`, 'text'),
          s('sections_home', `${sec.code}_eyebrow_en`, 'text'),
          s('sections_home', `${sec.code}_subtitle_ar`, 'text'),
          s('sections_home', `${sec.code}_subtitle_en`, 'text'),
        ]),
  ]),
  // dates (appointments): the statuses the Dates form offers, editable from Settings
  ...statusSettingRows(DEFAULT_APPOINTMENT_STATUSES).map(([key, type, value]) => s('appointments', key, type, value)),
  // appearance
  // palette of the logo: emerald green, deep forest green, antique gold
  s('appearance', 'primary_color', 'color', '#0a5c3d'),
  s('appearance', 'secondary_color', 'color', '#043323'),
  s('appearance', 'accent_color', 'color', '#bd9f6e'),
  // empty = the built-in cream glass header / deep green footer
  s('appearance', 'header_background', 'color'),
  s('appearance', 'footer_background', 'color'),
  // breaking-news bar: two independent colours. Empty = the built-in look (green gradient bar / gold label).
  s('appearance', 'breaking_bg_color', 'color'), // the scrolling bar
  s('appearance', 'breaking_label_bg_color', 'color'), // the «Breaking» label block at the start of the bar
  s('appearance', 'default_service_icon', 'file'),
  s('appearance', 'default_person_image', 'file'),
  // labels
  s('labels', 'read_more_ar', 'text', 'اقرأ المزيد'),
  s('labels', 'read_more_en', 'text', 'Read more'),
  s('labels', 'breaking_ar', 'text', 'عاجل'),
  s('labels', 'breaking_en', 'text', 'Breaking'),
  // legal pages (managed text, no invented legal content)
  s('pages', 'privacy_ar', 'json'),
  s('pages', 'privacy_en', 'json'),
  s('pages', 'terms_ar', 'json'),
  s('pages', 'terms_en', 'json'),
];

export interface NewsSeed {
  title: string;
  subject: string;
  mainCategory: string;
  subcategory?: string;
  topics: string[];
  body: string;
  language: Language;
  isFeatured?: boolean;
  rating?: number;
}

const demoNews = (
  language: Language,
  title: string,
  subject: string,
  mainCategory: string,
  topics: string[],
  body: string,
  options: Pick<NewsSeed, 'subcategory' | 'isFeatured' | 'rating'> = {},
): NewsSeed => ({ language, title, subject, mainCategory, topics, body, ...options });

/** Clearly labelled examples, not real news, intended to make a fresh installation usable. */
export const NEWS_SEEDS: NewsSeed[] = [
  demoNews(Language.AR, 'نموذج: مبادرة مجتمعية لتعزيز القراءة', 'مثال تجريبي لإظهار بطاقة خبر باللغة العربية.', 'مجتمع', ['القراءة', 'المجتمع'], '<p>هذا محتوى تجريبي يوضح شكل الخبر في الموقع. استبدله بمادة تحريرية موثوقة قبل نشر الموقع للجمهور.</p>', { subcategory: 'مبادرات', isFeatured: true }),
  demoNews(Language.AR, 'نموذج: أفكار عملية للتعلم مدى الحياة', 'مثال تجريبي لمقال في قسم التعليم.', 'تعليم', ['التعليم', 'المعرفة'], '<p>يعرض هذا المثال تنسيق المقالات الطويلة وإمكانية تصنيفها حسب الموضوع.</p>', { subcategory: 'معرفة', isFeatured: true }),
  demoNews(Language.AR, 'نموذج: مساحة جديدة للحوار الثقافي', 'مثال تجريبي حول الأنشطة الثقافية.', 'ثقافة', ['الثقافة', 'المجتمع'], '<p>نص توضيحي تجريبي. أضف هنا معلومات مدققة ومصادر واضحة عند إعداد المحتوى الفعلي.</p>', { subcategory: 'فعاليات' }),
  demoNews(Language.AR, 'نموذج: حلول رقمية لخدمات أسهل', 'مثال تجريبي لموضوع عن التقنية.', 'تقنية', ['التقنية', 'الخدمات'], '<p>هذا خبر نموذجي لا يتضمن ادعاءات عن أحداث حقيقية، والغرض منه معاينة واجهة الموقع فقط.</p>', { subcategory: 'ابتكار' }),
  demoNews(Language.EN, 'Sample: A community initiative to encourage reading', 'A sample article card in English.', 'Community', ['reading', 'community'], '<p>This is sample content to demonstrate the news page. Replace it with verified editorial material before publishing the site to the public.</p>', { subcategory: 'Initiatives', isFeatured: true }),
  demoNews(Language.EN, 'Sample: Practical ideas for lifelong learning', 'A sample article in the education category.', 'Education', ['education', 'knowledge'], '<p>This example demonstrates long-form article formatting and topic classification.</p>', { subcategory: 'Knowledge', isFeatured: true }),
  demoNews(Language.EN, 'Sample: A new space for cultural dialogue', 'A sample story about cultural activities.', 'Culture', ['culture', 'community'], '<p>Placeholder sample text. Add verified information and clear sources when preparing real content.</p>', { subcategory: 'Events' }),
  demoNews(Language.EN, 'Sample: Digital solutions for simpler services', 'A sample technology story.', 'Technology', ['technology', 'services'], '<p>This sample does not make claims about real events; it is included only to preview the website.</p>', { subcategory: 'Innovation' }),

  demoNews(Language.AR, 'نموذج: خبر عاجل تجريبي', 'محتوى توضيحي لقسم الأخبار العاجلة.', SpecialCategory.BREAKING, ['نموذج'], '<p>عنصر تجريبي. احذفه أو استبدله قبل إطلاق الموقع.</p>'),
  demoNews(Language.EN, 'Sample: Breaking news placeholder', 'A placeholder for the breaking news section.', SpecialCategory.BREAKING, ['sample'], '<p>Sample item. Remove or replace it before launch.</p>'),
  demoNews(Language.AR, 'نموذج: خدمات تحريرية وإعلامية', 'تعريف تجريبي بخدمة يمكن للمؤسسة تقديمها.', SpecialCategory.SERVICES, ['الخدمات'], '<p>هذا وصف افتراضي قابل للتعديل من لوحة إدارة المحتوى.</p>'),
  demoNews(Language.EN, 'Sample: Editorial and media services', 'A sample description of a possible organizational service.', SpecialCategory.SERVICES, ['services'], '<p>This placeholder description can be edited in the content management panel.</p>'),
  demoNews(Language.AR, 'نموذج: شركاؤنا', 'عنصر تجريبي لإظهار قسم الشركاء؛ أضف صورة الشعار من لوحة الإدارة.', SpecialCategory.PARTNERS, ['الشراكات'], '<p>أضف بيانات الشريك المعتمدة وشعاره قبل استخدام هذا القسم.</p>'),
  demoNews(Language.EN, 'Sample: Our partners', 'A sample partner item; upload a logo in the administration panel.', SpecialCategory.PARTNERS, ['partnerships'], '<p>Add approved partner details and a logo before using this section.</p>'),
  demoNews(Language.AR, 'نموذج: فريق التحرير', 'عنصر تجريبي للتعريف بفريق العمل.', SpecialCategory.TEAM, ['الفريق'], '<p>حدّث الاسم والنبذة والصورة ببيانات أعضاء الفريق الفعلية.</p>'),
  demoNews(Language.EN, 'Sample: Editorial team', 'A sample introduction to the team section.', SpecialCategory.TEAM, ['team'], '<p>Replace the name, biography, and image with approved team information.</p>'),
  demoNews(Language.AR, 'نموذج: رأي تجريبي', 'مثال توضيحي لشكل عرض التقييمات.', SpecialCategory.TESTIMONIALS, ['آراء'], '<p>هذا اقتباس افتراضي للمعاينة فقط، وليس شهادة عميل حقيقية.</p>', { rating: 5 }),
  demoNews(Language.EN, 'Sample: A demonstration testimonial', 'An example of how ratings are displayed.', SpecialCategory.TESTIMONIALS, ['testimonials'], '<p>This is placeholder copy for preview purposes only, not a real customer endorsement.</p>', { rating: 5 }),
  demoNews(Language.AR, 'نموذج: خبراء في مجالات متعددة', 'بطاقة تجريبية لقسم الخبراء.', SpecialCategory.EXPERTS, ['الخبراء'], '<p>استبدل هذا المحتوى بسيرة خبير معتمدة، وأضف صورته من لوحة الإدارة.</p>'),
  demoNews(Language.EN, 'Sample: Experts across disciplines', 'A sample card for the experts section.', SpecialCategory.EXPERTS, ['experts'], '<p>Replace this copy with an approved expert biography and upload their photo in the admin panel.</p>'),
  demoNews(Language.AR, 'نموذج: أرقام توضيحية', 'بيانات تجريبية لا تمثل إحصاءات حقيقية.', SpecialCategory.STATISTICS, ['إحصاءات'], '<p>بيانات للمعاينة فقط. أدخل إحصاءات موثقة قبل إظهارها للزوار.</p>'),
  demoNews(Language.EN, 'Sample: Demonstration statistics', 'Placeholder figures that do not represent real statistics.', SpecialCategory.STATISTICS, ['statistics'], '<p>Preview content only. Enter verified statistics before showing this section to visitors.</p>'),
  demoNews(Language.AR, 'نموذج: نبذة عن المؤسسة', 'تعريف تجريبي قابل للتعديل.', SpecialCategory.COMPANY_OVERVIEW, ['المؤسسة'], '<p>اكتب هنا نبذة المؤسسة المعتمدة ورسالتها ومعلوماتها الصحيحة.</p>'),
  demoNews(Language.EN, 'Sample: About the organization', 'An editable sample introduction.', SpecialCategory.COMPANY_OVERVIEW, ['organization'], '<p>Add the organization’s approved introduction, mission, and accurate details here.</p>'),
];

export interface ContactMessageSeed {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const CONTACT_MESSAGE_SEEDS: ContactMessageSeed[] = [
  {
    name: 'Sample Visitor',
    email: 'visitor@example.test',
    subject: 'Sample contact message',
    message: 'This is a sample message for previewing the contact inbox. It is not a real submission.',
  },
];
