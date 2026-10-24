export enum SpecialCategory {
  STATISTICS = 'STATISTICS',
  BREAKING = 'BREAKING',
  SERVICES = 'SERVICES',
  PARTNERS = 'PARTNERS',
  EXPERTS = 'EXPERTS',
  TEAM = 'TEAM',
  TESTIMONIALS = 'TESTIMONIALS',
  COMPANY_OVERVIEW = 'COMPANY_OVERVIEW',
}

export const SPECIAL_CATEGORY_CODES: string[] = Object.values(SpecialCategory);

/** Whether a special category accepts a subcategory (SRS 13.2: rejected when unsupported). */
export const SPECIAL_CATEGORY_CONFIG: Record<SpecialCategory, { supportsSubcategory: boolean }> = {
  [SpecialCategory.STATISTICS]: { supportsSubcategory: false },
  [SpecialCategory.BREAKING]: { supportsSubcategory: false },
  [SpecialCategory.SERVICES]: { supportsSubcategory: false },
  [SpecialCategory.PARTNERS]: { supportsSubcategory: false },
  [SpecialCategory.EXPERTS]: { supportsSubcategory: false },
  [SpecialCategory.TEAM]: { supportsSubcategory: false },
  [SpecialCategory.TESTIMONIALS]: { supportsSubcategory: false },
  [SpecialCategory.COMPANY_OVERVIEW]: { supportsSubcategory: false },
};

/** Built-in super role: always holds every permission and cannot be edited or deleted. */
export const TECHNICAL_ADMIN_ROLE = 'technical_admin';

export enum NewsStatus {
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
}
export enum Visibility {
  PUBLIC = 'public',
  MEMBERS = 'members',
}
export enum Language {
  AR = 'ar',
  EN = 'en',
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_BYTES = 25 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 20;
export const MAX_IMAGES_PER_RECORD = 100;

export interface PermissionDef {
  code: string;
  module: string;
  nameAr: string;
  nameEn: string;
}


export type NewsAction = 'read' | 'create' | 'update' | 'delete';
export const NEWS_ACTIONS: NewsAction[] = ['read', 'create', 'update', 'delete'];

/** Arabic / English label of each special section (used to name its permissions). */
export const SECTION_LABELS: Record<SpecialCategory, { ar: string; en: string }> = {
  [SpecialCategory.BREAKING]: { ar: 'الأخبار العاجلة', en: 'Breaking news' },
  [SpecialCategory.SERVICES]: { ar: 'الخدمات', en: 'Services' },
  [SpecialCategory.TEAM]: { ar: 'الفريق', en: 'Team' },
  [SpecialCategory.TESTIMONIALS]: { ar: 'آراء العملاء', en: 'Testimonials' },
  [SpecialCategory.PARTNERS]: { ar: 'الشركاء', en: 'Partners' },
  [SpecialCategory.EXPERTS]: { ar: 'الخبراء', en: 'Experts' },
  [SpecialCategory.STATISTICS]: { ar: 'الإحصائيات', en: 'Statistics' },
  [SpecialCategory.COMPANY_OVERVIEW]: { ar: 'الشركات الشريكة', en: 'Partner companies' },
};

const ACTION_LABELS: Record<NewsAction, { ar: string; en: string }> = {
  read: { ar: 'عرض', en: 'View' },
  create: { ar: 'إضافة إلى', en: 'Create in' },
  update: { ar: 'تعديل', en: 'Update' },
  delete: { ar: 'حذف من', en: 'Delete from' },
};

/**
 * CRUD per content kind. Regular news uses `news.<action>`; every special section has its own
 * `news.<action>.<section>` (e.g. news.read.team, news.delete.partners). Holding one never opens another.
 */
export const newsPerm = (action: NewsAction, main: string): string =>
  SPECIAL_CATEGORY_CODES.includes(main) ? `news.${action}.${main.toLowerCase()}` : `news.${action}`;

/** The four CRUD permissions of every special section, generated so the list can't drift. */
export const SECTION_PERMISSIONS: PermissionDef[] = (Object.values(SpecialCategory) as SpecialCategory[]).flatMap((sec) =>
  NEWS_ACTIONS.map((a) => ({
    code: newsPerm(a, sec),
    module: `news.${sec.toLowerCase()}`,
    nameAr: `${ACTION_LABELS[a].ar} ${SECTION_LABELS[sec].ar}`,
    nameEn: `${ACTION_LABELS[a].en} ${SECTION_LABELS[sec].en}`,
  })),
);

/**
 * SRS Annex B – every action is its own permission, so a role can be given exactly
 * "read only", "create only", "export only", etc.
 * NOTE: there is intentionally NO permission (and no route) for creating users from the admin area:
 * accounts are created only through public self-registration.
 */
export const PERMISSIONS: PermissionDef[] = [
  // news / content
  { code: 'news.read', module: 'news', nameAr: 'عرض الأخبار العادية', nameEn: 'View regular news' },
  { code: 'news.create', module: 'news', nameAr: 'إنشاء الأخبار العادية', nameEn: 'Create regular news' },
  { code: 'news.update', module: 'news', nameAr: 'تعديل الأخبار العادية', nameEn: 'Update regular news' },
  { code: 'news.delete', module: 'news', nameAr: 'حذف الأخبار العادية', nameEn: 'Delete regular news' },
  // one block per special section: news.<action>.<section> (see SECTION_PERMISSIONS above)
  ...SECTION_PERMISSIONS,
  { code: 'news.export', module: 'news', nameAr: 'تصدير المحتوى', nameEn: 'Export content (only sections the user can read)' },
  { code: 'news.publish', module: 'news', nameAr: 'نشر/جدولة المحتوى', nameEn: 'Publish / schedule content' },
  { code: 'news.category.create', module: 'news', nameAr: 'إضافة فئة جديدة', nameEn: 'Create new category value' },
  { code: 'news.category.change', module: 'news', nameAr: 'تغيير الفئة الرئيسية', nameEn: 'Change main category' },
  // users
  { code: 'users.read', module: 'users', nameAr: 'عرض المستخدمين', nameEn: 'View users' },
  { code: 'users.update', module: 'users', nameAr: 'تعديل مستخدم', nameEn: 'Update users' },
  { code: 'users.role.change', module: 'users', nameAr: 'تغيير دور مستخدم', nameEn: 'Change a user\'s role' },
  { code: 'users.delete', module: 'users', nameAr: 'حذف مستخدم', nameEn: 'Delete users' },
  { code: 'users.activate', module: 'users', nameAr: 'تفعيل المستخدمين', nameEn: 'Activate users' },
  { code: 'users.export', module: 'users', nameAr: 'تصدير المستخدمين', nameEn: 'Export users' },
  // roles & permissions
  { code: 'roles.read', module: 'roles', nameAr: 'عرض الأدوار', nameEn: 'View roles' },
  { code: 'roles.create', module: 'roles', nameAr: 'إنشاء دور', nameEn: 'Create roles' },
  { code: 'roles.update', module: 'roles', nameAr: 'تعديل دور', nameEn: 'Update roles' },
  { code: 'roles.delete', module: 'roles', nameAr: 'حذف دور', nameEn: 'Delete roles' },
  { code: 'permissions.read', module: 'roles', nameAr: 'عرض الصلاحيات', nameEn: 'View permissions' },
  { code: 'permissions.assign', module: 'roles', nameAr: 'تعيين الصلاحيات', nameEn: 'Assign permissions' },
  // settings
  { code: 'settings.read', module: 'settings', nameAr: 'عرض الإعدادات', nameEn: 'View settings' },
  { code: 'settings.update', module: 'settings', nameAr: 'تعديل الإعدادات', nameEn: 'Update settings' },
  // cities
  { code: 'cities.read', module: 'cities', nameAr: 'عرض المدن', nameEn: 'View cities' },
  { code: 'cities.create', module: 'cities', nameAr: 'إضافة مدينة', nameEn: 'Create cities' },
  { code: 'cities.update', module: 'cities', nameAr: 'تعديل مدينة', nameEn: 'Update cities' },
  { code: 'cities.delete', module: 'cities', nameAr: 'حذف مدينة', nameEn: 'Delete cities' },
  { code: 'countries.create', module: 'cities', nameAr: 'إضافة دولة', nameEn: 'Create countries' },
  // audit log
  { code: 'audit.read', module: 'audit', nameAr: 'عرض سجل التدقيق', nameEn: 'View audit log' },
  { code: 'audit.export', module: 'audit', nameAr: 'تصدير سجل التدقيق', nameEn: 'Export audit log' },
  // contact messages
  { code: 'messages.read', module: 'messages', nameAr: 'قراءة رسائل التواصل', nameEn: 'Read contact messages' },
  { code: 'messages.export', module: 'messages', nameAr: 'تصدير رسائل التواصل', nameEn: 'Export contact messages' },
  // tools: occasions
  { code: 'occasions.read', module: 'occasions', nameAr: 'عرض جدول المناسبات', nameEn: 'View occasions table' },
  { code: 'occasions.create', module: 'occasions', nameAr: 'إضافة مناسبة', nameEn: 'Create occasions' },
  { code: 'occasions.update', module: 'occasions', nameAr: 'تعديل مناسبة', nameEn: 'Update occasions' },
  { code: 'occasions.delete', module: 'occasions', nameAr: 'حذف مناسبة', nameEn: 'Delete occasions' },
  // tools: image gallery
  { code: 'gallery.read', module: 'gallery', nameAr: 'عرض معرض الصور', nameEn: 'View image gallery' },
  { code: 'gallery.create', module: 'gallery', nameAr: 'إضافة معرض صور', nameEn: 'Create galleries' },
  { code: 'gallery.update', module: 'gallery', nameAr: 'تعديل معرض صور', nameEn: 'Update galleries' },
  { code: 'gallery.delete', module: 'gallery', nameAr: 'حذف معرض صور', nameEn: 'Delete galleries' },
  // tools: newsletter subscribers
  { code: 'subscribers.read', module: 'subscribers', nameAr: 'عرض المشتركين', nameEn: 'View subscribers' },
  { code: 'subscribers.update', module: 'subscribers', nameAr: 'تفعيل / تعطيل مشترك', nameEn: 'Activate / deactivate subscribers' },
  { code: 'subscribers.delete', module: 'subscribers', nameAr: 'حذف مشترك', nameEn: 'Delete subscribers' },
  { code: 'subscribers.export', module: 'subscribers', nameAr: 'تصدير المشتركين', nameEn: 'Export subscribers' },
  // tools: ads
  { code: 'ads.read', module: 'ads', nameAr: 'عرض الإعلانات', nameEn: 'View ads' },
  { code: 'ads.create', module: 'ads', nameAr: 'إضافة إعلان', nameEn: 'Create ads' },
  { code: 'ads.update', module: 'ads', nameAr: 'تعديل إعلان', nameEn: 'Update ads' },
  { code: 'ads.delete', module: 'ads', nameAr: 'حذف إعلان', nameEn: 'Delete ads' },
];

export const PERM = {
  NEWS_READ: 'news.read',
  NEWS_CREATE: 'news.create',
  NEWS_UPDATE: 'news.update',
  NEWS_DELETE: 'news.delete',
  NEWS_EXPORT: 'news.export',
  NEWS_PUBLISH: 'news.publish',
  NEWS_CATEGORY_CREATE: 'news.category.create',
  NEWS_CATEGORY_CHANGE: 'news.category.change',
  USERS_READ: 'users.read',
  USERS_UPDATE: 'users.update',
  USERS_ROLE_CHANGE: 'users.role.change',
  USERS_DELETE: 'users.delete',
  USERS_ACTIVATE: 'users.activate',
  USERS_EXPORT: 'users.export',
  ROLES_READ: 'roles.read',
  ROLES_CREATE: 'roles.create',
  ROLES_UPDATE: 'roles.update',
  ROLES_DELETE: 'roles.delete',
  PERMISSIONS_READ: 'permissions.read',
  PERMISSIONS_ASSIGN: 'permissions.assign',
  SETTINGS_READ: 'settings.read',
  SETTINGS_UPDATE: 'settings.update',
  CITIES_READ: 'cities.read',
  CITIES_CREATE: 'cities.create',
  CITIES_UPDATE: 'cities.update',
  CITIES_DELETE: 'cities.delete',
  COUNTRIES_CREATE: 'countries.create',
  AUDIT_READ: 'audit.read',
  AUDIT_EXPORT: 'audit.export',
  MESSAGES_READ: 'messages.read',
  MESSAGES_EXPORT: 'messages.export',
  OCCASIONS_READ: 'occasions.read',
  OCCASIONS_CREATE: 'occasions.create',
  OCCASIONS_UPDATE: 'occasions.update',
  OCCASIONS_DELETE: 'occasions.delete',
  GALLERY_READ: 'gallery.read',
  GALLERY_CREATE: 'gallery.create',
  GALLERY_UPDATE: 'gallery.update',
  GALLERY_DELETE: 'gallery.delete',
  SUBSCRIBERS_READ: 'subscribers.read',
  SUBSCRIBERS_UPDATE: 'subscribers.update',
  SUBSCRIBERS_DELETE: 'subscribers.delete',
  SUBSCRIBERS_EXPORT: 'subscribers.export',
  ADS_READ: 'ads.read',
  ADS_CREATE: 'ads.create',
  ADS_UPDATE: 'ads.update',
  ADS_DELETE: 'ads.delete',
} as const;

export const AD_PLACEMENTS = ['golden', 'bronze', 'silver'] as const; // golden = top of the page, bronze = side, silver = bottom
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

/** Backwards-compatible name used by the create flow. */
export const createPermissionFor = (main: string): string => newsPerm('create', main);

/** Every permission of one action across all kinds (regular + each section), e.g. "can read *something*". */
export const newsPermsFor = (action: NewsAction): string[] => [PERM_BY_ACTION[action], ...SPECIAL_CATEGORY_CODES.map((c) => newsPerm(action, c))];
const PERM_BY_ACTION: Record<NewsAction, string> = { read: PERM.NEWS_READ, create: PERM.NEWS_CREATE, update: PERM.NEWS_UPDATE, delete: PERM.NEWS_DELETE };

export const NEWS_READ_PERMISSIONS = newsPermsFor('read');
export const NEWS_CREATE_PERMISSIONS = newsPermsFor('create');
export const NEWS_UPDATE_PERMISSIONS = newsPermsFor('update');
export const NEWS_DELETE_PERMISSIONS = newsPermsFor('delete');
/** Any news permission at all (e.g. loading the category lists the form needs). */
export const NEWS_ANY_PERMISSIONS = [...NEWS_READ_PERMISSIONS, ...NEWS_CREATE_PERMISSIONS, ...NEWS_UPDATE_PERMISSIONS, ...NEWS_DELETE_PERMISSIONS];
