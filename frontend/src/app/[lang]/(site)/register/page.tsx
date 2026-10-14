'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';

export default function RegisterPage() {
  const { t, href } = useI18n();
  const [f, setF] = useState({ fullName: '', email: '', password: '', phone: '' });
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await api('/auth/register', { method: 'POST', body: { ...f, phone: f.phone || undefined } });
      setDone(true);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (done) return <div className="mx-auto max-w-md px-4 py-12"><div className="rounded-xl border bg-white p-6 text-center shadow-sm"><p className="mb-4">{t('auth.registered')}</p><Link className="text-primary" href={href('/')}>{t('site.home')}</Link></div></div>;
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{t('auth.register')}</h1>
        {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <Field label={t('auth.fullName')}><input required minLength={2} className={inputCls} value={f.fullName} onChange={set('fullName')} /></Field>
        <Field label={t('auth.email')}><input type="email" required dir="ltr" className={inputCls} value={f.email} onChange={set('email')} /></Field>
        <Field label={t('auth.phone')}><input dir="ltr" className={inputCls} value={f.phone} onChange={set('phone')} /></Field>
        <Field label={t('auth.password')} hint="8+"><input type="password" required minLength={8} maxLength={72} dir="ltr" className={inputCls} value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <Button disabled={busy} className="w-full">{t('auth.register')}</Button>
        <p className="text-center text-sm text-gray-600">{t('auth.haveAccount')} <Link href={href('/login')} className="text-primary">{t('auth.login')}</Link></p>
      </form>
    </div>
  );
}
