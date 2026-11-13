'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Spinner, inputCls } from '@/components/ui/ui';
import { SubscribeSection } from '@/components/site/subscribe-section';
import { SubscriptionManager } from '@/components/site/subscribe-preferences';
import { forgetSubscription, savedSubscription } from '@/components/site/subscription-device';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "Already subscribed? Manage": the private link goes to the e-mail address itself, so nobody can change another person's choices. */
function ManageByEmail() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim();
    if (!EMAIL_RE.test(v) || v.length > 190) { setState('error'); setMsg(t('sub.invalid')); return; }
    setState('busy');
    try { const r = await api<{ message: string }>('/public/subscribe/manage-link', { method: 'POST', body: { email: v, lang } }); setState('done'); setMsg(r.message); }
    catch (err: any) { setState('error'); setMsg(err.message); }
  };
  return (
    <section className="mx-auto mt-10 max-w-xl rounded-2xl bg-white p-5 text-start shadow-card ring-1 ring-line">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 font-bold text-secondary"><span>{t('sub.already')}</span><span aria-hidden="true">{open ? '▾' : '▸'}</span></button>
      {open && (
        <form onSubmit={send} noValidate className="mt-3 space-y-2">
          <p className="text-sm leading-7 text-gray-600">{t('sub.alreadyText')}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="email" dir="ltr" autoComplete="email" maxLength={190} required value={email} onChange={(e) => { setEmail(e.target.value); if (state !== 'busy') setState('idle'); }} placeholder={t('sub.placeholder')} aria-label={t('sub.placeholder')} className={`${inputCls} flex-1`} />
            <button disabled={state === 'busy' || state === 'done'} className="h-11 shrink-0 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60">{state === 'busy' ? t('sub.sending') : t('sub.sendLink')}</button>
          </div>
          <p role="status" aria-live="polite" className={`text-sm ${state === 'done' ? 'text-emerald-700' : 'text-red-600'}`}>{state === 'done' || state === 'error' ? msg : ''}</p>
        </form>
      )}
    </section>
  );
}

/**
 * /subscribe: the newsletter page (the "Newsletter" menu / quick link points here).
 * A subscriber whose browser remembers the subscription (after the confirmation or a "manage" link) sees their own panel: topics, save, unsubscribe.
 * Anyone else sees the subscribe form with the topic choice, and "Already subscribed?" that e-mails the private link.
 */
export default function SubscribePage() {
  const { t } = useI18n();
  const [token, setToken] = useState<string | null>(null); // null = still looking in this browser
  useEffect(() => { setToken(savedSubscription()); }, []);

  if (token === null) return <div className="mx-auto max-w-2xl px-4 py-16 text-center"><Spinner /></div>;
  if (token) return <SubscriptionManager token={token} onForget={() => { forgetSubscription(); setToken(''); }} onBad={() => { forgetSubscription(); setToken(''); }} />;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <h1 className="text-3xl font-extrabold text-secondary">{t('sub.pageTitle')}</h1>
      <p className="mx-auto mb-8 mt-3 max-w-xl text-sm leading-7 text-gray-600">{t('sub.pageText')}</p>
      <SubscribeSection showTopics />
      <ManageByEmail />
    </div>
  );
}
