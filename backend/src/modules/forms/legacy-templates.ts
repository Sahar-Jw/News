import type { ContextType, DedupeMode, FieldDef, FieldOption, FormCategory, FormStatus } from './field-schema';

/**
 * The forms that used to be hard-coded (membership, trainer application, course registration, incubator, EXPO x3, Get2Trade x2),
 * described as dashboard forms. The migration 1767100000000 inserts them once; after that the dashboard owns them (edit freely).
 * Field keys are what the data migration and the Get2Trade / course rules rely on: do not rename them in the migration.
 */
export interface LegacyForm {
  slug: string; titleAr: string; titleEn: string; contextType: ContextType | null; dedupe: DedupeMode | null; isListed: boolean;
  successAr: string; successEn: string; statuses: FormStatus[]; categories: FormCategory[]; fields: FieldDef[];
  /** site setting / table the staff e-mail used to come from: copied once into notifyEmails by the migration */
  notifyFrom: { table: 'membership_settings' | 'g2t_settings' } | { setting: [string, string] };
}

const st = (key: string, ar: string, en: string, color: string): FormStatus => ({ key, ar, en, color });
const STATUS4: FormStatus[] = [st('new', 'جديد', 'New', '#2563eb'), st('in_review', 'قيد المراجعة', 'In review', '#d97706'), st('accepted', 'مقبول', 'Accepted', '#059669'), st('rejected', 'مرفوض', 'Rejected', '#dc2626')];
const STATUS_EXPO: FormStatus[] = [st('new', 'جديد', 'New', '#2563eb'), st('in_review', 'قيد المراجعة', 'In review', '#d97706'), st('approved', 'مقبول', 'Approved', '#059669'), st('rejected', 'مرفوض', 'Rejected', '#dc2626')];
const o = (value: string, ar: string, en: string): FieldOption => ({ value, ar, en });
const h = (key: string, ar: string, en: string): FieldDef => ({ key, type: 'heading', labelAr: ar, labelEn: en });
type Opt = Partial<FieldDef>;
const f = (key: string, type: FieldDef['type'], ar: string, en: string, opt: Opt = {}): FieldDef => ({ key, type, labelAr: ar, labelEn: en, ...opt });
const req: Opt = { required: true };

const NAME3 = (key = 'name', ar = 'الاسم الثلاثي', en = 'Full name (three parts)'): FieldDef => f(key, 'text', ar, en, { ...req, role: 'name', threeParts: true, maxLength: 150, helpAr: 'الاسم والأب والعائلة', helpEn: 'First, father and family name' });
const PHONE = (): FieldDef => f('phone', 'phone', 'الهاتف', 'Phone', { ...req, role: 'phone' });
const EMAIL = (): FieldDef => f('email', 'email', 'البريد الإلكتروني', 'E-mail', { ...req, role: 'email' });
const DOCS = ['pdf', 'doc', 'image'] as const;

const SECTORS_NOTE = undefined;
void SECTORS_NOTE;

export const LEGACY_FORMS: LegacyForm[] = [
  {
    slug: 'membership', titleAr: 'طلب انتساب', titleEn: 'Membership application', contextType: null, dedupe: null, isListed: false,
    successAr: 'تم استلام طلب الانتساب. أرسلنا رسالة تأكيد إلى بريدك، وسنوافيك بالنتيجة بعد مراجعة الطلب.', successEn: 'Your membership application was received. We sent a confirmation to your e-mail and will tell you the result after review.',
    statuses: STATUS4, categories: [], notifyFrom: { table: 'membership_settings' },
    fields: [
      h('sec_owner', 'بيانات صاحب المنشأة', 'Owner details'),
      NAME3('manager_name', 'صاحب المنشأة / المفوض بالتوقيع', 'Owner / authorised signatory'),
      h('sec_business', 'بيانات المنشأة', 'Establishment details'),
      f('company_name', 'text', 'اسم المنشأة', 'Company name', { ...req, maxLength: 255, minLength: 2 }),
      f('activity', 'text', 'الاختصاص أو النشاط التجاري', 'Specialisation / business activity', { ...req, maxLength: 255, minLength: 2 }),
      f('business_type', 'select', 'نوع المنشأة', 'Type of establishment', { ...req, options: [o('individual', 'منشأة فردية', 'Individual establishment'), o('company', 'شركة', 'Company'), o('other', 'غير ذلك', 'Other')] }),
      f('business_type_other', 'text', 'حدّد نوع المنشأة', 'Specify the type', { ...req, maxLength: 120, showIf: { key: 'business_type', equals: 'other' } }),
      f('commercial_reg_no', 'text', 'رقم السجل التجاري', 'Commercial register number', { ...req, maxLength: 60 }),
      f('registration_date', 'date', 'تاريخ التسجيل', 'Registration date', req),
      h('sec_contact', 'التواصل', 'Contact'),
      f('contact_person', 'text', 'اسم الشخص المفوض بالتواصل (إن وجد)', 'Authorised contact person (if any)', { maxLength: 150 }),
      { ...PHONE(), labelAr: 'الهاتف', minLength: undefined },
      EMAIL(),
      f('address', 'text', 'العنوان التفصيلي للمنشأة', 'Detailed address of the establishment', { ...req, maxLength: 500, minLength: 5 }),
      f('message', 'textarea', 'ملاحظات', 'Notes', { maxLength: 3000 }),
      h('sec_docs', 'الوثائق المطلوبة', 'Required documents'),
      f('documents', 'file', 'رفع الوثائق', 'Upload documents', { ...req, fileKinds: [...DOCS], maxFiles: 6, maxSizeMb: 5, helpAr: 'أرفق الوثائق المطلوبة وفق متطلبات الانتساب المعتمدة (ملف واحد على الأقل، حتى 6 ملفات)', helpEn: 'Attach the documents required by the approved membership requirements (at least one file, up to 6)' }),
    ],
  },
  {
    slug: 'trainer-application', titleAr: 'التسجيل كمدرب', titleEn: 'Register as a trainer', contextType: null, dedupe: 'open-email', isListed: false,
    successAr: 'تم استلام طلبك. أرسلنا رسالة تأكيد إلى بريدك الإلكتروني.', successEn: 'Your application has been received. A confirmation e-mail has been sent to you.',
    statuses: STATUS4, categories: [], notifyFrom: { setting: ['training', 'officer_email'] },
    fields: [
      NAME3('full_name', 'الاسم الثلاثي', 'Full name (three parts)'), PHONE(), EMAIL(),
      f('specializations', 'textarea', 'الاختصاصات', 'Specialisations', { ...req, maxLength: 3000 }),
      f('training_fields', 'textarea', 'مجالات التدريب', 'Training fields', { ...req, maxLength: 3000 }),
      f('qualification', 'text', 'المؤهل العلمي', 'Academic qualification', { ...req, maxLength: 255 }),
      f('experience', 'textarea', 'الخبرات العلمية والتدريبية', 'Scientific and training experience', { ...req, maxLength: 5000 }),
      f('programs', 'textarea', 'الدورات والبرامج التي يمكن تقديمها', 'Courses and programs you can deliver', { ...req, maxLength: 5000 }),
      f('bio', 'textarea', 'نبذة تعريفية عن المدرب', 'About the trainer', { ...req, maxLength: 5000 }),
      f('cv', 'file', 'السيرة الذاتية', 'CV', { ...req, fileKinds: ['pdf', 'doc'], maxFiles: 1, maxSizeMb: 10, helpAr: 'PDF أو DOC أو DOCX، حتى 10 ميغابايت', helpEn: 'PDF, DOC or DOCX, up to 10 MB' }),
      f('certificates', 'file', 'الشهادات والخبرات (إن وجدت)', 'Certificates and experience proofs (if any)', { fileKinds: [...DOCS], maxFiles: 5, maxSizeMb: 10, helpAr: 'حتى 5 ملفات: PDF أو DOC أو DOCX أو صور', helpEn: 'Up to 5 files: PDF, DOC, DOCX or images' }),
    ],
  },
  {
    slug: 'course-registration', titleAr: 'التسجيل في دورة', titleEn: 'Course registration', contextType: 'course', dedupe: 'context-email', isListed: false,
    successAr: 'تم تسجيلك في الدورة بنجاح. أرسلنا إليك رسالة تأكيد على بريدك الإلكتروني.', successEn: 'You are registered for the course. A confirmation e-mail has been sent to you.',
    statuses: [st('new', 'مسجّل', 'Registered', '#2563eb'), st('confirmed', 'مؤكد', 'Confirmed', '#059669'), st('attended', 'حضر', 'Attended', '#475569'), st('cancelled', 'ملغى', 'Cancelled', '#dc2626')], categories: [], notifyFrom: { setting: ['training', 'officer_email'] },
    fields: [
      NAME3('name'), PHONE(), EMAIL(),
      f('workplace', 'text', 'مكان العمل', 'Workplace', { ...req, minLength: 2, maxLength: 150 }),
      f('organization', 'text', 'اسم الشركة', 'Company name', { ...req, minLength: 2, maxLength: 150 }),
      f('job_title', 'text', 'المسمى الوظيفي', 'Job title', { ...req, minLength: 2, maxLength: 150 }),
      f('qualification', 'text', 'المؤهل العلمي', 'Academic qualification', { ...req, minLength: 2, maxLength: 255 }),
      f('experience', 'textarea', 'الخبرات أو الاختصاص (اختياري)', 'Experience or specialisation (optional)', { maxLength: 3000 }),
      f('notes', 'textarea', 'ملاحظات إضافية (اختياري)', 'Additional notes (optional)', { maxLength: 3000 }),
    ],
  },
  {
    slug: 'incubator-application', titleAr: 'قدّم مشروعك', titleEn: 'Submit your project', contextType: null, dedupe: 'recent-email', isListed: false,
    successAr: 'تم استلام مشروعك بنجاح، سنتواصل معك قريباً.', successEn: 'Your project was received. We will contact you soon.',
    statuses: STATUS4, categories: [], notifyFrom: { setting: ['incubator', 'officer_email'] },
    fields: [
      f('project_name', 'text', 'اسم المشروع', 'Project name', { ...req, minLength: 2, maxLength: 190 }),
      NAME3('founder_name', 'الاسم الثلاثي لمقدم الطلب', 'Applicant’s full name (three parts)'), EMAIL(), PHONE(),
      f('sector', 'text', 'مجال المشروع أو القطاع', 'Project field / sector', { ...req, minLength: 2, maxLength: 150 }),
      f('stage', 'select', 'مرحلة المشروع', 'Project stage', { ...req, options: [o('idea', 'فكرة أولية', 'Initial idea'), o('prototype', 'قيد التطوير', 'Under development'), o('launched', 'مشروع قائم', 'Existing project')] }),
      f('description', 'textarea', 'وصف مختصر عن المشروع وفكرته', 'Short description of the project and its idea', { ...req, minLength: 10, maxLength: 5000 }),
      f('feasibility', 'textarea', 'الجدوى الاقتصادية من المشروع', 'Economic feasibility of the project', { ...req, minLength: 10, maxLength: 5000 }),
      f('target_audience', 'textarea', 'الفئة المستهدفة', 'Target audience', { ...req, minLength: 2, maxLength: 3000 }),
      f('team', 'textarea', 'فريق العمل (إن وجد)', 'Team (if any)', { maxLength: 3000 }),
      f('needs', 'textarea', 'الاحتياجات المطلوبة من الحاضنة', 'Support needed from the incubator', { ...req, minLength: 2, maxLength: 3000 }),
      f('profile', 'file', 'ملف تعريفي أو دراسة عن المشروع (اختياري)', 'Project profile or study (optional)', { fileKinds: ['pdf', 'doc'], maxFiles: 1, maxSizeMb: 10, helpAr: 'PDF أو DOC أو DOCX، حتى 10 ميغابايت', helpEn: 'PDF, DOC or DOCX, up to 10 MB' }),
      f('confirm_data', 'checkbox', 'أقرّ بصحة البيانات المُدخلة', 'I confirm that the data I entered is correct', req),
    ],
  },
  {
    slug: 'expo-exhibitor', titleAr: 'طلب مشاركة كعارض (EXPO)', titleEn: 'Exhibitor request (EXPO)', contextType: null, dedupe: 'recent-email', isListed: false,
    successAr: 'تم استلام طلبك بنجاح، سنتواصل معك قريباً', successEn: 'Your request was received. We will contact you soon.', statuses: STATUS_EXPO, categories: [], notifyFrom: { setting: ['expo', 'contact_email'] },
    fields: [
      f('company', 'text', 'اسم الشركة أو المؤسسة', 'Company / organization name', { ...req, maxLength: 190 }),
      f('name', 'text', 'اسم الشخص المسؤول', 'Contact person', { ...req, role: 'name', maxLength: 150 }),
      f('job_title', 'text', 'الصفة الوظيفية', 'Job title', { ...req, maxLength: 150 }), PHONE(), EMAIL(),
      f('country', 'text', 'الدولة', 'Country', { ...req, maxLength: 100 }), f('city', 'text', 'المدينة', 'City', { ...req, maxLength: 100 }),
      f('sector', 'text', 'مجال عمل الشركة', 'Business field of the company', { ...req, maxLength: 150 }),
      f('products', 'textarea', 'المنتجات أو الخدمات المراد عرضها', 'Products or services to exhibit', { ...req, maxLength: 3000 }),
      f('area', 'text', 'المساحة المطلوبة للمشاركة (م²)', 'Required area (m²)', { ...req, maxLength: 40 }),
      f('participation_type', 'select', 'نوع الجناح أو المشاركة', 'Stand / participation type', { ...req, options: [o('equipped', 'جناح مجهّز', 'Equipped stand'), o('space', 'مساحة فقط', 'Space only'), o('collective', 'مشاركة جماعية', 'Collective participation'), o('sponsor', 'رعاية', 'Sponsorship'), o('other', 'أخرى', 'Other')] }),
      f('message', 'textarea', 'ملاحظات إضافية', 'Additional notes', { maxLength: 3000 }),
      f('profile', 'file', 'ملف التعريف بالشركة (اختياري)', 'Company profile (optional)', { fileKinds: ['pdf', 'doc'], maxFiles: 1, maxSizeMb: 10, helpAr: 'PDF أو Word حتى 10 ميغابايت', helpEn: 'PDF or Word, up to 10 MB' }),
    ],
  },
  {
    slug: 'expo-visitor', titleAr: 'تسجيل زائر (EXPO)', titleEn: 'Visitor registration (EXPO)', contextType: null, dedupe: 'recent-email', isListed: false,
    successAr: 'تم استلام طلبك بنجاح، سنتواصل معك قريباً', successEn: 'Your request was received. We will contact you soon.', statuses: STATUS_EXPO, categories: [], notifyFrom: { setting: ['expo', 'contact_email'] },
    fields: [
      NAME3('name'), f('company', 'text', 'اسم الشركة أو المؤسسة (إن وجد)', 'Company / organization (if any)', { maxLength: 190 }),
      f('job_title', 'text', 'المسمى الوظيفي', 'Job title', { ...req, maxLength: 150 }), PHONE(), EMAIL(),
      f('country', 'text', 'الدولة', 'Country', { ...req, maxLength: 100 }), f('city', 'text', 'المدينة', 'City', { ...req, maxLength: 100 }),
      f('sector', 'text', 'مجال العمل أو الاختصاص', 'Field of work / specialization', { ...req, maxLength: 150 }),
      f('interest', 'select', 'طبيعة الاهتمام بالمعرض', 'Interest in the expo', { ...req, options: [o('sourcing', 'البحث عن موردين ومنتجات', 'Sourcing suppliers and products'), o('partnerships', 'شراكات وفرص أعمال', 'Partnerships and business'), o('products', 'الاطلاع على المنتجات والخدمات', 'Discovering products and services'), o('programme', 'حضور الندوات والفعاليات', 'Seminars and events'), o('other', 'أخرى', 'Other')] }),
      f('message', 'textarea', 'ملاحظات إضافية', 'Additional notes', { maxLength: 3000 }),
    ],
  },
  {
    slug: 'expo-info', titleAr: 'استفسار (EXPO)', titleEn: 'Information request (EXPO)', contextType: null, dedupe: 'recent-email', isListed: false,
    successAr: 'تم استلام طلبك بنجاح، سنتواصل معك قريباً', successEn: 'Your request was received. We will contact you soon.', statuses: STATUS_EXPO, categories: [], notifyFrom: { setting: ['expo', 'contact_email'] },
    fields: [
      NAME3('name'), f('company', 'text', 'اسم الشركة أو المؤسسة (إن وجد)', 'Company / organization (if any)', { maxLength: 190 }), PHONE(), EMAIL(),
      f('inquiry_type', 'select', 'نوع الاستفسار', 'Inquiry type', { ...req, options: [o('general', 'استفسار عام', 'General inquiry'), o('exhibitor', 'المشاركة كعارض', 'Taking part as exhibitor'), o('visitor', 'زيارة المعرض', 'Visiting the expo'), o('sponsorship', 'الرعاية والشراكة', 'Sponsorship and partnership'), o('media', 'الإعلام والتغطية', 'Media and coverage'), o('other', 'أخرى', 'Other')] }),
      f('message', 'textarea', 'نص الاستفسار', 'Your inquiry', { ...req, minLength: 3, maxLength: 3000 }),
    ],
  },
  {
    slug: 'get2trade-booking', titleAr: 'طلب حجز (غيت تو تريد)', titleEn: 'Booking request (Get2Trade)', contextType: 'g2t', dedupe: null, isListed: false,
    successAr: 'تم استلام طلبك', successEn: 'Your request was received.', statuses: STATUS4, categories: [], notifyFrom: { table: 'g2t_settings' },
    fields: [
      NAME3('name', 'الاسم الثلاثي', 'Full name'), f('company', 'text', 'اسم الشركة أو المؤسسة (اختياري)', 'Company (optional)', { maxLength: 150 }), PHONE(), EMAIL(),
      f('space', 'select', 'المساحة (اختياري)', 'Space (optional)', { optionsSource: 'g2t_spaces', options: [] }),
      f('package', 'select', 'الباقة (اختياري)', 'Package (optional)', { optionsSource: 'g2t_packages', options: [] }),
      f('space_kind', 'select', 'نوع المكتب / المساحة المطلوبة', 'Requested office / space type', { options: [o('office', 'مكتب مجهز', 'Equipped office'), o('coworking', 'مساحة عمل مشتركة', 'Coworking space'), o('meeting_room', 'قاعة اجتماعات', 'Meeting room'), o('other', 'أخرى', 'Other')] }),
      f('start_date', 'date', 'تاريخ البدء المطلوب (اختياري)', 'Wished start date (optional)', { notPast: true }),
      f('people', 'number', 'عدد الأشخاص (اختياري)', 'Number of people (optional)', { min: 1, max: 500 }),
      f('duration_value', 'number', 'مدة الحجز المطلوبة', 'Requested booking duration', { min: 1, max: 120 }),
      f('duration_unit', 'select', 'وحدة المدة', 'Duration unit', { options: [o('day', 'يوم', 'day(s)'), o('week', 'أسبوع', 'week(s)'), o('month', 'شهر', 'month(s)'), o('year', 'سنة', 'year(s)')] }),
      f('extra_services', 'textarea', 'الخدمات الإضافية المطلوبة (إن وجدت)', 'Additional services (if any)', { maxLength: 1000 }),
      f('message', 'textarea', 'ملاحظات (اختياري)', 'Notes (optional)', { maxLength: 3000 }),
    ],
  },
  {
    slug: 'get2trade-inquiry', titleAr: 'استفسار (غيت تو تريد)', titleEn: 'Inquiry (Get2Trade)', contextType: 'g2t', dedupe: null, isListed: false,
    successAr: 'تم استلام طلبك', successEn: 'Your request was received.', statuses: STATUS4, categories: [], notifyFrom: { table: 'g2t_settings' },
    fields: [
      f('name', 'text', 'الاسم', 'Name', { ...req, role: 'name', minLength: 2, maxLength: 150 }), f('company', 'text', 'اسم الشركة أو المؤسسة (اختياري)', 'Company (optional)', { maxLength: 150 }), PHONE(), EMAIL(),
      f('space', 'select', 'المساحة (اختياري)', 'Space (optional)', { optionsSource: 'g2t_spaces', options: [] }),
      f('package', 'select', 'الباقة (اختياري)', 'Package (optional)', { optionsSource: 'g2t_packages', options: [] }),
      f('message', 'textarea', 'نص الاستفسار', 'Your inquiry', { ...req, minLength: 5, maxLength: 3000 }),
    ],
  },
];

/**
 * The contact form (home page, contact page, One-Stop, services, women's committee). Kept apart from LEGACY_FORMS because it is added by its own
 * migration (1767200000000), so a database that already ran the earlier one gets it too.
 */
export const CONTACT_FORM: LegacyForm = {
  slug: 'contact', titleAr: 'تواصل معنا', titleEn: 'Contact us', contextType: null, dedupe: null, isListed: false,
  successAr: 'تم إرسال رسالتك بنجاح', successEn: 'Your message was sent successfully',
  statuses: [st('new', 'جديدة', 'New', '#2563eb'), st('replied', 'تم الرد', 'Replied', '#059669'), st('closed', 'مغلقة', 'Closed', '#475569')], categories: [], notifyFrom: { setting: ['contact', 'email'] },
  fields: [
    f('name', 'text', 'الاسم', 'Name', { ...req, role: 'name', minLength: 2, maxLength: 150 }),
    EMAIL(),
    f('subject', 'text', 'الموضوع', 'Subject', { ...req, minLength: 2, maxLength: 255 }),
    f('message', 'textarea', 'الرسالة', 'Message', { ...req, minLength: 5, maxLength: 5000 }),
  ],
};
