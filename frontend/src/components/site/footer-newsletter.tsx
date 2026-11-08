'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Compact newsletter box for the footer (same API as the home subscribe section). */
export function FooterNewsletter() {
  const { t, lang } = useI18n();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL_RE.test(v) || v.length > 190) { setState('error'); setMsg(t('sub.invalid')); return; }
    setState('busy');
    try {
      const r = await api<{ message: string }>('/public/subscribe', { method: 'POST', body: { email: v, lang } });
      setState('done'); setMsg(r.message); setEmail('');
    } catch (err: any) { setState('error'); setMsg(err.message); }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex gap-1.5">
        <input
          type="email" dir="ltr" autoComplete="email" maxLength={190} required value={email}
          onChange={(e) => { setEmail(e.target.value); if (state !== 'busy') setState('idle'); }}
          placeholder={t('sub.placeholder')} aria-label={t('sub.placeholder')} aria-invalid={state === 'error'}
          className="h-9 min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-3 text-xs text-white outline-none transition placeholder:text-stone-400 focus:border-accent"
        />
        <button disabled={state === 'busy'} className="h-9 shrink-0 rounded-lg bg-accent px-3 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-60">{state === 'busy' ? t('sub.sending') : t('sub.button')}</button>
      </div>
      {state !== 'idle' && state !== 'busy' && <p role="status" className={`mt-1.5 text-xs ${state === 'done' ? 'text-emerald-300' : 'text-red-300'}`}>{msg}</p>}
    </form>
  );
}
