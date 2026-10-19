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
export const MAX_FILES_PER_UPLOAD = 20;
export const MAX_IMAGES_PER_RECORD = 100;

export interface PermissionDef {
  code: string;
  module: string;
  nameAr: string;
  nameEn: string;
}

/**
 * SRS Annex B – every action is its own permission, so a role can be given exactly
 * "read only", "create only", "export only", etc.
 * NOTE: there is intentionally NO permission (and no route) for creating users from the admin area:
 * accounts are created only through public self-registration.
 */
export const PERMISSIONS: PermissionDef[] = [
  // news / content
  { code: 'news.read', module: 'news', nameAr: 'عرض المحتوى', nameEn: 'View content' },
  { code: 'news.create', module: 'news', nameAr: 'إنشاء الأخبار العادية', nameEn: 'Create regular news' },
  { code: 'news.create.breaking', module: 'news', nameAr: 'إنشاء خبر عاجل', nameEn: 'Create breaking news' },
  { code: 'news.create.services', module: 'news', nameAr: 'إضافة خدمة', nameEn: 'Create service' },
  { code: 'news.create.team', module: 'news', nameAr: 'إضافة عضو فريق', nameEn: 'Add team member' },
  { code: 'news.create.testimonials', module: 'news', nameAr: 'إضافة رأي عميل', nameEn: 'Add testimonial' },
  { code: 'news.create.partners', module: 'news', nameAr: 'إضافة شريك', nameEn: 'Add partner' },
  { code: 'news.create.experts', module: 'news', nameAr: 'إضافة خبير', nameEn: 'Add expert' },
  { code: 'news.create.statistics', module: 'news', nameAr: 'إضافة إحصائية', nameEn: 'Add statistic' },
  { code: 'news.create.company_overview', module: 'news', nameAr: 'إضافة شركة شريكة', nameEn: 'Add partner company' },
  { code: 'news.update', module: 'news', nameAr: 'تعديل المحتوى', nameEn: 'Update content' },
  { code: 'news.delete', module: 'news', nameAr: 'حذف المحتوى', nameEn: 'Delete content' },
  { code: 'news.export', module: 'news', nameAr: 'تصدير المحتوى', nameEn: 'Export content' },
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
} as const;

/**
 * Creating content needs the permission of the section it goes into: `news.create` for regular news and
 * `news.create.<section>` (e.g. news.create.team) for each special section. One permission never opens all of them.
 */
export const createPermissionFor = (main: string): string =>
  SPECIAL_CATEGORY_CODES.includes(main) ? `news.create.${main.toLowerCase()}` : PERM.NEWS_CREATE;

/** Every "create" permission (a route that only needs to know the user can create *something*). */
export const NEWS_CREATE_PERMISSIONS: string[] = [PERM.NEWS_CREATE, ...SPECIAL_CATEGORY_CODES.map(createPermissionFor)];
