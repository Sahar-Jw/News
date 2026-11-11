'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useSite } from '@/components/site/site-context';
import { readBrandedPageLinks } from '@/lib/branded-page-links';
import { EMAIL_RE, PHONE_RE } from '@/components/site/training-shared';

export interface ExpoBase { id: number; name: string; description: string; website: string | null; logoUrl: string | null }
export interface ExpoExhibitor extends ExpoBase { sector: string; booth: string; mapX: number | null; mapY: number | null }
export interface ExpoSponsor extends ExpoBase { tier: string }
export interface ExpoSession extends ExpoBase { type: string; startsAt: string | null; endsAt: string | null; hall: string; speaker: string }
export interface ExpoData { exhibitors: ExpoExhibitor[]; sponsors: ExpoSponsor[]; sessions: ExpoSession[]; sectors: string[] }

export const SPONSOR_TIERS = ['strategic', 'gold', 'silver', 'partner'] as const;
export const SESSION_TYPES = ['keynote', 'seminar', 'workshop', 'b2b', 'event', 'meeting', 'activity', 'other'] as const;

/** label of a programme type (older types have dictionary keys, the new ones are inline) */
export const sessionTypeLabel = (type: string, ar: boolean) => ({ event: ['فعالية', 'Event'], meeting: ['لقاء', 'Meeting'], activity: ['نشاط مصاحب', 'Accompanying activity'] } as Record<string, [string, string]>)[type]?.[ar ? 0 : 1];
export const APPLICATION_KINDS = ['exhibitor', 'visitor', 'info'] as const;
export const APPLICATION_STATUSES = ['new', 'in_review', 'approved', 'rejected'] as const;

/** Exhibitors, sponsors and programme in one request (the lists are small). */
export function useExpoData() {
  const { lang } = useI18n();
  const [data, setData] = useState<ExpoData | null>(null);
  useEffect(() => {
    setData(null);
    api<ExpoData>('/public/expo', { params: { lang }, cache: 'no-store' }).then(setData).catch(() => setData({ exhibitors: [], sponsors: [], sessions: [], sectors: [] }));
  }, [lang]);
  return data;
}

/** Event info lives in the "expo" settings category; every text falls back to Arabic when the English one is empty. */
export function useExpoInfo() {
  const { lang } = useI18n();
  const { s, loc, img } = useSite();
  const L = (key: string) => loc('expo', key) || String(s('expo', `${key}_ar`) ?? '');
  const lines = (key: string) => L(key).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const start = String(s('expo', 'start_date') ?? '');
  const end = String(s('expo', 'end_date') ?? '') || start;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Damascus' });
  const daysLeft = start ? Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;
  const phase: 'upcoming' | 'live' | 'ended' | 'unknown' = !start ? 'unknown' : today < start ? 'upcoming' : today <= end ? 'live' : 'ended';
  return {
    lang, L, lines, start, end, daysLeft, phase,
    name: L('name') || 'DCC EXPO', tagline: L('tagline'), venue: L('venue'),
    logo: img('expo', 'logo'), hero: img('expo', 'hero_image'),
    floorPlan: L('floor_plan'), footerText: L('footer_text'),
    pageLinks: readBrandedPageLinks(s('expo', 'page_links'), 'expo'),
    email: String(s('expo', 'contact_email') ?? ''), phone: String(s('expo', 'contact_phone') ?? ''), website: String(s('expo', 'contact_website') ?? ''), address: L('contact_address'), mapUrl: String(s('expo', 'contact_map_url') ?? ''),
    floorPlanImage: img('expo', 'floor_plan_image'), social: (key: string) => String(s('expo', `social_${key}`) ?? ''),
    newsTopic: L('news_topic'), registerOpen: s('expo', 'register_open') !== false && s('expo', 'register_open') !== 'false',
  };
}

export const BOOTH_TYPES = ['equipped', 'space', 'collective', 'sponsor', 'other'] as const;
export const VISIT_INTERESTS = ['sourcing', 'partnerships', 'products', 'programme', 'other'] as const;
export const INQUIRY_TYPES = ['general', 'exhibitor', 'visitor', 'sponsorship', 'media', 'other'] as const;
const OPTIONS: Record<string, Record<string, [string, string]>> = {
  participationType: { equipped: ['جناح مجهّز', 'Equipped stand'], space: ['مساحة فقط', 'Space only'], collective: ['مشاركة جماعية', 'Collective participation'], sponsor: ['رعاية', 'Sponsorship'], other: ['أخرى', 'Other'] },
  interest: { sourcing: ['البحث عن موردين ومنتجات', 'Sourcing suppliers and products'], partnerships: ['شراكات وفرص أعمال', 'Partnerships and business'], products: ['الاطلاع على المنتجات والخدمات', 'Discovering products and services'], programme: ['حضور الندوات والفعاليات', 'Seminars and events'], other: ['أخرى', 'Other'] },
  inquiryType: { general: ['استفسار عام', 'General inquiry'], exhibitor: ['المشاركة كعارض', 'Taking part as exhibitor'], visitor: ['زيارة المعرض', 'Visiting the expo'], sponsorship: ['الرعاية والشراكة', 'Sponsorship and partnership'], media: ['الإعلام والتغطية', 'Media and coverage'], other: ['أخرى', 'Other'] },
};
/** label of a stored option (shared with the admin) */
export const expoOption = (field: 'participationType' | 'interest' | 'inquiryType', value: string, ar: boolean) => OPTIONS[field][value]?.[ar ? 0 : 1] ?? value;

type FieldKey = 'name' | 'company' | 'jobTitle' | 'email' | 'phone' | 'country' | 'city' | 'sector' | 'products' | 'area' | 'participationType' | 'interest' | 'inquiryType' | 'message';
type V = Record<FieldKey, string>;
const EMPTY: V = { name: '', company: '', jobTitle: '', email: '', phone: '', country: '', city: '', sector: '', products: '', area: '', participationType: '', interest: '', inquiryType: '', message: '' };
const REQUIRED: Record<(typeof APPLICATION_KINDS)[number], FieldKey[]> = {
  exhibitor: ['company', 'name', 'jobTitle', 'phone', 'email', 'country', 'city', 'sector', 'products', 'area', 'participationType'],
  visitor: ['name', 'jobTitle', 'phone', 'email', 'country', 'city', 'sector', 'interest'],
  info: ['name', 'phone', 'email', 'inquiryType', 'message'],
};
const MAX_PROFILE = 10 * 1024 * 1024;

/**
 * The three EXPO request forms → POST /public/expo/apply (multipart):
 * exhibitor (company, contact person, job title, phone, e-mail, country, city, business field, products, area, stand type, notes, optional profile file),
 * visitor (three-part name, company if any, job title, phone, e-mail, country, city, field, interest), information request (three-part name, company if any,
 * phone, e-mail, inquiry type, text). The same required fields are checked by the API.
 */
export function ApplyForm({ kind, sectors }: { kind: (typeof APPLICATION_KINDS)[number]; sectors: string[] }) {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const tr = (a: string, e: string) => (ar ? a : e);
  const [f, setF] = useState<V>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<FieldKey | 'file', string>>>({});
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(EMPTY); setFile(null); setFileKey((k) => k + 1); setErrors({}); setServerError(''); setDone(false); }, [kind]);

  const set = (k: FieldKey, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: undefined })); setServerError(''); };
  const req = (k: FieldKey) => REQUIRED[kind].includes(k);
  const L = (k: FieldKey, label: string) => `${label}${req(k) ? ' *' : ''}`;
  const pickFile = (picked: File | null) => {
    setErrors((p) => ({ ...p, file: undefined }));
    if (!picked) return setFile(null);
    if (!/\.(pdf|docx?)$/i.test(picked.name)) { setErrors((p) => ({ ...p, file: tr('الملف يجب أن يكون PDF أو Word', 'The file must be PDF or Word') })); setFileKey((k) => k + 1); return setFile(null); }
    if (picked.size > MAX_PROFILE) { setErrors((p) => ({ ...p, file: tr('حجم الملف يتجاوز 10 ميغابايت', 'The file is larger than 10 MB') })); setFileKey((k) => k + 1); return setFile(null); }
    setFile(picked);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    for (const k of REQUIRED[kind]) if (!f[k].trim()) err[k] = tr('هذا الحقل مطلوب', 'This field is required');
    if (!err.name && kind !== 'exhibitor' && f.name.trim().split(/\s+/).length < 3) err.name = tr('أدخل الاسم الثلاثي', 'Enter the three-part name');
    if (!err.email && (!EMAIL_RE.test(f.email.trim()) || f.email.trim().length > 190)) err.email = t('tr.emailInvalid');
    if (!err.phone && !PHONE_RE.test(f.phone.trim())) err.phone = t('tr.phoneInvalid');
    if (kind === 'info' && !err.message && f.message.trim().length < 3) err.message = t('contact.err.messageRequired');
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    setServerError('');
    try {
      const fd = new FormData();
      fd.set('kind', kind);
      for (const k of Object.keys(EMPTY) as FieldKey[]) if (f[k].trim()) fd.set(k, f[k].trim());
      if (kind === 'exhibitor' && file) fd.set('profile', file);
      await api('/public/expo/apply', { method: 'POST', form: fd });
      setDone(true);
    } catch (e2: any) { setServerError(e2.message); }
    finally { setBusy(false); }
  };

  const text = (k: FieldKey, label: string, extra: { type?: string; dir?: 'ltr'; max?: number; auto?: string; list?: string } = {}) => (
    <Field label={L(k, label)} error={errors[k]}><input type={extra.type} dir={extra.dir} list={extra.list} className={inputCls} maxLength={extra.max ?? 150} autoComplete={extra.auto} aria-invalid={!!errors[k]} value={f[k]} onChange={(e) => set(k, e.target.value)} /></Field>
  );
  const select = (k: 'participationType' | 'interest' | 'inquiryType', label: string) => (
    <Field label={L(k, label)} error={errors[k]}>
      <select className={inputCls} aria-invalid={!!errors[k]} value={f[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">—</option>{Object.keys(OPTIONS[k]).map((v) => <option key={v} value={v}>{expoOption(k, v, ar)}</option>)}
      </select>
    </Field>
  );

  if (done) return <p role="status" className="rounded-2xl bg-emerald-50 px-5 py-4 text-center text-sm font-semibold text-emerald-700">{t('ex.f.done')}</p>;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      {kind === 'exhibitor' && <>
        {text('company', tr('اسم الشركة أو المؤسسة', 'Company / organization name'), { max: 190, auto: 'organization' })}
        {text('name', tr('اسم الشخص المسؤول', 'Contact person'), { auto: 'name' })}
        {text('jobTitle', tr('الصفة الوظيفية', 'Job title'), { auto: 'organization-title' })}
      </>}
      {kind !== 'exhibitor' && <>
        {text('name', tr('الاسم الثلاثي', 'Full name (three parts)'), { auto: 'name' })}
        {text('company', tr('اسم الشركة أو المؤسسة (إن وجد)', 'Company / organization (if any)'), { max: 190, auto: 'organization' })}
        {kind === 'visitor' && text('jobTitle', tr('المسمى الوظيفي', 'Job title'), { auto: 'organization-title' })}
      </>}
      {text('phone', t('site.phone'), { type: 'tel', dir: 'ltr', max: 30, auto: 'tel' })}
      {text('email', t('contact.email'), { type: 'email', dir: 'ltr', max: 190, auto: 'email' })}
      {kind !== 'info' && <>
        {text('country', tr('الدولة', 'Country'), { max: 100, auto: 'country-name' })}
        {text('city', tr('المدينة', 'City'), { max: 100, auto: 'address-level2' })}
        <datalist id="expo-sectors">{sectors.map((x) => <option key={x} value={x} />)}</datalist>
        {text('sector', kind === 'exhibitor' ? tr('مجال عمل الشركة', 'Business field of the company') : tr('مجال العمل أو الاختصاص', 'Field of work / specialization'), { list: 'expo-sectors' })}
      </>}
      {kind === 'exhibitor' && <>
        <div className="sm:col-span-2"><Field label={L('products', tr('المنتجات أو الخدمات التي ترغب الشركة في عرضها', 'Products or services you wish to exhibit'))} error={errors.products}><textarea rows={3} className={inputCls} maxLength={3000} aria-invalid={!!errors.products} value={f.products} onChange={(e) => set('products', e.target.value)} /></Field></div>
        {text('area', tr('المساحة المطلوبة للمشاركة (م²)', 'Required area (m²)'), { max: 40 })}
        {select('participationType', tr('نوع الجناح أو المشاركة', 'Stand / participation type'))}
        <div className="sm:col-span-2"><Field label={tr('ملاحظات إضافية', 'Additional notes')}><textarea rows={3} className={inputCls} maxLength={3000} value={f.message} onChange={(e) => set('message', e.target.value)} /></Field></div>
        <div className="sm:col-span-2">
          <Field label={tr('ملف التعريف بالشركة (اختياري - PDF أو Word حتى 10 ميغابايت)', 'Company profile (optional - PDF or Word, up to 10 MB)')} error={errors.file}>
            <input key={fileKey} type="file" accept=".pdf,.doc,.docx,application/pdf" className={inputCls} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          </Field>
        </div>
      </>}
      {kind === 'visitor' && select('interest', tr('طبيعة الاهتمام بالمعرض', 'Interest in the expo'))}
      {kind === 'info' && <>
        {select('inquiryType', tr('نوع الاستفسار', 'Inquiry type'))}
        <div className="sm:col-span-2"><Field label={L('message', tr('نص الاستفسار أو المعلومات المطلوبة', 'Your inquiry / the information you need'))} error={errors.message}><textarea rows={4} className={inputCls} maxLength={3000} aria-invalid={!!errors.message} value={f.message} onChange={(e) => set('message', e.target.value)} /></Field></div>
      </>}
      {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">{serverError}</p>}
      <div className="sm:col-span-2"><Button disabled={busy}>{busy ? tr('جارٍ الإرسال…', 'Sending…') : t('tr.send')}</Button></div>
    </form>
  );
}

/** the small gold underline used under every EXPO heading */
export function Heading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <header className="mb-6 text-center">
      <h2 className="text-2xl font-extrabold text-primary md:text-3xl">{children}</h2>
      {sub && <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">{sub}</p>}
      <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-accent" /><span className="h-1 w-2 rounded-full bg-accent/50" /><span className="h-1 w-1 rounded-full bg-accent/25" /></div>
    </header>
  );
}

/** A titled white block of the EXPO pages. Shown only when it has content. */
export function Block({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-6 shadow-card ring-1 ring-line ${className}`}>
      <h3 className="mb-3 text-lg font-extrabold text-primary">{title}</h3>
      {children}
    </section>
  );
}

/** One item per line, shown as a diamond list */
export function Bullets({ items }: { items: string[] }) {
  return <ul className="space-y-2 text-sm leading-7 text-gray-700">{items.map((w, i) => <li key={i} className="flex gap-2"><span className="mt-1 text-accent">◆</span><span>{w}</span></li>)}</ul>;
}

/** Sponsors and partners grouped by tier (home page and the sponsors page) */
export function SponsorTiers({ sponsors }: { sponsors: ExpoSponsor[] }) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      {SPONSOR_TIERS.map((tier) => {
        const list = sponsors.filter((s) => ((SPONSOR_TIERS as readonly string[]).includes(s.tier) ? s.tier : 'partner') === tier);
        if (!list.length) return null;
        return (
          <div key={tier}>
            <div className="mb-2 text-center text-xs font-extrabold tracking-wider text-accent">{t(`ex.tier.${tier}`)}</div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {list.map((s) => {
                const inner = s.logoUrl ? <img src={s.logoUrl} alt={s.name} className="h-12 max-w-[9rem] object-contain" /> : <span className="font-bold text-secondary">{s.name}</span>;
                return s.website ? <a key={s.id} href={s.website} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white px-5 py-3 shadow-card ring-1 ring-line transition hover:ring-accent">{inner}</a> : <span key={s.id} className="rounded-xl bg-white px-5 py-3 shadow-card ring-1 ring-line">{inner}</span>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Floor plan image with a clickable pin for every exhibitor that has a position on it (set in the exhibitor's form). */
export function FloorPlanMap({ image, exhibitors }: { image: string; exhibitors: ExpoExhibitor[] }) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [picked, setPicked] = useState<number | null>(null);
  const pins = exhibitors.filter((e) => e.mapX != null && e.mapY != null);
  const sel = pins.find((e) => e.id === picked);
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
        <img src={image} alt={ar ? 'مخطط المعرض' : 'Floor plan'} className="block w-full" />
        {pins.map((e) => (
          <button key={e.id} type="button" onClick={() => setPicked(e.id === picked ? null : e.id)} aria-label={e.name} aria-pressed={e.id === picked}
            style={{ left: `${e.mapX}%`, top: `${e.mapY}%` }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white px-2 py-0.5 text-[11px] font-extrabold shadow-lg transition hover:scale-110 ${e.id === picked ? 'z-10 scale-110 bg-accent text-secondary' : 'bg-primary text-white'}`}>
            {e.booth || e.name.slice(0, 2)}
          </button>
        ))}
      </div>
      {pins.length > 0 && (
        <div className="mt-3 min-h-16 rounded-2xl bg-white p-4 text-sm shadow-card ring-1 ring-line" aria-live="polite">
          {sel ? (
            <div className="flex items-center gap-3">
              {sel.logoUrl ? <img src={sel.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" /> : <span className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-lg font-extrabold text-primary">{sel.name.slice(0, 1)}</span>}
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-secondary">{sel.name}</div>
                <div className="text-xs text-gray-600">{[sel.sector, sel.booth && `${ar ? 'الجناح' : 'Stand'} ${sel.booth}`].filter(Boolean).join(' · ')}</div>
              </div>
              {sel.website && <a href={sel.website} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold text-primary hover:underline">{ar ? 'زيارة الموقع' : 'Website'} ↗</a>}
            </div>
          ) : <p className="text-gray-500">{ar ? 'اضغط على أي جناح لمعرفة العارض.' : 'Select a stand to see the exhibitor.'}</p>}
        </div>
      )}
    </div>
  );
}
