'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls, PasswordInput } from '@/components/ui/ui';

/** Not linked from the public navigation (SRS FR-AUTH-001) – reached by URL only. */
export default function LoginPage() {
  const { t, href } = useI18n();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await login(email, password);
      // Everyone lands on the normal site; the navbar shows what this user is allowed to do.
      router.push(href('/'));
    } catch (e: any) {
      setErr(e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{t('auth.login')}</h1>
        {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        <Field label={t('auth.email')}><input type="email" required dir="ltr" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
        <Field label={t('auth.password')}><PasswordInput required dir="ltr" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
        <div className="text-end text-sm"><Link href={href('/forgot-password')} className="text-primary">{t('auth.forgot')}</Link></div>
        <Button disabled={busy} className="w-full">{t('auth.login')}</Button>
        <p className="text-center text-sm text-gray-600">{t('auth.noAccount')} <Link href={href('/register')} className="text-primary">{t('auth.register')}</Link></p>
      </form>
    </div>
  );
}
