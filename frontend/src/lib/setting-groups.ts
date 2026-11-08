/** Dashboard grouping of the Settings page: each group is one part (page) of the site; a category not listed falls into "other". */
export type GroupId = 'home' | 'identity' | 'expo' | 'training' | 'incubator' | 'services' | 'media' | 'pages' | 'other';

export interface SettingGroup { id: GroupId; ar: string; en: string; hintAr: string; hintEn: string; icon: string; color: string; categories: string[] }

export const SETTING_GROUPS: SettingGroup[] = [
  { id: 'home', ar: 'الصفحة الرئيسية', en: 'Home page', hintAr: 'الشريط الرئيسي، ترتيب الأقسام، الاختصارات والبانر', hintEn: 'Hero slider, section order, shortcuts and banner', icon: '⌂', color: '#0f6b4a', categories: ['hero', 'sections_home', 'shortcuts', 'promo'] },
  { id: 'identity', ar: 'الهوية والتواصل', en: 'Identity & contact', hintAr: 'الشعار، الألوان، بيانات التواصل، التذييل ووسائل التواصل', hintEn: 'Logo, colours, contact details, footer and social links', icon: '✦', color: '#b8892b', categories: ['branding', 'appearance', 'contact', 'social', 'footer', 'labels'] },
  { id: 'expo', ar: 'DCC EXPO (المعرض)', en: 'DCC EXPO', hintAr: 'معلومات المعرض وألوانه وبيانات التواصل', hintEn: 'Expo info, colours and contact', icon: '◈', color: '#4b1d7a', categories: ['expo'] },
  { id: 'training', ar: 'مركز التدريب', en: 'Training centre', hintAr: 'نصوص وإعدادات صفحة التدريب', hintEn: 'Training page texts and options', icon: '✎', color: '#2563eb', categories: ['training'] },
  { id: 'incubator', ar: 'حاضنة الأعمال', en: 'Business incubator', hintAr: 'نصوص صفحة الحاضنة وإعداداتها', hintEn: 'Incubator page texts and options', icon: '❖', color: '#c7878d', categories: ['incubator'] },
  { id: 'services', ar: 'الخدمات والمواعيد', en: 'Services & appointments', hintAr: 'النافذة الواحدة وحالات المواعيد', hintEn: 'One-stop shop and appointment statuses', icon: '☰', color: '#0e7490', categories: ['one_stop', 'appointments'] },
  { id: 'media', ar: 'المركز الإعلامي', en: 'Media centre', hintAr: 'تبويبات المركز الإعلامي وفئات الأخبار', hintEn: 'Media centre tabs and news categories', icon: '✉', color: '#be123c', categories: ['media'] },
  { id: 'pages', ar: 'الصفحات الثابتة', en: 'Static pages', hintAr: 'نصوص الصفحات الثابتة', hintEn: 'Static page texts', icon: '▤', color: '#475569', categories: ['pages'] },
  { id: 'other', ar: 'إعدادات أخرى', en: 'Other settings', hintAr: 'إعدادات غير مصنّفة', hintEn: 'Uncategorised settings', icon: '⋯', color: '#64748b', categories: [] },
];

export const groupOf = (category: string): GroupId => SETTING_GROUPS.find((g) => g.categories.includes(category))?.id ?? 'other';
