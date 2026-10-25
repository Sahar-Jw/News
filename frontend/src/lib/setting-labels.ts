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
};

const BASE_AR: Record<string, string> = {
  // branding
  site_name: 'اسم الموقع',
  site_description: 'وصف الموقع',
  meta_title: 'عنوان الموقع في المتصفح (SEO)',
  logo: 'الشعار',
  favicon: 'أيقونة الموقع',
  company_name: 'اسم الشركة',
  founded_date: 'تاريخ التأسيس',
  // contact
  phone: 'الهاتف',
  email: 'البريد الإلكتروني',
  address: 'العنوان',
  working_hours: 'ساعات العمل',
  map_url: 'رابط الخريطة',
  // social
  facebook_url: 'فيسبوك',
  x_url: 'إكس (تويتر)',
  instagram_url: 'إنستغرام',
  linkedin_url: 'لينكدإن',
  youtube_url: 'يوتيوب',
  whatsapp_url: 'واتساب',
  facebook_page_url: 'صفحة فيسبوك',
  // appearance
  primary_color: 'اللون الأساسي',
  secondary_color: 'اللون الثانوي',
  accent_color: 'لون التمييز',
  header_background: 'خلفية الهيدر',
  footer_background: 'خلفية الفوتر',
  breaking_bg_color: 'لون خلفية شريط الأخبار العاجلة',
  default_service_icon: 'أيقونة الخدمة الافتراضية',
  default_person_image: 'صورة الشخص الافتراضية',
  // labels
  read_more: 'نص «اقرأ المزيد»',
  breaking: 'نص «عاجل»',
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
  if (category === 'sections_home') {
    const s = /^(.+)_(title|order|visible|eyebrow|subtitle)$/.exec(base);
    if (s && HOME_SECTION_AR[s[1]]) return `${HOME_SECTION_AR[s[1]]} — ${SECTION_PART_AR[s[2]]}${suffix}`;
  }
  return BASE_AR[base] ? `${BASE_AR[base]}${suffix}` : key;
}
