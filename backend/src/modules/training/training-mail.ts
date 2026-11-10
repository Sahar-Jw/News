/** E-mails of the Training Center (Arabic or English). Every value that comes from a form or from the admin is escaped. */
export const esc = (s: string | null | undefined) => (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Lang = 'ar' | 'en';
const wrap = (lang: Lang, body: string) => `<div dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#1f2937">${body}</div>`;
const rows = (items: [string, string | null | undefined][]) => items.filter(([, v]) => v && String(v).trim()).map(([k, v]) => `<tr><td style="padding:4px 12px;color:#6b7280;white-space:nowrap">${esc(k)}</td><td style="padding:4px 12px;font-weight:bold">${esc(String(v))}</td></tr>`).join('');
const table = (r: string) => `<table style="border-collapse:collapse;margin:12px 0;background:#f9fafb;border-radius:8px">${r}</table>`;

export interface CourseMailInfo {
  name: string;
  startDate: string;
  endDate: string | null;
  location: string;
  hours: number | null;
  fee: string;
  trainer: string;
}

/** Sent to the trainee right after a successful registration. */
export function registrationConfirmation(lang: Lang, traineeName: string, c: CourseMailInfo): { subject: string; html: string } {
  const ar = lang === 'ar';
  const dates = c.endDate && c.endDate !== c.startDate ? (ar ? `من ${c.startDate} إلى ${c.endDate}` : `${c.startDate} to ${c.endDate}`) : c.startDate;
  const info = table(rows(ar
    ? [['الدورة', c.name], ['التاريخ', dates], ['المكان', c.location], ['عدد الساعات', c.hours != null ? String(c.hours) : ''], ['الرسوم', c.fee], ['المدرب', c.trainer]]
    : [['Course', c.name], ['Date', dates], ['Place', c.location], ['Hours', c.hours != null ? String(c.hours) : ''], ['Fees', c.fee], ['Trainer', c.trainer]]));
  return ar
    ? { subject: `تأكيد التسجيل في دورة: ${c.name}`, html: wrap(lang, `<h3>تأكيد التسجيل</h3><p>السيد/ة <b>${esc(traineeName)}</b>،</p><p>تم استلام تسجيلك في الدورة التالية بنجاح:</p>${info}<p>سيتواصل معك فريق مركز التدريب الإداري لتأكيد التفاصيل. إذا لم تقم بهذا التسجيل فيرجى تجاهل هذه الرسالة.</p>`) }
    : { subject: `Registration confirmed: ${c.name}`, html: wrap(lang, `<h3>Registration confirmation</h3><p>Dear <b>${esc(traineeName)}</b>,</p><p>We have received your registration for the following course:</p>${info}<p>The Administrative Training Center will contact you to confirm the details. If you did not make this registration, please ignore this e-mail.</p>`) };
}

/** Sent to the trainer applicant right after the application is stored. */
export function trainerApplicationConfirmation(lang: Lang, name: string, reference: string): { subject: string; html: string } {
  return lang === 'ar'
    ? { subject: 'استلمنا طلب التسجيل كمدرب', html: wrap(lang, `<p>السيد/ة <b>${esc(name)}</b>،</p><p>شكراً لك، استلمنا طلبك للتسجيل كمدرب في مركز التدريب الإداري.</p><p>رقم الطلب: <b>${esc(reference)}</b></p><p>سنراجع الطلب والمرفقات ونتواصل معك على هذا البريد.</p>`) }
    : { subject: 'We received your trainer application', html: wrap(lang, `<p>Dear <b>${esc(name)}</b>,</p><p>Thank you. We have received your application to register as a trainer at the Administrative Training Center.</p><p>Reference: <b>${esc(reference)}</b></p><p>We will review your application and attachments and contact you at this address.</p>`) };
}

/** Sent to the training officer (Arabic: the staff work in Arabic). */
export function officerRegistration(c: { name: string; startDate: string }, d: { name: string; email: string; phone: string; workplace: string; organization: string; jobTitle: string; qualification: string; experience: string | null; notes: string | null }) {
  return {
    subject: `تسجيل جديد: ${c.name}`,
    html: wrap('ar', `<h3>تسجيل جديد في دورة</h3><p><b>الدورة:</b> ${esc(c.name)} (${esc(c.startDate)})</p>${table(rows([
      ['الاسم', d.name], ['البريد', d.email], ['الهاتف', d.phone], ['مكان العمل', d.workplace], ['الشركة', d.organization], ['المسمى الوظيفي', d.jobTitle], ['المؤهل العلمي', d.qualification], ['الخبرات / الاختصاص', d.experience], ['ملاحظات', d.notes],
    ]))}`),
  };
}

export function officerTrainerApplication(reference: string, a: { fullName: string; email: string; phone: string; specializations: string; trainingFields: string; qualification: string; certificates: number }) {
  return {
    subject: `طلب تسجيل مدرب جديد ${reference}`,
    html: wrap('ar', `<h3>طلب تسجيل مدرب جديد ${esc(reference)}</h3>${table(rows([
      ['الاسم', a.fullName], ['البريد', a.email], ['الهاتف', a.phone], ['الاختصاصات', a.specializations], ['مجالات التدريب', a.trainingFields], ['المؤهل العلمي', a.qualification], ['عدد الشهادات المرفقة', String(a.certificates)],
    ]))}<p>السيرة الذاتية والشهادات متاحة في لوحة التحكم.</p>`),
  };
}
