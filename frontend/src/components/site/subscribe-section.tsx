'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Reveal } from './motion';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Home section: an e-mail box and a button. Title, small label and subtitle come from Settings (sections_home → subscribe_*). */
export function SubscribeSection() {
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
    } catch (err: any) {
      setState('error'); setMsg(err.message);
    }
  };

  return (
    <Reveal className="mx-auto max-w-xl">
      <form onSubmit={submit} noValidate className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email" dir="ltr" autoComplete="email" maxLength={190} required
          value={email} onChange={(e) => { setEmail(e.target.value); if (state !== 'busy') setState('idle'); }}
          placeholder={t('sub.placeholder')} aria-label={t('sub.placeholder')} aria-invalid={state === 'error'}
          className={`h-12 min-w-0 flex-1 rounded-xl border bg-white px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 ${state === 'error' ? 'border-red-500' : 'border-line'}`}
        />
        <button disabled={state === 'busy'} className="h-12 shrink-0 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm shadow-primary/30 transition hover:brightness-110 active:scale-[0.97] disabled:opacity-60">
          {state === 'busy' ? t('sub.sending') : t('sub.button')}
        </button>
      </form>
      <p role="status" aria-live="polite" className={`mt-3 min-h-6 text-center text-sm ${state === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>{state === 'done' || state === 'error' ? msg : ''}</p>
    </Reveal>
  );
}
