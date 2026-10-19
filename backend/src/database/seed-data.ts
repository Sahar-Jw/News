import { Language, PERM, SpecialCategory, NEWS_CREATE_PERMISSIONS } from '../common/constants';
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
      PERM.NEWS_READ, PERM.NEWS_UPDATE, PERM.NEWS_DELETE, PERM.NEWS_EXPORT, PERM.NEWS_PUBLISH,
      ...NEWS_CREATE_PERMISSIONS, // regular news + every section
      PERM.NEWS_CATEGORY_CREATE, PERM.NEWS_CATEGORY_CHANGE,
      PERM.USERS_READ, PERM.USERS_UPDATE, PERM.USERS_ROLE_CHANGE, PERM.USERS_DELETE, PERM.USERS_ACTIVATE, PERM.USERS_EXPORT,
      PERM.SETTINGS_READ, PERM.SETTINGS_UPDATE,
      PERM.CITIES_READ, PERM.CITIES_CREATE, PERM.CITIES_UPDATE, PERM.CITIES_DELETE, PERM.COUNTRIES_CREATE,
      PERM.MESSAGES_READ, PERM.MESSAGES_EXPORT, PERM.PERMISSIONS_READ,
    ],
  },
  {
    code: 'content_editor',
    nameAr: 'محرر محتوى',
    nameEn: 'Content Editor',
    type: 'staff',
    permissions: [PERM.NEWS_READ, PERM.NEWS_CREATE, PERM.NEWS_UPDATE, PERM.NEWS_PUBLISH],
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
  { code: 'featured', titleAr: 'الأخبار المميزة', titleEn: 'Featured News' },
  { code: 'news', titleAr: 'آخر الأخبار', titleEn: 'Latest News' },
  { code: 'team', titleAr: 'فريقنا', titleEn: 'Our Team' },
  { code: 'services', titleAr: 'خدماتنا', titleEn: 'Our Services' },
  { code: 'testimonials', titleAr: 'آراء العملاء', titleEn: 'Testimonials' },
  { code: 'partners', titleAr: 'شركاؤنا', titleEn: 'Our Partners' },
  { code: 'experts', titleAr: 'خبراؤنا', titleEn: 'Our Experts' },
  { code: 'statistics', titleAr: 'إحصائياتنا', titleEn: 'Our Statistics' },
  { code: 'company', titleAr: 'الشركات الشريكة', titleEn: 'Partner Companies' },
  { code: 'contact', titleAr: 'تواصل معنا', titleEn: 'Contact Us' },
];

export const SETTING_SEEDS: SettingSeed[] = [
  // branding
  s('branding', 'site_name_ar', 'text', 'الموقع الإخباري'),
  s('branding', 'site_name_en', 'text', 'News Site'),
  s('branding', 'site_description_ar', 'text', ''),
  s('branding', 'site_description_en', 'text', ''),
  s('branding', 'logo', 'file'),
  s('branding', 'favicon', 'file'),
  s('branding', 'company_name_ar', 'text', ''),
  s('branding', 'company_name_en', 'text', ''),
  s('branding', 'founded_date', 'text'),
  // contact (optional items are hidden when empty)
  s('contact', 'phone', 'text'),
  s('contact', 'email', 'text'),
  s('contact', 'address_ar', 'text'),
  s('contact', 'address_en', 'text'),
  s('contact', 'working_hours_ar', 'text'),
  s('contact', 'working_hours_en', 'text'),
  s('contact', 'map_url', 'url'),
  // social
  s('social', 'facebook_url', 'url'),
  s('social', 'x_url', 'url'),
  s('social', 'instagram_url', 'url'),
  s('social', 'linkedin_url', 'url'),
  s('social', 'youtube_url', 'url'),
  s('social', 'whatsapp_url', 'url'),
  s('social', 'facebook_page_url', 'url'),
  // hero slider: 3 slides
  ...[1, 2, 3].flatMap((n) => [
    s('hero', `slide${n}_image`, 'file'),
    s('hero', `slide${n}_title_ar`, 'text'),
    s('hero', `slide${n}_title_en`, 'text'),
    s('hero', `slide${n}_description_ar`, 'text'),
    s('hero', `slide${n}_description_en`, 'text'),
  ]),
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
  // appearance
  s('appearance', 'primary_color', 'color', '#2748e8'),
  s('appearance', 'secondary_color', 'color', '#0a1236'),
  s('appearance', 'accent_color', 'color', '#ff7a2f'),
  // empty = the built-in glass header / navy footer
  s('appearance', 'header_background', 'color'),
  s('appearance', 'footer_background', 'color'),
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
