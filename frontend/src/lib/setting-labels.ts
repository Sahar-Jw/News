/** Arabic names for the Settings table (category + key). English keeps the raw key; unknown keys fall back to it. */
const CATEGORY_AR: Record<string, string> = {
  branding: 'الهوية',
  contact: 'التواصل',
  social: 'وسائل التواصل الاجتماعي',
  hero: 'الشريط الرئيسي',
  sections_home: 'أقسام الصفحة الرئيسية',
  appearance: 'المظهر',
  labels: 'النصوص',
  pages: 'الصفحات',
  appointments: 'المواعيد',
  shortcuts: 'الاختصارات السريعة',
  one_stop: 'النافذة الواحدة',
  training: 'مركز التدريب',
  promo: 'البانر الترويجي (DCC EXPO)',
  media: 'المركز الإعلامي',
  expo: 'DCC EXPO (المعرض)',
  women: 'لجنة سيدات الأعمال',
  incubator: 'حاضنة الأعمال',
  footer: 'التذييل (Footer)',
};

const BASE_AR: Record<string, string> = {
  // footer
  contact_title: 'عنوان قسم التواصل',
  social_title: 'عنوان منصات التواصل',
  newsletter_title: 'عنوان النشرة البريدية',
  newsletter_text: 'نص النشرة البريدية',
  tagline: 'السطر السفلي (الشعار)',
  rights: 'سطر الحقوق',
  show_newsletter: 'إظهار صندوق النشرة البريدية في التذييل',
  // branding
  site_name: 'اسم الموقع',
  site_description: 'وصف الموقع',
  meta_title: 'عنوان الموقع في المتصفح (SEO)',
  logo: 'الشعار',
  favicon: 'أيقونة الموقع',
  company_name: 'اسم الشركة',
  founded_date: 'تاريخ التأسيس',
  // contact
  title: 'عنوان صفحة التواصل',
  subtitle: 'الوصف أسفل عنوان التواصل',
  show_form: 'إظهار نموذج إرسال الرسائل',
  phone: 'الهاتف',
  mobile: 'الجوال',
  fax: 'الفاكس',
  website_url: 'الموقع الإلكتروني',
  email: 'البريد الإلكتروني',
  address: 'العنوان',
  working_hours: 'ساعات العمل',
  officer_email: 'بريد مسؤول التدريب (يصله إشعار عند كل تسجيل)',
  news_topic: 'وسم أخبار المركز (تظهر الأخبار التي تحمل هذا الوسم)',
  hours: 'أوقات الاستقبال (من … إلى …)',
  days: 'أيام الدوام',
  notice: 'تنبيه عطلة أو تعديل مؤقت',
  notice_from: 'بداية التنبيه (YYYY-MM-DD، اتركه فارغاً ليظهر دائماً)',
  notice_to: 'نهاية التنبيه (YYYY-MM-DD)',
  map_url: 'رابط الخريطة',
  // social
  facebook_url: 'فيسبوك',
  x_url: 'إكس (تويتر)',
  instagram_url: 'إنستغرام',
  linkedin_url: 'لينكدإن',
  youtube_url: 'يوتيوب',
  whatsapp_url: 'واتساب',
  telegram_url: 'تيليغرام',
  // appearance
  primary_color: 'اللون الأساسي',
  secondary_color: 'اللون الثانوي',
  accent_color: 'لون التمييز',
  header_background: 'خلفية الهيدر',
  footer_background: 'خلفية الفوتر',
  breaking_bg_color: 'لون خلفية شريط الأخبار العاجلة (الشريط المتحرك)',
  breaking_label_bg_color: 'لون خلفية كلمة «عاجل» (بداية الشريط)',
  default_service_icon: 'أيقونة الخدمة الافتراضية',
  default_person_image: 'صورة الشخص الافتراضية',
  // labels
  read_more: 'نص «اقرأ المزيد»',
  breaking: 'نص «عاجل»',
  // media center
  statements_category: 'تصنيف الأخبار لتبويب «البيانات الرسمية»',
  interviews_category: 'تصنيف الأخبار لتبويب «المقابلات»',
  coverage_category: 'تصنيف الأخبار لتبويب «التغطيات الإعلامية»',
  kit_enabled: 'اعتماد Media Kit (يظهر للزوار عند التفعيل)',
  kit_logo: 'Media Kit: شعار الغرفة (يُستعمل شعار الموقع إن تُرك فارغاً)',
  kit_logo_alt: 'Media Kit: نسخة بديلة من الشعار (فاتحة / أحادية)',
  kit_identity_file: 'Media Kit: ملف دليل الهوية البصرية (PDF)',
  kit_identity_ar: 'Media Kit: وصف الهوية البصرية (عربي)',
  kit_identity_en: 'Media Kit: وصف الهوية البصرية (إنجليزي)',
  kit_about_ar: 'Media Kit: معلومات تعريفية بالغرفة (عربي)',
  kit_about_en: 'Media Kit: معلومات تعريفية بالغرفة (إنجليزي)',
  kit_hq_album: 'Media Kit: رقم ألبوم صور مقر الغرفة (من قسم الألبومات)',
  // pages
  privacy: 'سياسة الخصوصية',
  terms: 'الشروط والأحكام',
};

const HOME_SECTION_AR: Record<string, string> = {
  hero: 'الرئيسية',
  subscribe: 'الاشتراك في النشرة',
  featured: 'الأخبار المميزة',
  news: 'آخر الأخبار',
  team: 'فريقنا',
  services: 'خدماتنا',
  testimonials: 'آراء العملاء',
  partners: 'شركاؤنا',
  experts: 'خبراؤنا',
  statistics: 'إحصائياتنا',
  company: 'الشركات الشريكة',
  contact: 'تواصل معنا',
  shortcuts: 'اختصارات سريعة',
  agenda: 'أجندة الغرفة',
  women: 'لجنة سيدات الأعمال',
  gallery: 'معرض الصور',
};

/** labels of the "expo" settings category (the generic names such as logo / email would be too vague here) */
const EXPO_AR: Record<string, string> = {
  name: 'اسم المعرض', tagline: 'الشعار النصي (العنوان الرئيسي)', about: 'عن المعرض', why: 'لماذا تشارك؟ (كل نقطة في سطر)',
  start_date: 'تاريخ البداية (YYYY-MM-DD)', end_date: 'تاريخ النهاية (YYYY-MM-DD)', venue: 'مكان المعرض', hero_image: 'صورة الواجهة', logo: 'شعار المعرض',
  primary_color: 'اللون الأساسي', accent_color: 'اللون الذهبي (التمييز)', header_color: 'لون شريط التنقل', footer_color: 'لون التذييل', background_color: 'لون خلفية الصفحة', text_color: 'لون النص', floor_plan: 'مخطط المعرض أو معلومات المكان', footer_text: 'نص التذييل',
  page_links: 'روابط قائمة المعرض وتذييله',
  news_topic: 'وسم أخبار المعرض', register_open: 'التسجيل مفتوح (عارضون وزوار)',
};

const ONE_STOP_AR: Record<string, string> = {
  contact_phone: 'هاتف النافذة الواحدة', contact_email: 'بريد النافذة الواحدة', contact_address: 'عنوان النافذة الواحدة', contact_map_url: 'رابط موقع النافذة الواحدة على الخريطة',
  fees_note: 'ملاحظة تحت جدول الرسوم', eservices: 'نص قسم «الخدمات الإلكترونية (قريباً)»',
};

const WOMEN_AR: Record<string, string> = {
  name: 'اسم الصفحة', tagline: 'الشعار النصي', logo: 'شعار اللجنة', primary_color: 'اللون الأساسي', accent_color: 'لون التمييز',
  header_color: 'لون شريط التنقل', footer_color: 'لون التذييل', background_color: 'لون خلفية الصفحة', text_color: 'لون النص',
  footer_text: 'نص التذييل', rights: 'سطر الحقوق في أسفل التذييل', page_links: 'روابط قائمة اللجنة وتذييلها',
  vision: 'رؤية اللجنة', mission: 'رسالة اللجنة', goals: 'أهداف اللجنة', structure: 'الهيكلية التنظيمية والصفات',
  news_category: 'التصنيف الرئيسي لأخبار سيدات الأعمال', contact_phone: 'هاتف اللجنة', contact_email: 'بريد اللجنة',
  contact_website: 'موقع اللجنة', social_facebook_url: 'فيسبوك اللجنة', social_x_url: 'إكس اللجنة',
  social_instagram_url: 'إنستغرام اللجنة', social_linkedin_url: 'لينكدإن اللجنة', social_youtube_url: 'يوتيوب اللجنة',
  social_whatsapp_url: 'واتساب اللجنة', social_telegram_url: 'تيليغرام اللجنة',
};

/** labels of the "incubator" settings category */
const INCUBATOR_AR: Record<string, string> = {
  about: 'عن الحاضنة', vision: 'الرؤية', goals: 'الأهداف (كل هدف في سطر)', how: 'آلية العمل (كل خطوة في سطر)', opportunities: 'الفرص المتاحة (كل فرصة في سطر)',
  news_topic: 'وسم أخبار الحاضنة', officer_email: 'بريد مسؤول الحاضنة (يصله إشعار عند كل مشروع)', apply_open: 'استقبال المشاريع مفتوح (زر «قدّم مشروعك»)',
};

const SECTION_PART_AR: Record<string, string> = { title: 'العنوان', order: 'الترتيب', visible: 'الظهور', eyebrow: 'النص الصغير أعلى العنوان', subtitle: 'النص تحت العنوان' };
const SLIDE_PART_AR: Record<string, string> = { image: 'صورة', title: 'عنوان', description: 'وصف' };

export const categoryLabel = (category: string, lang: string) => (lang === 'ar' ? CATEGORY_AR[category] ?? category : category);

const STATUS_AR: Record<string, string> = { scheduled: 'مجدول', confirmed: 'مؤكد', completed: 'مكتمل', cancelled: 'ملغي' };
const STATUS_PART_AR: Record<string, string> = { ar: 'الاسم بالعربية', en: 'الاسم بالإنجليزية', color: 'اللون' };

export function keyLabel(category: string, key: string, lang: string): string {
  if (lang !== 'ar') return key;
  if (category === 'appointments') {
    const st = /^status_(.+)_(ar|en|color)$/.exec(key); // date statuses: status_<code>_ar / _en / _color
    if (st) return `حالة الموعد «${STATUS_AR[st[1]] ?? st[1]}» — ${STATUS_PART_AR[st[2]]}`;
  }
  const m = /^(.*)_(ar|en)$/.exec(key);
  const base = m ? m[1] : key;
  const suffix = m ? (m[2] === 'ar' ? ' (عربي)' : ' (إنجليزي)') : '';
  if (category === 'hero') {
    const s = /^slide(\d+)_(image|title|description)$/.exec(base);
    if (s) return `${SLIDE_PART_AR[s[2]]} الشريحة ${s[1]}${suffix}`;
  }
  if (category === 'incubator' && INCUBATOR_AR[base]) return `${INCUBATOR_AR[base]}${suffix}`;
  if (category === 'expo' && EXPO_AR[base]) return `${EXPO_AR[base]}${suffix}`;
  if (category === 'one_stop' && ONE_STOP_AR[base]) return `${ONE_STOP_AR[base]}${suffix}`;
  if (category === 'women' && WOMEN_AR[base]) return `${WOMEN_AR[base]}${suffix}`;
  if (category === 'promo') {
    const p = /^(title|text|button)_(ar|en)$/.exec(base);
    if (p) return `البانر — ${{ title: 'العنوان', text: 'النص', button: 'نص الزر' }[p[1] as 'title' | 'text' | 'button']}${suffix}`;
    if (base === 'link') return 'البانر — رابط الزر (مسار داخل الموقع يبدأ بـ / أو رابط كامل)';
    if (base === 'image') return 'البانر — الصورة (اختياري)';
  }
  if (category === 'shortcuts') {
    const s = /^item(\d+)_(title|link)$/.exec(base);
    if (s) return `الاختصار ${s[1]} — ${s[2] === 'title' ? 'العنوان' : 'الرابط (مسار داخل الموقع يبدأ بـ / أو رابط كامل)'}${suffix}`;
  }
  if (category === 'sections_home') {
    const s = /^(.+)_(title|order|visible|eyebrow|subtitle)$/.exec(base);
    if (s && HOME_SECTION_AR[s[1]]) return `${HOME_SECTION_AR[s[1]]} — ${SECTION_PART_AR[s[2]]}${suffix}`;
  }
  return BASE_AR[base] ? `${BASE_AR[base]}${suffix}` : key;
}
