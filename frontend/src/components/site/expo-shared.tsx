'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useSite } from '@/components/site/site-context';
import { EMAIL_RE, PHONE_RE } from '@/components/site/training-shared';

export interface ExpoBase { id: number; name: string; description: string; website: string | null; logoUrl: string | null }
export interface ExpoExhibitor extends ExpoBase { sector: string; booth: string }
export interface ExpoSponsor extends ExpoBase { tier: string }
export interface ExpoSession extends ExpoBase { type: string; startsAt: string | null; endsAt: string | null; hall: string; speaker: string }
export interface ExpoData { exhibitors: ExpoExhibitor[]; sponsors: ExpoSponsor[]; sessions: ExpoSession[]; sectors: string[] }

export const SPONSOR_TIERS = ['strategic', 'gold', 'silver', 'partner'] as const;
export const SESSION_TYPES = ['keynote', 'seminar', 'workshop', 'b2b', 'other'] as const;
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
    email: String(s('expo', 'contact_email') ?? ''), phone: String(s('expo', 'contact_phone') ?? ''),
    newsTopic: L('news_topic'), registerOpen: s('expo', 'register_open') !== false && s('expo', 'register_open') !== 'false',
  };
}

type V = { name: string; company: string; email: string; phone: string; sector: string; message: string };
const EMPTY: V = { name: '', company: '', email: '', phone: '', sector: '', message: '' };

/** Stand request / visitor registration / information request → POST /public/expo/apply. Same limits as the API (ApplyDto). */
export function ApplyForm({ kind, sectors }: { kind: (typeof APPLICATION_KINDS)[number]; sectors: string[] }) {
  const { t } = useI18n();
  const [f, setF] = useState<V>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof V, string>>>({});
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(EMPTY); setErrors({}); setServerError(''); setDone(false); }, [kind]);

  const set = (k: keyof V, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: undefined })); setServerError(''); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    if (f.name.trim().length < 2) err.name = t('tr.nameRequired');
    if (!EMAIL_RE.test(f.email.trim()) || f.email.trim().length > 190) err.email = t('tr.emailInvalid');
    if (!PHONE_RE.test(f.phone.trim())) err.phone = t('tr.phoneInvalid');
    if (kind === 'exhibitor' && !f.company.trim()) err.company = t('ex.f.companyReq');
    if (kind === 'info' && f.message.trim().length < 3) err.message = t('contact.err.messageRequired');
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    setServerError('');
    try {
      await api('/public/expo/apply', { method: 'POST', body: { kind, name: f.name.trim(), company: f.company.trim(), email: f.email.trim(), phone: f.phone.trim(), sector: f.sector.trim(), message: f.message.trim() } });
      setDone(true);
    } catch (e2: any) { setServerError(e2.message); }
    finally { setBusy(false); }
  };

  if (done) return <p role="status" className="rounded-2xl bg-emerald-50 px-5 py-4 text-center text-sm font-semibold text-emerald-700">{t('ex.f.done')}</p>;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <Field label={t('tr.fullName')} error={errors.name}><input className={inputCls} maxLength={150} autoComplete="name" aria-invalid={!!errors.name} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
      <Field label={kind === 'exhibitor' ? t('ex.f.company') : t('tr.org')} error={errors.company}><input className={inputCls} maxLength={190} autoComplete="organization" aria-invalid={!!errors.company} value={f.company} onChange={(e) => set('company', e.target.value)} /></Field>
      <Field label={t('contact.email')} error={errors.email}><input type="email" dir="ltr" className={inputCls} maxLength={190} autoComplete="email" aria-invalid={!!errors.email} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
      <Field label={t('site.phone')} error={errors.phone}><input type="tel" dir="ltr" className={inputCls} maxLength={30} autoComplete="tel" aria-invalid={!!errors.phone} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
      {kind !== 'info' && (
        <Field label={kind === 'exhibitor' ? t('ex.f.sector') : t('ex.f.interest')}>
          {sectors.length ? (
            <select className={inputCls} value={f.sector} onChange={(e) => set('sector', e.target.value)}><option value="">—</option>{sectors.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          ) : <input className={inputCls} maxLength={150} value={f.sector} onChange={(e) => set('sector', e.target.value)} />}
        </Field>
      )}
      <div className="sm:col-span-2">
        <Field label={kind === 'exhibitor' ? t('ex.f.standNeeds') : t('contact.message')} error={errors.message}><textarea rows={4} className={inputCls} maxLength={3000} aria-invalid={!!errors.message} value={f.message} onChange={(e) => set('message', e.target.value)} /></Field>
      </div>
      {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">{serverError}</p>}
      <div className="sm:col-span-2"><Button disabled={busy}>{t('tr.send')}</Button></div>
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
