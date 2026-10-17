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
  DRAFT = 'draft',
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

/** SRS Annex B */
export const PERMISSIONS: PermissionDef[] = [
  { code: 'news.read', module: 'news', nameAr: 'عرض المحتوى', nameEn: 'View content' },
  { code: 'news.create', module: 'news', nameAr: 'إنشاء محتوى', nameEn: 'Create content' },
  { code: 'news.update', module: 'news', nameAr: 'تعديل المحتوى', nameEn: 'Update content' },
  { code: 'news.delete', module: 'news', nameAr: 'حذف المحتوى', nameEn: 'Delete content' },
  { code: 'news.publish', module: 'news', nameAr: 'نشر/جدولة المحتوى', nameEn: 'Publish / schedule content' },
  { code: 'news.category.create', module: 'news', nameAr: 'إضافة فئة جديدة', nameEn: 'Create new category value' },
  { code: 'news.category.change', module: 'news', nameAr: 'تغيير الفئة الرئيسية', nameEn: 'Change main category' },
  { code: 'users.read', module: 'users', nameAr: 'عرض المستخدمين', nameEn: 'View users' },
  { code: 'users.create', module: 'users', nameAr: 'إضافة مستخدم', nameEn: 'Create users' },
  { code: 'users.update', module: 'users', nameAr: 'تعديل مستخدم', nameEn: 'Update users' },
  { code: 'users.delete', module: 'users', nameAr: 'حذف مستخدم', nameEn: 'Delete users' },
  { code: 'users.activate', module: 'users', nameAr: 'تفعيل المستخدمين', nameEn: 'Activate users' },
  { code: 'roles.manage', module: 'roles', nameAr: 'إدارة الأدوار', nameEn: 'Manage roles' },
  { code: 'permissions.read', module: 'roles', nameAr: 'عرض الصلاحيات', nameEn: 'View permissions' },
  { code: 'permissions.assign', module: 'roles', nameAr: 'تعيين الصلاحيات', nameEn: 'Assign permissions' },
  { code: 'settings.read', module: 'settings', nameAr: 'عرض الإعدادات', nameEn: 'View settings' },
  { code: 'settings.update', module: 'settings', nameAr: 'تعديل الإعدادات', nameEn: 'Update settings' },
  { code: 'cities.manage', module: 'cities', nameAr: 'إدارة المدن', nameEn: 'Manage cities' },
  { code: 'audit.read', module: 'audit', nameAr: 'عرض سجل التدقيق', nameEn: 'View audit log' },
  { code: 'messages.read', module: 'messages', nameAr: 'قراءة رسائل التواصل', nameEn: 'Read contact messages' },
];

export const PERM = {
  NEWS_READ: 'news.read',
  NEWS_CREATE: 'news.create',
  NEWS_UPDATE: 'news.update',
  NEWS_DELETE: 'news.delete',
  NEWS_PUBLISH: 'news.publish',
  NEWS_CATEGORY_CREATE: 'news.category.create',
  NEWS_CATEGORY_CHANGE: 'news.category.change',
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_ACTIVATE: 'users.activate',
  ROLES_MANAGE: 'roles.manage',
  PERMISSIONS_READ: 'permissions.read',
  PERMISSIONS_ASSIGN: 'permissions.assign',
  SETTINGS_READ: 'settings.read',
  SETTINGS_UPDATE: 'settings.update',
  CITIES_MANAGE: 'cities.manage',
  AUDIT_READ: 'audit.read',
  MESSAGES_READ: 'messages.read',
} as const;
