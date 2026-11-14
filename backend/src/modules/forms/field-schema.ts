import { BadRequestException } from '@nestjs/common';

/** Every field type the builder offers. Adding a type = one entry here + one case in validateValue() + one renderer in the frontend. */
export const FIELD_TYPES = ['text', 'textarea', 'number', 'email', 'phone', 'url', 'date', 'select', 'radio', 'checkbox', 'multiselect', 'file', 'heading', 'note'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
/** shown only: no value is collected */
export const DISPLAY_TYPES: FieldType[] = ['heading', 'note'];
export const FILE_KINDS = ['image', 'pdf', 'doc'] as const;
export type FileKind = (typeof FILE_KINDS)[number];
export const FIELD_ROLES = ['name', 'email', 'phone'] as const;

export interface FieldOption { value: string; ar: string; en?: string }
export interface FieldDef {
  /** stable id of the field (a-z, 0-9, _): answers are stored under it, so it never changes once submissions exist */
  key: string;
  type: FieldType;
  labelAr: string;
  labelEn?: string;
  helpAr?: string;
  helpEn?: string;
  required?: boolean;
  options?: FieldOption[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  /** personal / confidential: hidden from staff without forms.submissions.sensitive, encrypted at rest when FORMS_ENCRYPTION_KEY is set */
  sensitive?: boolean;
  /** which value identifies the applicant (list, search, contact) */
  role?: (typeof FIELD_ROLES)[number];
  /** type "file" */
  fileKinds?: FileKind[];
  maxFiles?: number;
  maxSizeMb?: number;
  /** show this field only when another field has this value */
  showIf?: { key: string; equals: string };
}

export interface FormStatus { key: string; ar: string; en?: string; color?: string }
export interface FormCategory { key: string; ar: string; en?: string }
export interface FormIntegration { type: 'webhook'; name: string; url: string; secret?: string; events: ('submitted' | 'status_changed')[]; enabled: boolean }

export const DEFAULT_STATUSES: FormStatus[] = [
  { key: 'new', ar: 'جديد', en: 'New', color: '#2563eb' },
  { key: 'in_review', ar: 'قيد المراجعة', en: 'In review', color: '#d97706' },
  { key: 'accepted', ar: 'مقبول', en: 'Accepted', color: '#059669' },
  { key: 'rejected', ar: 'مرفوض', en: 'Rejected', color: '#dc2626' },
  { key: 'completed', ar: 'مكتمل', en: 'Completed', color: '#475569' },
];

export const MAX_FIELDS = 120;
export const MAX_FILE_MB = 10;
export const MAX_FILES_PER_FIELD = 10;
const KEY_RE = /^[a-z][a-z0-9_]{0,49}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/;
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
const PHONE_RE = /^[+()\d][\d\s().\-+]{4,29}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const RESERVED_KEYS = ['__proto__', 'constructor', 'prototype', 'consent', 'website'];

const str = (v: unknown, max: number, what: string, required = false): string | undefined => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new BadRequestException(`${what} مطلوب`);
    return undefined;
  }
  if (typeof v !== 'string') throw new BadRequestException(`${what} غير صالح`);
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (required && !s) throw new BadRequestException(`${what} مطلوب`);
  if (s.length > max) throw new BadRequestException(`${what} أطول من ${max} حرفاً`);
  return s || undefined;
};
const num = (v: unknown, what: string): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new BadRequestException(`${what} يجب أن يكون رقماً`);
  return n;
};

export const isValidSlug = (s: string) => SLUG_RE.test(s);

/** Cleans and validates the field list sent by the builder: unknown properties are dropped, so nothing unexpected is ever stored. */
export function cleanFields(input: unknown): FieldDef[] {
  if (!Array.isArray(input)) throw new BadRequestException('قائمة الحقول غير صالحة');
  if (input.length > MAX_FIELDS) throw new BadRequestException(`الحد الأقصى ${MAX_FIELDS} حقلاً`);
  const out: FieldDef[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') throw new BadRequestException('حقل غير صالح');
    const r = raw as Record<string, any>;
    const key = String(r.key ?? '');
    if (!KEY_RE.test(key) || RESERVED_KEYS.includes(key)) throw new BadRequestException(`معرّف الحقل "${key}" غير صالح (أحرف إنكليزية صغيرة وأرقام و _ ويبدأ بحرف)`);
    if (seen.has(key)) throw new BadRequestException(`معرّف الحقل "${key}" مكرر`);
    seen.add(key);
    if (!FIELD_TYPES.includes(r.type)) throw new BadRequestException(`نوع الحقل "${r.type}" غير مدعوم`);
    const type = r.type as FieldType;
    const f: FieldDef = { key, type, labelAr: str(r.labelAr, 300, `عنوان الحقل ${key}`, true)! };
    const labelEn = str(r.labelEn, 300, 'العنوان بالإنكليزية');
    if (labelEn) f.labelEn = labelEn;
    const helpAr = str(r.helpAr, 500, 'نص المساعدة');
    if (helpAr) f.helpAr = helpAr;
    const helpEn = str(r.helpEn, 500, 'نص المساعدة بالإنكليزية');
    if (helpEn) f.helpEn = helpEn;
    if (DISPLAY_TYPES.includes(type)) {
      out.push(f);
      continue;
    }
    if (r.required) f.required = true;
    if (r.sensitive) f.sensitive = true;
    if (r.role) {
      if (!FIELD_ROLES.includes(r.role)) throw new BadRequestException('دور الحقل غير صالح');
      if (r.role === 'email' && type !== 'email') throw new BadRequestException('دور البريد يلزمه حقل من نوع بريد إلكتروني');
      if (!['text', 'email', 'phone'].includes(type)) throw new BadRequestException('دور الحقل يلزمه حقل نصي أو بريد أو هاتف');
      f.role = r.role;
    }
    if (['select', 'radio', 'multiselect'].includes(type)) {
      if (!Array.isArray(r.options) || r.options.length < 1) throw new BadRequestException(`الحقل "${key}" يحتاج خياراً واحداً على الأقل`);
      if (r.options.length > 100) throw new BadRequestException('الحد الأقصى 100 خيار');
      const vals = new Set<string>();
      f.options = r.options.map((o: any) => {
        const value = str(o?.value, 100, 'قيمة الخيار', true)!;
        if (vals.has(value)) throw new BadRequestException(`قيمة الخيار "${value}" مكررة`);
        vals.add(value);
        const opt: FieldOption = { value, ar: str(o?.ar, 200, 'نص الخيار', true)! };
        const en = str(o?.en, 200, 'نص الخيار بالإنكليزية');
        if (en) opt.en = en;
        return opt;
      });
    }
    if (type === 'number') {
      const min = num(r.min, 'الحد الأدنى');
      const max = num(r.max, 'الحد الأعلى');
      if (min !== undefined) f.min = min;
      if (max !== undefined) f.max = max;
      if (min !== undefined && max !== undefined && min > max) throw new BadRequestException('الحد الأدنى أكبر من الأعلى');
    }
    if (['text', 'textarea'].includes(type)) {
      const minLength = num(r.minLength, 'الحد الأدنى للطول');
      const maxLength = num(r.maxLength, 'الحد الأعلى للطول');
      if (minLength !== undefined) f.minLength = Math.max(0, Math.floor(minLength));
      if (maxLength !== undefined) f.maxLength = Math.min(20000, Math.max(1, Math.floor(maxLength)));
    }
    if (type === 'file') {
      const kinds: FileKind[] = Array.isArray(r.fileKinds) ? r.fileKinds.filter((k: any) => FILE_KINDS.includes(k)) : [];
      f.fileKinds = kinds.length ? [...new Set(kinds)] : ['image', 'pdf', 'doc'];
      f.maxFiles = Math.min(MAX_FILES_PER_FIELD, Math.max(1, Math.floor(num(r.maxFiles, 'عدد الملفات') ?? 1)));
      f.maxSizeMb = Math.min(MAX_FILE_MB, Math.max(1, Math.floor(num(r.maxSizeMb, 'حجم الملف') ?? 5)));
      f.sensitive = true; // uploaded documents are always treated as personal data
    }
    if (r.showIf) {
      const k = String(r.showIf.key ?? '');
      if (!KEY_RE.test(k) || k === key) throw new BadRequestException('شرط الإظهار غير صالح');
      f.showIf = { key: k, equals: str(String(r.showIf.equals ?? ''), 100, 'قيمة شرط الإظهار') ?? '' };
    }
    out.push(f);
  }
  // a condition may only look at an earlier field that exists (no loops, no dangling references)
  const index = new Map(out.map((f, i) => [f.key, i]));
  out.forEach((f, i) => {
    if (f.showIf) {
      const at = index.get(f.showIf.key);
      if (at === undefined || at >= i || DISPLAY_TYPES.includes(out[at].type)) throw new BadRequestException(`شرط الإظهار في "${f.key}" يجب أن يشير إلى حقل سابق`);
    }
  });
  if (out.filter((f) => f.role === 'email').length > 1) throw new BadRequestException('حقل واحد فقط بدور البريد الإلكتروني');
  return out;
}

export function cleanStatuses(input: unknown): FormStatus[] {
  if (input === undefined || input === null) return DEFAULT_STATUSES;
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) throw new BadRequestException('قائمة الحالات غير صالحة (1 إلى 20)');
  const seen = new Set<string>();
  return input.map((s: any) => {
    const key = String(s?.key ?? '');
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || seen.has(key)) throw new BadRequestException(`مفتاح الحالة "${key}" غير صالح أو مكرر`);
    seen.add(key);
    const o: FormStatus = { key, ar: str(s.ar, 80, 'اسم الحالة', true)! };
    const en = str(s.en, 80, 'اسم الحالة بالإنكليزية');
    if (en) o.en = en;
    if (typeof s.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(s.color)) o.color = s.color;
    return o;
  });
}

export function cleanCategories(input: unknown): FormCategory[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > 50) throw new BadRequestException('قائمة التصنيفات غير صالحة');
  const seen = new Set<string>();
  return input.map((s: any) => {
    const key = String(s?.key ?? '');
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || seen.has(key)) throw new BadRequestException(`مفتاح التصنيف "${key}" غير صالح أو مكرر`);
    seen.add(key);
    const o: FormCategory = { key, ar: str(s.ar, 80, 'اسم التصنيف', true)! };
    const en = str(s.en, 80, 'اسم التصنيف بالإنكليزية');
    if (en) o.en = en;
    return o;
  });
}

export function cleanIntegrations(input: unknown): FormIntegration[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input) || input.length > 10) throw new BadRequestException('قائمة الربط غير صالحة');
  return input.map((i: any) => {
    const url = str(i?.url, 500, 'عنوان الربط', true)!;
    let u: URL;
    try { u = new URL(url); } catch { throw new BadRequestException('عنوان الربط غير صالح'); }
    if (u.protocol !== 'https:') throw new BadRequestException('عنوان الربط يجب أن يكون https');
    const events = (Array.isArray(i.events) ? i.events : ['submitted']).filter((e: any) => e === 'submitted' || e === 'status_changed');
    return { type: 'webhook' as const, name: str(i.name, 100, 'اسم الربط', true)!, url, secret: str(i.secret, 200, 'المفتاح السري'), events: events.length ? events : ['submitted'], enabled: i.enabled !== false };
  });
}

// ------------------------------------------------------------------------------------------------ answers

export interface CleanAnswers { answers: Record<string, any>; fileFields: FieldDef[] }

/** is this field shown, given the answers so far? (a hidden field is neither required nor stored) */
export function isVisible(f: FieldDef, answers: Record<string, any>): boolean {
  if (!f.showIf) return true;
  const v = answers[f.showIf.key];
  return Array.isArray(v) ? v.includes(f.showIf.equals) : String(v ?? '') === f.showIf.equals;
}

/** Validates one value against its field; returns the cleaned value (undefined = empty). Throws a message naming the field. */
function validateValue(f: FieldDef, raw: unknown): any {
  const name = f.labelAr;
  const empty = raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0);
  if (empty) {
    if (f.required && f.type !== 'checkbox') throw new BadRequestException(`الحقل "${name}" مطلوب`);
    if (f.type === 'checkbox') {
      if (f.required) throw new BadRequestException(`الحقل "${name}" مطلوب`);
      return false;
    }
    return undefined;
  }
  switch (f.type) {
    case 'text':
    case 'textarea': {
      if (typeof raw !== 'string') throw new BadRequestException(`قيمة "${name}" غير صالحة`);
      const s = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
      const max = f.maxLength ?? (f.type === 'text' ? 300 : 5000);
      if (s.length > max) throw new BadRequestException(`"${name}" أطول من ${max} حرفاً`);
      if (f.minLength && s.length < f.minLength) throw new BadRequestException(`"${name}" أقصر من ${f.minLength} أحرف`);
      return s;
    }
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) throw new BadRequestException(`"${name}" يجب أن يكون رقماً`);
      if (f.min !== undefined && n < f.min) throw new BadRequestException(`"${name}" أقل من ${f.min}`);
      if (f.max !== undefined && n > f.max) throw new BadRequestException(`"${name}" أكبر من ${f.max}`);
      return n;
    }
    case 'email': {
      const s = String(raw).trim();
      if (s.length > 190 || !EMAIL_RE.test(s)) throw new BadRequestException(`البريد في "${name}" غير صالح`);
      return s.toLowerCase();
    }
    case 'phone': {
      const s = String(raw).trim();
      if (!PHONE_RE.test(s)) throw new BadRequestException(`رقم الهاتف في "${name}" غير صالح`);
      return s;
    }
    case 'url': {
      const s = String(raw).trim();
      let u: URL;
      try { u = new URL(s); } catch { throw new BadRequestException(`الرابط في "${name}" غير صالح`); }
      if (!['http:', 'https:'].includes(u.protocol) || s.length > 500) throw new BadRequestException(`الرابط في "${name}" غير صالح`);
      return s;
    }
    case 'date': {
      const s = String(raw).trim();
      if (!DATE_RE.test(s) || Number.isNaN(new Date(s).getTime())) throw new BadRequestException(`التاريخ في "${name}" غير صالح`);
      return s;
    }
    case 'select':
    case 'radio': {
      const s = String(raw);
      if (!f.options?.some((o) => o.value === s)) throw new BadRequestException(`خيار غير صالح في "${name}"`);
      return s;
    }
    case 'multiselect': {
      const arr = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      if (new Set(arr).size !== arr.length || arr.some((v) => !f.options?.some((o) => o.value === v))) throw new BadRequestException(`خيار غير صالح في "${name}"`);
      return arr;
    }
    case 'checkbox':
      return raw === true || raw === 'true' || raw === 'on' || raw === '1' || raw === 1;
    default:
      return undefined;
  }
}

/** Walks the form's fields (never the submitted keys): unknown keys are ignored, hidden fields are skipped, every value is checked. File fields are checked by the caller. */
export function cleanAnswers(fields: FieldDef[], input: Record<string, any>): CleanAnswers {
  const answers: Record<string, any> = {};
  const fileFields: FieldDef[] = [];
  for (const f of fields) {
    if (DISPLAY_TYPES.includes(f.type)) continue;
    if (!isVisible(f, answers)) continue;
    if (f.type === 'file') {
      fileFields.push(f);
      continue;
    }
    const v = validateValue(f, Object.prototype.hasOwnProperty.call(input, f.key) ? input[f.key] : undefined);
    if (v !== undefined) answers[f.key] = v;
  }
  return { answers, fileFields };
}

/** Readable text of one value, for the e-mails and the Excel export */
export function displayValue(f: FieldDef, v: any, lang: 'ar' | 'en' = 'ar'): string {
  if (v === undefined || v === null) return '';
  const label = (value: string) => {
    const o = f.options?.find((x) => x.value === value);
    return o ? (lang === 'en' && o.en ? o.en : o.ar) : value;
  };
  if (Array.isArray(v)) return v.map((x) => label(String(x))).join('، ');
  if (typeof v === 'boolean') return v ? (lang === 'en' ? 'Yes' : 'نعم') : lang === 'en' ? 'No' : 'لا';
  if (f.type === 'select' || f.type === 'radio') return label(String(v));
  return String(v);
}
