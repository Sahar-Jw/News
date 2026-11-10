'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { EMAIL_RE, PHONE_RE, THREE_PART_NAME_RE } from '@/components/site/training-shared';

type V = { name: string; email: string; phone: string; workplace: string; organization: string; jobTitle: string; qualification: string; experience: string; notes: string };
const EMPTY: V = { name: '', email: '', phone: '', workplace: '', organization: '', jobTitle: '', qualification: '', experience: '', notes: '' };
const REQUIRED = ['workplace', 'organization', 'jobTitle', 'qualification'] as const;

/** "Register now" form of one course. Same limits as the API (RegisterDto); errors show under each field; the server e-mails a confirmation. */
export function CourseRegister({ courseId, courseName, open, onClose, onDone }: { courseId: number; courseName: string; open: boolean; onClose: () => void; onDone?: () => void }) {
  const { t, lang } = useI18n();
  const [f, setF] = useState<V>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof V, string>>>({});
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof V, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: undefined })); setServerError(''); };
  const close = () => { onClose(); if (done) { setDone(false); setF(EMPTY); } };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    if (!THREE_PART_NAME_RE.test(f.name.trim())) err.name = t('tr.nameThree');
    if (!EMAIL_RE.test(f.email.trim()) || f.email.trim().length > 190) err.email = t('tr.emailInvalid');
    if (!PHONE_RE.test(f.phone.trim())) err.phone = t('tr.phoneInvalid');
    for (const k of REQUIRED) if (f[k].trim().length < 2) err[k] = t('tr.fieldRequired');
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    setServerError('');
    try {
      const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]));
      await api(`/public/training/courses/${courseId}/register`, { method: 'POST', body: { ...body, lang } });
      setDone(true);
      onDone?.();
    } catch (e2: any) { setServerError(e2.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={close} title={`${t('tr.regTitle')}: ${courseName}`} wide>
      {done ? (
        <div className="space-y-4 text-center">
          <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{t('tr.regDone')}</p>
          <Button type="button" onClick={close}>{t('app.close')}</Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <Field label={t('tr.fullName')} error={errors.name}><input className={inputCls} maxLength={150} autoComplete="name" aria-invalid={!!errors.name} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('site.phone')} error={errors.phone}><input type="tel" dir="ltr" className={inputCls} maxLength={30} autoComplete="tel" aria-invalid={!!errors.phone} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label={t('contact.email')} error={errors.email}><input type="email" dir="ltr" className={inputCls} maxLength={190} autoComplete="email" aria-invalid={!!errors.email} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label={t('tr.reg.workplace')} error={errors.workplace}><input className={inputCls} maxLength={150} aria-invalid={!!errors.workplace} value={f.workplace} onChange={(e) => set('workplace', e.target.value)} /></Field>
            <Field label={t('tr.org')} error={errors.organization}><input className={inputCls} maxLength={150} autoComplete="organization" aria-invalid={!!errors.organization} value={f.organization} onChange={(e) => set('organization', e.target.value)} /></Field>
            <Field label={t('tr.reg.jobTitle')} error={errors.jobTitle}><input className={inputCls} maxLength={150} autoComplete="organization-title" aria-invalid={!!errors.jobTitle} value={f.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} /></Field>
            <Field label={t('tr.reg.qualification')} error={errors.qualification}><input className={inputCls} maxLength={255} aria-invalid={!!errors.qualification} value={f.qualification} onChange={(e) => set('qualification', e.target.value)} /></Field>
          </div>
          <Field label={t('tr.reg.experience')}><textarea rows={2} className={inputCls} maxLength={3000} value={f.experience} onChange={(e) => set('experience', e.target.value)} /></Field>
          <Field label={t('tr.reg.notes')}><textarea rows={2} className={inputCls} maxLength={3000} value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          <p className="text-xs text-gray-500">{t('tr.mailNote')}</p>
          {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{t('app.cancel')}</Button><Button disabled={busy}>{t('tr.send')}</Button></div>
        </form>
      )}
    </Modal>
  );
}
