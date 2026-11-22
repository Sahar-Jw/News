/** Medical-center slider of the home page: default values (used by the migration and by the seed on an empty database). Everything is edited later from Settings -> Home page. */
export interface MedicalEntry {
  id: string;
  active: boolean;
  specialtyAr: string; specialtyEn: string;
  nameAr: string; nameEn: string;
  /** one line per time slot: "days | time" */
  scheduleAr: string; scheduleEn: string;
  notesAr: string; notesEn: string;
}

type Row = [specialtyAr: string, specialtyEn: string, nameAr: string, schedule: string[], notes?: string];

const ROWS: Row[] = [
  ['طبيب عظمية', 'Orthopedics', 'صفوح شعيرية', ['السبت | 9:00 - 11:00']],
  ['طبيب عظمية', 'Orthopedics', 'ايفان عبدوش', ['الأحد - الثلاثاء - الخميس | صباحاً 9:00 - 11:00', 'السبت - الاثنين - الثلاثاء - الأربعاء | مساءً 3:30 - 6:00']],
  ['طبيب عظمية', 'Orthopedics', 'محمود شحادة الحريري', ['السبت - الأحد - الخميس | ظهراً 12:00 - 3:30']],
  ['طبيب عظمية', 'Orthopedics', 'حمادة بقلة', ['الاثنين - الأربعاء | صباحاً 9:00 - 11:00'], 'قدم سكرية'],
  ['طبيب عظمية', 'Orthopedics', 'غيث الزعيم', ['الاثنين - الثلاثاء - الأربعاء | ظهراً 12:00 - 3:30', 'الأحد - الخميس | مساءً 3:30 - 6:00']],
  ['طبيب عينية', 'Ophthalmology', 'رغد الخطيب', ['يومياً | 9:00 - 11:00']],
  ['طبيب عينية', 'Ophthalmology', 'محمد السماك', ['السبت | ظهراً 12:00 - 3:30']],
  ['طبيب عينية', 'Ophthalmology', 'مجد كركوكي', ['الأحد - الأربعاء | ظهراً 12:00 - 3:30']],
  ['طبيب عينية', 'Ophthalmology', 'ليلاس حلواني', ['الاثنين - الخميس | ظهراً 12:00 - 3:30']],
  ['طبيب عينية', 'Ophthalmology', 'زياد عيون', ['الثلاثاء | ظهراً 12:00 - 3:30']],
  ['طبيب عينية', 'Ophthalmology', 'بشير الجمال', ['السبت - الاثنين | مساءً 3:30 - 6:00']],
  ['طبيب عينية', 'Ophthalmology', 'تسنيم حمد الله', ['الأحد - الثلاثاء - الأربعاء - الخميس | مساءً 3:30 - 6:00']],
  ['طبيب اسنان', 'Dentistry', 'احمد دعدوش', ['السبت - الاثنين - الأربعاء | 9:00 - 11:00']],
  ['طبيب اسنان', 'Dentistry', 'ايمن صلاحي', ['الأحد - الثلاثاء - الخميس | 9:00 - 11:00']],
  ['طبيب اسنان', 'Dentistry', 'نبال فرحات', ['يومياً | 12:00 - 6:00'], 'لبية - تقويم - مجهر ، تعويضات ثابتة - زراعة وجراحة'],
  ['طبيب نسائية', 'Gynecology', 'آمال الحلبي', ['الأحد - الثلاثاء - الخميس | 9:00 - 11:00']],
  ['طبيب نسائية', 'Gynecology', 'سناء الشاويش', ['السبت - الاثنين - الأربعاء | مساءً 3:30 - 6:00']],
  ['طبيب اطفال', 'Pediatrics', 'لينا كريم الدين', ['يومياً | 9:00 - 11:00']],
  ['طبيب جلدية', 'Dermatology', 'وليد الخليلي', ['الاثنين - الثلاثاء - الخميس | ظهراً 2:00 - 3:30']],
  ['طبيب بولية', 'Urology', 'وليد عابدين', ['يومياً | ظهراً 12:00 - 3:30']],
  ['طبيب أذنية', 'ENT', 'محمد خير المولى', ['السبت - الاثنين - الأربعاء | 9:00 - 11:00']],
  ['طبيب داخلية', 'Internal medicine', 'رهف درويش', ['يومياً | 10:00 - 12:00']],
  ['طبيب مفاصل', 'Rheumatology', 'هدى الحريري', ['السبت - الأحد - الاثنين - الأربعاء - الخميس | مساءً 3:30 - 6:00', 'عدا الخميس | 12:00 - 3:30']],
  ['طبيب هضمية', 'Gastroenterology', 'سامر التجار', ['الأحد - الثلاثاء | مساءً 3:30 - 6:00']],
  ['طبيب قلبية', 'Cardiology', 'كنان الشاويش', ['السبت - الأحد - الاثنين - الثلاثاء - الخميس | ظهراً 12:00 - 3:30']],
  ['طبيب الأوعية', 'Vascular medicine', 'احمد شحرور', ['الأربعاء | ظهراً 2:00 - 3:30']],
  ['طبيب الأشعة', 'Radiologist', 'محمد بلال الامام', ['يومياً | 8:00 - 10:00']],
  ['طبيب غدد وسكري', 'Endocrinology & diabetes', 'نادين الحسين', ['الاثنين - الثلاثاء - الأربعاء | ظهراً 12:00 - 2:30']],
  ['طبيب العصبية', 'Neurology', 'كامل الحمد', ['الثلاثاء - الخميس | مساءً 3:30 - 6:00'], 'تخطيط اعصاب'],
  ['طبيب العصبية', 'Neurology', 'يارا العموري', ['الأحد | ظهراً 12:00 - 2:30']],
  ['طبيب الصدرية', 'Pulmonology', 'محمد علي جباوي', ['السبت | 2:00 - 5:00', 'الاثنين | 2:00 - 4:00', 'الثلاثاء | 2:00 - 3:30']],
  ['طبيب الصدرية', 'Pulmonology', 'يارا عبدالله العموري', ['الأحد | 2:30 - 4:30', 'الأربعاء | 12:00 - 2:00', 'الخميس | 2:30 - 3:30'], 'وظائف رئة - جلسات رذاذ'],
  ['علاج فيزيائي', 'Physiotherapy', 'عبد الله كوكي', ['السبت - الأحد - الثلاثاء - الخميس | 1:00 - 5:30']],
  ['المخبر', 'Laboratory', '', ['يومياً | صباحاً 8:00 - 11:30']],
  ['الأشعة', 'Radiology', '', ['يومياً على مدار الساعة | 8:00 - 5:30'], 'صور بسيطة - ماموغرام - بانوراما - كثافة عظمية'],
];

export const MEDICAL_ENTRIES: MedicalEntry[] = ROWS.map(([specialtyAr, specialtyEn, nameAr, schedule, notes], i) => ({
  id: `d${i + 1}`, active: true, specialtyAr, specialtyEn, nameAr, nameEn: '', scheduleAr: schedule.join('\n'), scheduleEn: '', notesAr: notes ?? '', notesEn: '',
}));

export const MEDICAL_PHONES = ['0939941093', '0113738112', '0113734822', '0113734821'];
export const MEDICAL_FACEBOOK = 'https://www.facebook.com/profile.php?id=100072459349737';

/** [key, type, value] rows of the `medical` settings category. `doctors` holds MEDICAL_ENTRIES as JSON; the logo is uploaded from Settings. */
export const MEDICAL_SETTINGS: [string, 'text' | 'number' | 'boolean' | 'url' | 'file' | 'json', string | null][] = [
  ['name_ar', 'text', 'المركز الطبي'],
  ['name_en', 'text', 'Medical Center'],
  ['about_ar', 'text', null],
  ['about_en', 'text', null],
  ['logo', 'file', null],
  ['hours_winter_ar', 'text', 'من الساعة 8 صباحاً إلى 6 مساءً'],
  ['hours_winter_en', 'text', 'From 8 AM to 6 PM'],
  ['hours_summer_ar', 'text', 'من الساعة 8 صباحاً إلى 7 مساءً'],
  ['hours_summer_en', 'text', 'From 8 AM to 7 PM'],
  ['phones', 'text', MEDICAL_PHONES.join('\n')],
  ['facebook_url', 'url', MEDICAL_FACEBOOK],
  ['autoplay', 'boolean', 'true'],
  ['interval_seconds', 'number', '8'],
  ['doctors_per_slide', 'number', '6'],
  ['show_doctors', 'boolean', 'true'],
  ['doctors', 'json', JSON.stringify(MEDICAL_ENTRIES)],
];
