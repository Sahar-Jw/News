'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

export function ContactForm() {
  const { t } = useI18n();
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/public/contact', { method: 'POST', body: f });
      toast(t('contact.ok'));
      setF({ name: '', email: '', subject: '', message: '' });
    } catch (err: any) {
      toast(err.message, 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('contact.name')}><input required minLength={2} maxLength={150} className={inputCls} value={f.name} onChange={set('name')} /></Field>
        <Field label={t('contact.email')}><input required type="email" className={inputCls} value={f.email} onChange={set('email')} dir="ltr" /></Field>
      </div>
      <Field label={t('contact.subject')}><input required minLength={2} maxLength={255} className={inputCls} value={f.subject} onChange={set('subject')} /></Field>
      <Field label={t('contact.message')}><textarea required minLength={5} maxLength={5000} rows={5} className={inputCls} value={f.message} onChange={set('message')} /></Field>
      <Button disabled={busy}>{busy ? t('app.sending') : t('contact.send')}</Button>
    </form>
  );
}
