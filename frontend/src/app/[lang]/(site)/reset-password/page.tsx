'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Field, PasswordInput, Spinner, inputCls } from '@/components/ui/ui';

function Reset() {
  const { t, href } = useI18n();
  const token = useSearchParams().get('token') ?? '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const tokenOk = /^[a-f0-9]{64}$/.test(token);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) return setErr(t('auth.passwordShort'));
    if (pw !== pw2) return setErr(t('auth.passwordMismatch'));
    setBusy(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password: pw } });
      setDone(true);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{t('auth.resetTitle')}</h1>
        {done ? (
          <div className="rounded bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{t('auth.resetOk')}</div>
        ) : !tokenOk ? (
          <div className="rounded bg-red-50 p-3 text-sm text-red-700">{t('auth.resetBad')}</div>
        ) : (
          <>
            {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}
            <Field label={t('auth.newPassword')}><PasswordInput required dir="ltr" minLength={8} maxLength={72} className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
            <Field label={t('auth.confirmPassword')}><PasswordInput required dir="ltr" minLength={8} maxLength={72} className={inputCls} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
            <Button disabled={busy} className="w-full">{t('auth.resetButton')}</Button>
          </>
        )}
        <p className="text-center text-sm">
          {done ? <Link href={href('/login')} className="text-primary">{t('auth.login')} →</Link> : <Link href={href('/forgot-password')} className="text-primary">{t('auth.forgot')}</Link>}
        </p>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Reset /></Suspense>;
}
