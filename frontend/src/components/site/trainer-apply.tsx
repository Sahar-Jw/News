'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { EMAIL_RE, PHONE_RE, THREE_PART_NAME_RE } from '@/components/site/training-shared';

const MAX_CERTS = 5;
const MAX_DOC = 10 * 1024 * 1024;
const MAX_IMG = 5 * 1024 * 1024;
const CV_ACCEPT = '.pdf,.doc,.docx';
const CERT_ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp';

type V = { fullName: string; phone: string; email: string; specializations: string; trainingFields: string; qualification: string; experience: string; programs: string; bio: string };
const EMPTY: V = { fullName: '', phone: '', email: '', specializations: '', trainingFields: '', qualification: '', experience: '', programs: '', bio: '' };
const TEXT_REQUIRED = ['specializations', 'trainingFields', 'qualification', 'experience', 'programs', 'bio'] as const;
const tooBig = (f: File) => f.size > (f.type.startsWith('image/') ? MAX_IMG : MAX_DOC);

/** Public "register as a trainer" form: personal data, fields of training, programmes, CV (required) and certificates (optional). */
export function TrainerApplyForm() {
  const { t, lang } = useI18n();
  const [v, setV] = useState<V>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof V | 'cv' | 'certs', string>>>({});
  const [cv, setCv] = useState<File | null>(null);
  const [certs, setCerts] = useState<File[]>([]);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cvPicker = useRef<HTMLInputElement>(null);
  const certPicker = useRef<HTMLInputElement>(null);

  const set = (k: keyof V, val: string) => { setV((p) => ({ ...p, [k]: val })); setErrors((p) => ({ ...p, [k]: undefined })); setServerError(''); };

  const pickCv = (list: FileList | null) => {
    const f = list?.[0] ?? null;
    if (f && tooBig(f)) { setErrors((p) => ({ ...p, cv: t('tr.ta.tooBig') })); if (cvPicker.current) cvPicker.current.value = ''; return; }
    setCv(f);
    setErrors((p) => ({ ...p, cv: undefined }));
  };
  const addCerts = (list: FileList | null) => {
    const next = [...certs];
    let error = '';
    for (const f of Array.from(list ?? [])) {
      if (next.length >= MAX_CERTS) { error = t('tr.ta.maxCerts'); break; }
      if (tooBig(f)) { error = t('tr.ta.tooBig'); continue; }
      next.push(f);
    }
    setCerts(next);
    setErrors((p) => ({ ...p, certs: error || undefined }));
    if (certPicker.current) certPicker.current.value = '';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    if (!THREE_PART_NAME_RE.test(v.fullName.trim())) err.fullName = t('tr.nameThree');
    if (!PHONE_RE.test(v.phone.trim())) err.phone = t('tr.phoneInvalid');
    if (!EMAIL_RE.test(v.email.trim()) || v.email.trim().length > 190) err.email = t('tr.emailInvalid');
    for (const k of TEXT_REQUIRED) if (v[k].trim().length < 2) err[k] = t('tr.fieldRequired');
    if (!cv) err.cv = t('tr.ta.cvRequired');
    setErrors(err);
    if (Object.keys(err).length) return;
    const fd = new FormData();
    for (const [k, val] of Object.entries(v)) fd.set(k, val.trim());
    fd.set('lang', lang);
    fd.set('cv', cv!);
    certs.forEach((f) => fd.append('certificates', f));
    setBusy(true);
    setServerError('');
    try {
      const r = await api<{ reference: string }>('/public/training/trainer-applications', { method: 'POST', form: fd });
      setDone(r.reference);
      setV(EMPTY); setCv(null); setCerts([]);
    } catch (e2: any) { setServerError(e2.message); }
    finally { setBusy(false); }
  };

  if (done) return <p role="status" className="rounded-2xl bg-emerald-50 px-5 py-4 text-sm font-semibold leading-7 text-emerald-700">{t('tr.ta.done').replace('{ref}', done)}</p>;

  const area = (k: keyof V, label: string, max: number, rows = 3) => (
    <Field label={label} error={errors[k]}><textarea rows={rows} maxLength={max} className={inputCls} aria-invalid={!!errors[k]} value={v[k]} onChange={(e) => set(k, e.target.value)} /></Field>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line md:p-8">
      <Field label={t('tr.fullName')} error={errors.fullName}><input className={inputCls} maxLength={150} autoComplete="name" aria-invalid={!!errors.fullName} value={v.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('site.phone')} error={errors.phone}><input type="tel" dir="ltr" className={inputCls} maxLength={30} autoComplete="tel" aria-invalid={!!errors.phone} value={v.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label={t('contact.email')} error={errors.email}><input type="email" dir="ltr" className={inputCls} maxLength={190} autoComplete="email" aria-invalid={!!errors.email} value={v.email} onChange={(e) => set('email', e.target.value)} /></Field>
      </div>
      {area('specializations', t('tr.ta.specializations'), 3000, 2)}
      {area('trainingFields', t('tr.ta.fields'), 3000, 2)}
      <Field label={t('tr.reg.qualification')} error={errors.qualification}><input className={inputCls} maxLength={255} aria-invalid={!!errors.qualification} value={v.qualification} onChange={(e) => set('qualification', e.target.value)} /></Field>
      {area('experience', t('tr.ta.experience'), 5000, 4)}
      {area('programs', t('tr.ta.programs'), 5000, 4)}
      {area('bio', t('tr.ta.bio'), 3000, 4)}

      <Field label={t('tr.ta.cv')} hint={t('tr.ta.cvHint')} error={errors.cv}>
        <input ref={cvPicker} type="file" accept={CV_ACCEPT} className={inputCls} aria-invalid={!!errors.cv} onChange={(e) => pickCv(e.target.files)} />
      </Field>
      {cv && <p className="truncate rounded-lg bg-canvas px-3 py-1.5 text-sm">{cv.name}</p>}

      <Field label={t('tr.ta.certs')} hint={t('tr.ta.certsHint')} error={errors.certs}>
        <input ref={certPicker} type="file" multiple accept={CERT_ACCEPT} className={inputCls} onChange={(e) => addCerts(e.target.files)} />
      </Field>
      {certs.length > 0 && (
        <ul className="space-y-1 text-sm">
          {certs.map((f, i) => <li key={i} className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-1.5"><span className="truncate">{f.name}</span><button type="button" aria-label={t('app.delete')} className="text-red-600" onClick={() => setCerts(certs.filter((_, j) => j !== i))}>✕</button></li>)}
        </ul>
      )}

      <p className="text-xs text-gray-500">{t('tr.mailNote')}</p>
      {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>}
      <div className="flex justify-end"><Button disabled={busy}>{t('tr.ta.submit')}</Button></div>
    </form>
  );
}
