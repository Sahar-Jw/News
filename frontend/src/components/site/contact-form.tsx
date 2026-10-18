'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

type Values = { name: string; email: string; subject: string; message: string };
type Errors = Partial<Record<keyof Values, string>>;
const EMPTY: Values = { name: '', email: '', subject: '', message: '' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ContactForm() {
  const { t } = useI18n();
  const toast = useToast();
  const [f, setF] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({});
  const [busy, setBusy] = useState(false);

  /** Same limits as the API (CreateContactDto), with a message in the current language. */
  const check = (v: Values): Errors => {
    const e: Errors = {};
    const name = v.name.trim(), email = v.email.trim(), subject = v.subject.trim(), message = v.message.trim();
    if (!name) e.name = t('contact.err.nameRequired');
    else if (name.length < 2) e.name = t('contact.err.nameMin');
    else if (name.length > 150) e.name = t('contact.err.nameMax');
    if (!email) e.email = t('contact.err.emailRequired');
    else if (email.length > 190) e.email = t('contact.err.emailMax');
    else if (!EMAIL_RE.test(email)) e.email = t('contact.err.emailInvalid');
    if (!subject) e.subject = t('contact.err.subjectRequired');
    else if (subject.length < 2) e.subject = t('contact.err.subjectMin');
    else if (subject.length > 255) e.subject = t('contact.err.subjectMax');
    if (!message) e.message = t('contact.err.messageRequired');
    else if (message.length < 5) e.message = t('contact.err.messageMin');
    else if (message.length > 5000) e.message = t('contact.err.messageMax');
    return e;
  };

  const set = (k: keyof Values) => (e: React.ChangeEvent<any>) => {
    const next = { ...f, [k]: e.target.value };
    setF(next);
    if (touched[k]) setErrors((s) => ({ ...s, [k]: check(next)[k] }));
  };
  const blur = (k: keyof Values) => () => {
    setTouched((s) => ({ ...s, [k]: true }));
    setErrors((s) => ({ ...s, [k]: check(f)[k] }));
  };
  const cls = (k: keyof Values) => `${inputCls} ${errors[k] ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = check(f);
    setErrors(found);
    setTouched({ name: true, email: true, subject: true, message: true });
    if (Object.keys(found).length) {
      document.querySelector<HTMLElement>('[data-contact-form] [aria-invalid="true"]')?.focus();
      return;
    }
    setBusy(true);
    try {
      await api('/public/contact', { method: 'POST', body: { name: f.name.trim(), email: f.email.trim(), subject: f.subject.trim(), message: f.message.trim() } });
      toast(t('contact.ok'));
      setF(EMPTY);
      setErrors({});
      setTouched({});
    } catch (err: any) {
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} noValidate data-contact-form className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('contact.name')} error={errors.name}><input aria-invalid={!!errors.name} className={cls('name')} value={f.name} onChange={set('name')} onBlur={blur('name')} /></Field>
        <Field label={t('contact.email')} error={errors.email}><input type="email" aria-invalid={!!errors.email} className={cls('email')} value={f.email} onChange={set('email')} onBlur={blur('email')} dir="ltr" /></Field>
      </div>
      <Field label={t('contact.subject')} error={errors.subject}><input aria-invalid={!!errors.subject} className={cls('subject')} value={f.subject} onChange={set('subject')} onBlur={blur('subject')} /></Field>
      <Field label={t('contact.message')} error={errors.message}><textarea rows={5} aria-invalid={!!errors.message} className={cls('message')} value={f.message} onChange={set('message')} onBlur={blur('message')} /></Field>
      <Button disabled={busy}>{busy ? t('app.sending') : t('contact.send')}</Button>
    </form>
  );
}
