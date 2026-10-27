import { ApiLang } from './request-lang';

/**
 * Server messages (errors, validation, confirmations and audit descriptions) are written in Arabic in the code.
 * This catalog gives the English text of each one; `localize()` swaps it in when the client asked for English.
 * Anything not listed is returned unchanged, so a missing entry can never break a request.
 */
const EXACT: Record<string, string> = {
  // generic / filter / guards
  'حدث خطأ غير متوقع': 'An unexpected error occurred',
  'حجم الملف يتجاوز الحد المسموح': 'The file size exceeds the allowed limit',
  'ملف مرفوع غير صالح أو عدد الملفات يتجاوز الحد': 'The uploaded file is invalid or the number of files exceeds the limit',
  'القيمة موجودة مسبقاً': 'This value already exists',
  'حجم الطلب كبير جداً': 'The request is too large',
  'تم تجاوز عدد المحاولات المسموح، حاول لاحقاً': 'Too many attempts, please try again later',
  'يلزم تسجيل الدخول': 'You need to sign in',
  'انتهت صلاحية الجلسة أو الرمز غير صالح': 'Your session has expired or the token is invalid',
  'الحساب غير مفعّل أو غير موجود': 'The account is inactive or does not exist',
  'انتهت صلاحية الجلسة، سجّل الدخول من جديد': 'Your session has expired, please sign in again',
  'محاولة وصول مرفوضة لعدم وجود الصلاحية': 'Access denied: missing permission',
  'ليست لديك صلاحية لتنفيذ هذا الإجراء': 'You do not have permission to perform this action',
  'مرشحات الأعمدة غير صالحة': 'The column filters are invalid',
  'يجب اختيار عمود واحد على الأقل للتصدير': 'Select at least one column to export',
  'عمود غير مدعوم في التصدير': 'Unsupported export column',
  // access / roles
  'الرمز: أحرف إنجليزية صغيرة وأرقام و _ . - (2-50)': 'Code: lowercase English letters, digits and _ . - (2-50 characters)',
  'دور المدير التقني يملك كل الصلاحيات دائماً ولا يمكن تعديلها': 'The technical administrator role always holds every permission and cannot be changed',
  'محاولة تعديل دور أعلى من صلاحيات المنفّذ': 'Attempt to edit a role above the actor\'s permissions',
  'محاولة منح صلاحيات لا يملكها المنفّذ': 'Attempt to grant permissions the actor does not hold',
  'لا يمكن إزالة صلاحية تعيين الصلاحيات من آخر دور يملكها': 'The permission to assign permissions cannot be removed from the last role that holds it',
  'لا يمكنك منح أو تعديل صلاحيات تتجاوز صلاحياتك': 'You cannot grant or change permissions beyond your own',
  'رمز الدور أو اسمه مستخدم مسبقاً': 'The role code or name is already in use',
  'اسم الدور مستخدم مسبقاً': 'The role name is already in use',
  'لا يمكن حذف دور المدير التقني': 'The technical administrator role cannot be deleted',
  'لا يمكن حذف الدور الافتراضي للتسجيل': 'The default registration role cannot be deleted',
  'لا يمكن حذف دور مرتبط بمستخدمين': 'A role that is assigned to users cannot be deleted',
  'لا يمكن حذف الدور الوحيد القادر على تعيين الصلاحيات': 'The only role able to assign permissions cannot be deleted',
  // ads
  'الرابط يجب أن يبدأ بـ http:// أو https://': 'The link must start with http:// or https://',
  'حالة التفعيل مطلوبة': 'The active status is required',
  'بعض الإعلانات غير موجودة': 'Some ads do not exist',
  'تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساوياً له': 'The end date must be on or after the start date',
  'الإعلان غير موجود': 'The ad does not exist',
  'يجب أن يحتوي الإعلان على صورة واحدة على الأقل': 'The ad must contain at least one image',
  // appointments / customers
  'حالة غير صالحة': 'Invalid status',
  'الوقت يجب أن يكون بصيغة HH:MM': 'The time must be in HH:MM format',
  'إضافة موعد': 'Appointment added',
  'الموعد غير موجود': 'The appointment does not exist',
  'تعديل موعد': 'Appointment updated',
  'بعض المواعيد غير موجودة': 'Some appointments do not exist',
  'حالة الموعد غير موجودة في الإعدادات': 'The appointment status is not defined in the settings',
  'العمر مطلوب': 'Age is required',
  'الجنس مطلوب': 'Gender is required',
  'إضافة عميل': 'Customer added',
  'العميل غير موجود': 'The customer does not exist',
  'تعديل عميل': 'Customer updated',
  'بعض العملاء غير موجودين': 'Some customers do not exist',
  'لا يمكن حذف عميل لديه مواعيد، احذف مواعيده أولاً': 'A customer who has appointments cannot be deleted; delete the appointments first',
  // auth
  'تم تسجيل الخروج': 'Signed out',
  'كلمة المرور 8 أحرف على الأقل': 'The password must be at least 8 characters',
  'الرابط غير صالح': 'The link is invalid',
  'طلب إعادة تعيين كلمة المرور': 'Password reset requested',
  'الرابط غير صالح أو منتهي، اطلب رابطاً جديداً': 'The link is invalid or expired, please request a new one',
  'إعادة تعيين كلمة المرور عبر البريد': 'Password reset through e-mail',
  'تم تغيير كلمة المرور، يمكنك تسجيل الدخول الآن': 'Your password has been changed, you can sign in now',
  'تسجيل خروج': 'Sign out',
  'إعدادات النظام غير مكتملة (الدور الافتراضي غير موجود)': 'The system settings are incomplete (the default role is missing)',
  'تسجيل حساب جديد بانتظار التفعيل': 'New account registered, pending activation',
  'تم إنشاء الحساب وهو بانتظار التفعيل من المسؤول': 'Your account has been created and is waiting for the administrator to activate it',
  'محاولة دخول فاشلة': 'Failed sign-in attempt',
  'البريد الإلكتروني أو كلمة المرور غير صحيحة': 'The e-mail or password is incorrect',
  'البريد الإلكتروني مسجّل مسبقاً': 'This e-mail is already registered',
  'محاولة دخول بحساب غير مفعّل': 'Sign-in attempt with an inactive account',
  'الحساب بانتظار التفعيل': 'The account is waiting for activation',
  'تسجيل دخول': 'Sign in',
  'طلب إعادة تعيين كلمة المرور لم يُنفَّذ': 'Password reset request was not carried out',
  // cities / countries
  'الرمز: أحرف إنجليزية صغيرة وأرقام و _ -': 'Code: lowercase English letters, digits, _ and -',
  'رمز المدينة مستخدم مسبقاً': 'The city code is already in use',
  'المدينة موجودة مسبقاً': 'The city already exists',
  'المدينة غير موجودة': 'The city does not exist',
  'الدولة موجودة مسبقاً': 'The country already exists',
  'رمز الدولة مستخدم مسبقاً': 'The country code is already in use',
  // contact
  'رسالة تواصل جديدة من الموقع': 'New contact message from the website',
  'تم إرسال رسالتك بنجاح': 'Your message was sent successfully',
  'الرسالة غير موجودة': 'The message does not exist',
  'قراءة رسالة تواصل': 'Contact message read',
  // files
  'تعذر حفظ الملفات': 'The files could not be saved',
  'المستند يتجاوز 10 ميغابايت': 'The document exceeds 10 MB',
  'نوع المستند غير مدعوم (PDF, DOC, DOCX)': 'Unsupported document type (PDF, DOC, DOCX)',
  'ملف PDF فارغ': 'The PDF file is empty',
  'ملف PDF يتجاوز 25 ميغابايت': 'The PDF file exceeds 25 MB',
  'الملف ليس PDF صالحاً': 'The file is not a valid PDF',
  'ملف فارغ': 'The file is empty',
  'الملف غير موجود': 'The file does not exist',
  'ليست لديك صلاحية لهذا الملف': 'You do not have permission to access this file',
  'تنزيل ملف خاص (سيرة ذاتية)': 'Private file downloaded (CV)',
  // gallery
  'أضف صورة واحدة على الأقل': 'Add at least one image',
  'عدد الصور كبير جداً': 'Too many images',
  'المعرض غير موجود': 'The gallery does not exist',
  'مسار صورة غير موجود في السجل': 'The image path is not part of this record',
  'يجب أن يحتوي المعرض على صورة واحدة على الأقل': 'The gallery must contain at least one image',
  'بعض المعارض غير موجودة': 'Some galleries do not exist',
  // news
  'القسم غير موجود': 'The section does not exist',
  'اكتب حرفين على الأقل للبحث': 'Type at least 2 characters to search',
  'الصفحة غير موجودة': 'The page does not exist',
  'قسم غير معروف': 'Unknown section',
  'السجل غير موجود': 'The record does not exist',
  'ليست لديك صلاحية عرض هذا النوع من المحتوى': 'You do not have permission to view this type of content',
  'ليست لديك صلاحية تعديل هذا النوع من المحتوى': 'You do not have permission to edit this type of content',
  'ليست لديك صلاحية حذف هذا النوع من المحتوى': 'You do not have permission to delete this type of content',
  'ليست لديك صلاحية إنشاء هذا النوع من المحتوى': 'You do not have permission to create this type of content',
  'قيمة الفئة فارغة': 'The category value is empty',
  'اسم الفئة أطول من 100 حرف': 'The category name is longer than 100 characters',
  'ليست لديك صلاحية إضافة فئة جديدة': 'You do not have permission to add a new category',
  'الفئة الرئيسية لا تطابق القسم': 'The main category does not match the section',
  'الفئة الرئيسية مطلوبة': 'The main category is required',
  'هذه القيمة رمز محجوز لقسم خاص ولا تُستخدم في نموذج الأخبار العادية': 'This value is a reserved code of a special section and cannot be used for regular news',
  'ليست لديك صلاحية تغيير الفئة الرئيسية': 'You do not have permission to change the main category',
  'هذا القسم الخاص لا يدعم الفئة الفرعية': 'This special section does not support a subcategory',
  'تاريخ النشر غير صالح': 'The publish date is invalid',
  'ليست لديك صلاحية النشر أو الجدولة': 'You do not have permission to publish or schedule',
  'وقت النشر مطلوب للحالة المجدولة': 'The publish time is required for the scheduled status',
  'وقت الجدولة يجب أن يكون في المستقبل': 'The scheduled time must be in the future',
  'لنشر في وقت مستقبلي استخدم الحالة "مجدولة"': 'To publish at a future time, use the "scheduled" status',
  'التقييم متاح لقسم آراء العملاء فقط': 'Rating is available for the Testimonials section only',
  'هذا القسم يقبل صورة واحدة فقط': 'This section accepts a single image only',
  'ليست لديك صلاحية تمييز الأخبار': 'You do not have permission to mark news as featured',
  'ملف PDF متاح للأخبار العادية فقط': 'A PDF file is available for regular news only',
  'بعض السجلات غير موجودة': 'Some records do not exist',
  // occasions
  'التاريخ يجب أن يكون بصيغة YYYY-MM-DD': 'The date must be in YYYY-MM-DD format',
  'بعض المناسبات غير موجودة': 'Some occasions do not exist',
  'التاريخ غير صالح': 'The date is invalid',
  'المناسبة غير موجودة': 'The occasion does not exist',
  // settings
  'الإعداد غير موجود': 'The setting does not exist',
  'هذا الإعداد ليس من نوع ملف': 'This setting is not a file setting',
  'يجب أن تكون نصاً': 'Must be text',
  'النص طويل جداً': 'The text is too long',
  'يجب أن تكون رقماً': 'Must be a number',
  'يجب أن تكون true أو false': 'Must be true or false',
  'رابط http/https غير صالح': 'Invalid http/https link',
  'لون HEX مثل #0b5ed7': 'A HEX colour such as #0b5ed7',
  'مسار ملف نسبي غير صالح': 'Invalid relative file path',
  'JSON غير صالح': 'Invalid JSON',
  // subscribers
  'شكراً لك! أرسلنا إليك رسالة لتأكيد بريدك الإلكتروني.': 'Thank you! We sent you an e-mail to confirm your address.',
  'طلب اشتراك في النشرة من الموقع': 'Newsletter subscription requested from the website',
  'الرابط غير صالح أو منتهي': 'The link is invalid or expired',
  'تأكيد اشتراك في النشرة عبر الرابط': 'Newsletter subscription confirmed through the link',
  'إلغاء اشتراك في النشرة عبر الرابط': 'Newsletter subscription cancelled through the link',
  'المشترك غير موجود': 'The subscriber does not exist',
  'بعض المشتركين غير موجودين': 'Some subscribers do not exist',
  'تفعيل مشترك': 'Subscriber activated',
  'تعطيل مشترك': 'Subscriber deactivated',
  // users
  'رقم هاتف غير صالح': 'Invalid phone number',
  'رابط غير صالح': 'Invalid link',
  'لا يمكن تعطيل أو حذف أو خفض آخر مستخدم يملك صلاحية تعيين الصلاحيات': 'The last user who can assign permissions cannot be deactivated, deleted or demoted',
  'محاولة تغيير دور مستخدم دون صلاحية': 'Attempt to change a user\'s role without permission',
  'ليست لديك صلاحية تغيير دور المستخدم': 'You do not have permission to change the user\'s role',
  'محاولة تفعيل/تعطيل مستخدم دون صلاحية': 'Attempt to activate/deactivate a user without permission',
  'ليست لديك صلاحية تفعيل أو تعطيل المستخدمين': 'You do not have permission to activate or deactivate users',
  'محاولة تغيير كلمة مرور مستخدم دون صلاحية': 'Attempt to change a user\'s password without permission',
  'ليست لديك صلاحية تغيير كلمة مرور المستخدم': 'You do not have permission to change the user\'s password',
  'بعض المستخدمين غير موجودين': 'Some users do not exist',
  'تحديث الملف الشخصي': 'Profile updated',
  'كلمة المرور الحالية غير صحيحة': 'The current password is incorrect',
  'تغيير كلمة المرور': 'Password changed',
  'تم تغيير كلمة المرور': 'The password has been changed',
  'لم يتم إرسال ملف': 'No file was sent',
  'تغيير الصورة الشخصية': 'Profile picture changed',
  'رفع السيرة الذاتية': 'CV uploaded',
  'المستخدم غير موجود': 'The user does not exist',
  'الدور غير موجود': 'The role does not exist',
  'محاولة إسناد دور أعلى من صلاحيات المنفّذ': 'Attempt to assign a role above the actor\'s permissions',
  'لا يمكنك إسناد دور يتجاوز صلاحياتك': 'You cannot assign a role beyond your own permissions',
  'لا يمكنك تعديل حسابك من جدول المستخدمين، استخدم الملف الشخصي': 'You cannot edit your own account from the users table, use your profile instead',
  'محاولة إدارة مستخدم بدور أعلى': 'Attempt to manage a user with a higher role',
  'لا يمكنك إدارة مستخدم بدور أعلى من صلاحياتك': 'You cannot manage a user whose role is above your permissions',
};

type Rule = [RegExp, (m: RegExpExecArray, tr: (s: string) => string) => string];

/** Messages that carry a value (a name, a count, an e-mail ...). Longest / most specific first. */
const RULES: Rule[] = [
  [/^صلاحيات غير معروفة: (.+)$/s, (m) => `Unknown permissions: ${m[1]}`],
  [/^تحديث صلاحيات الدور (.+)$/s, (m) => `Role permissions updated: ${m[1]}`],
  [/^إنشاء الدور (.+)$/s, (m) => `Role created: ${m[1]}`],
  [/^تعديل الدور (.+)$/s, (m) => `Role updated: ${m[1]}`],
  [/^حذف الدور (.+)$/s, (m) => `Role deleted: ${m[1]}`],
  [/^تعديل إعلان: (.+)$/s, (m) => `Ad updated: ${m[1]}`],
  [/^إضافة إعلان: (.+)$/s, (m) => `Ad added: ${m[1]}`],
  [/^حذف (\d+) إعلان$/, (m) => `${m[1]} ad(s) deleted`],
  [/^حذف (\d+) موعد$/, (m) => `${m[1]} appointment(s) deleted`],
  [/^حذف (\d+) عميل$/, (m) => `${m[1]} customer(s) deleted`],
  [/^حذف (\d+) مشترك$/, (m) => `${m[1]} subscriber(s) deleted`],
  [/^حذف (\d+) معرض صور$/, (m) => `${m[1]} photo gallery(ies) deleted`],
  [/^حذف (\d+) مناسبة$/, (m) => `${m[1]} occasion(s) deleted`],
  [/^إجراء ناجح دون سجل مخصص: (.+)$/s, (m) => `Successful action without a dedicated log entry: ${m[1]}`],
  [/^تصدير (\d+) سجل \((.+)\)$/s, (m) => `Exported ${m[1]} record(s) (${m[2]})`],
  [/^إضافة المدينة (.+)$/s, (m) => `City added: ${m[1]}`],
  [/^تعديل المدينة (.+)$/s, (m) => `City updated: ${m[1]}`],
  [/^حذف المدينة (.+)$/s, (m) => `City deleted: ${m[1]}`],
  [/^إضافة الدولة (.+)$/s, (m) => `Country added: ${m[1]}`],
  [/^الصورة (.+) تتجاوز 5 ميغابايت$/s, (m) => `The image ${m[1]} exceeds 5 MB`],
  [/^الملف (.+) ليس صورة مدعومة \((.+)\)$/s, (m) => `The file ${m[1]} is not a supported image (${m[2]})`],
  [/^الصورة (.+) تالفة أو غير قابلة للمعالجة$/s, (m) => `The image ${m[1]} is corrupted or cannot be processed`],
  [/^إضافة معرض صور: (.+)$/s, (m) => `Photo gallery added: ${m[1]}`],
  [/^تعديل معرض صور: (.+)$/s, (m) => `Photo gallery updated: ${m[1]}`],
  [/^إنشاء سجل: (.+)$/s, (m) => `Record created: ${m[1]}`],
  [/^تعديل سجل: (.+)$/s, (m) => `Record updated: ${m[1]}`],
  [/^حذف سجل: (.+)$/s, (m) => `Record deleted: ${m[1]}`],
  [/^نشر تلقائي لـ (\d+) عنصر مجدول$/, (m) => `Automatically published ${m[1]} scheduled item(s)`],
  [/^تعديل مناسبة: (.+)$/s, (m) => `Occasion updated: ${m[1]}`],
  [/^إضافة مناسبة: (.+)$/s, (m) => `Occasion added: ${m[1]}`],
  [/^تعديل الإعداد (.+)$/s, (m) => `Setting updated: ${m[1]}`],
  [/^تحديث ملف الإعداد (.+)$/s, (m) => `Setting file updated: ${m[1]}`],
  [/^القيمة غير صالحة للنوع ([^:]+): (.+)$/s, (m, tr) => `The value is not valid for type ${m[1]}: ${tr(m[2])}`],
  [/^(تفعيل|تعطيل) المستخدم (.+)$/s, (m) => `User ${m[1] === 'تفعيل' ? 'activated' : 'deactivated'}: ${m[2]}`],
  [/^تعديل المستخدم (.+)$/s, (m) => `User updated: ${m[1]}`],
  [/^حذف المستخدم (.+)$/s, (m) => `User deleted: ${m[1]}`],
];

const ARABIC = /[\u0600-\u06FF]/;

/** English text of a server message when `lang` is 'en'; the message itself otherwise (or when unknown). */
export function localize(message: string, lang: ApiLang): string {
  if (lang !== 'en' || typeof message !== 'string' || !ARABIC.test(message)) return message;
  const exact = EXACT[message];
  if (exact) return exact;
  for (const [re, fn] of RULES) {
    const m = re.exec(message);
    if (m) return fn(m, (s) => localize(s, lang));
  }
  return message;
}

/** Same for the string / string[] shapes an exception body can carry. */
export function localizeAny<T>(value: T, lang: ApiLang): T {
  if (lang !== 'en') return value;
  if (typeof value === 'string') return localize(value, lang) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? localize(v, lang) : v)) as unknown as T;
  return value;
}
