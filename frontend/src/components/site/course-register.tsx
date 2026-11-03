'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { EMAIL_RE, PHONE_RE } from '@/components/site/training-shared';

type V = { name: string; email: string; phone: string; organization: string };
const EMPTY: V = { name: '', email: '', phone: '', organization: '' };

/** "Register now" form of one course. Same limits as the API (RegisterDto); errors show under each field. */
export function CourseRegister({ courseId, courseName, open, onClose, onDone }: { courseId: number; courseName: string; open: boolean; onClose: () => void; onDone?: () => void }) {
  const { t } = useI18n();
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
    if (f.name.trim().length < 2) err.name = t('tr.nameRequired');
    if (!EMAIL_RE.test(f.email.trim()) || f.email.trim().length > 190) err.email = t('tr.emailInvalid');
    if (!PHONE_RE.test(f.phone.trim())) err.phone = t('tr.phoneInvalid');
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    setServerError('');
    try {
      await api(`/public/training/courses/${courseId}/register`, { method: 'POST', body: { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), organization: f.organization.trim() } });
      setDone(true);
      onDone?.();
    } catch (e2: any) { setServerError(e2.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={close} title={`${t('tr.regTitle')}: ${courseName}`}>
      {done ? (
        <div className="space-y-4 text-center">
          <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{t('tr.regDone')}</p>
          <Button type="button" onClick={close}>{t('app.close')}</Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3">
          <Field label={t('tr.fullName')} error={errors.name}><input className={inputCls} maxLength={150} autoComplete="name" aria-invalid={!!errors.name} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label={t('contact.email')} error={errors.email}><input type="email" dir="ltr" className={inputCls} maxLength={190} autoComplete="email" aria-invalid={!!errors.email} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label={t('site.phone')} error={errors.phone}><input type="tel" dir="ltr" className={inputCls} maxLength={30} autoComplete="tel" aria-invalid={!!errors.phone} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label={t('tr.org')}><input className={inputCls} maxLength={150} autoComplete="organization" value={f.organization} onChange={(e) => set('organization', e.target.value)} /></Field>
          {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{t('app.cancel')}</Button><Button disabled={busy}>{t('tr.send')}</Button></div>
        </form>
      )}
    </Modal>
  );
}
