'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';

/** Asks for the account e-mail and sends a reset link. The answer is the same whether or not the e-mail exists. */
export default function ForgotPasswordPage() {
  const { t, href, lang } = useI18n();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email: email.trim(), lang } });
      setMsg(r.message);
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{t('auth.forgotTitle')}</h1>
        {msg ? (
          <div className="rounded bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{msg}</div>
        ) : (
          <>
            <p className="text-sm text-gray-600">{t('auth.forgotHint')}</p>
            {err && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{err}</div>}
            <Field label={t('auth.email')}><input type="email" required dir="ltr" maxLength={190} className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></Field>
            <Button disabled={busy} className="w-full">{t('auth.sendLink')}</Button>
          </>
        )}
        <p className="text-center text-sm"><Link href={href('/login')} className="text-primary">← {t('auth.backToLogin')}</Link></p>
      </form>
    </div>
  );
}
