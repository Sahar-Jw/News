'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { NewsletterTopics } from './newsletter-topics';
import { saveSubscription } from './subscription-device';

interface Prefs { email: string; isActive: boolean; topics: string[] }

/**
 * The subscriber's own panel: the topics (save), unsubscribe, and subscribe again. Used by the e-mail link page and by /subscribe.
 * `onForget` (only on /subscribe) adds "not you? forget this browser"; `onBad` tells /subscribe that the remembered key no longer works.
 */
export function SubscriptionManager({ token, onForget, onBad }: { token: string; onForget?: () => void; onBad?: () => void }) {
  const { t, href } = useI18n();
  const [state, setState] = useState<'busy' | 'ready' | 'bad'>('busy');
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!/^[a-f0-9]{48}$/.test(token)) { setState('bad'); onBad?.(); return; }
    api<Prefs>('/public/subscribe/preferences', { method: 'POST', body: { token } })
      .then((r) => { setPrefs(r); setTopics(r.topics); setState('ready'); saveSubscription(token); })
      .catch(() => { setState('bad'); onBad?.(); });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (topics.length === 0) { setMsg({ ok: false, text: t('sub.noneChosen') }); return; }
    setSaving(true); setMsg(null);
    try {
      const r = await api<Prefs>('/public/subscribe/preferences/save', { method: 'POST', body: { token, topics } });
      setPrefs(r); setTopics(r.topics); setMsg({ ok: true, text: t('sub.saved') });
    } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setSaving(false); }
  };

  const unsubscribe = async () => {
    setSaving(true); setMsg(null);
    try {
      await api('/public/subscribe/unsubscribe', { method: 'POST', body: { token } });
      setPrefs((p) => (p ? { ...p, isActive: false } : p)); setMsg({ ok: true, text: t('sub.unsubOk') });
    } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setSaving(false); }
  };

  if (state === 'busy') return <div className="mx-auto max-w-lg px-4 py-16 text-center"><Spinner /></div>;
  if (state === 'bad' || !prefs) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-bold text-red-600">{t('sub.linkInvalid')}</p>
        <Link href={href('/')} className="mt-6 inline-block text-sm text-primary">← {t('sub.home')}</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-extrabold text-secondary">{t('sub.manageTitle')}</h1>
      <p className="mt-1 text-sm text-gray-600" dir="ltr">{prefs.email}</p>
      {!prefs.isActive && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('sub.off')}</p>}
      <h2 className="mb-3 mt-6 text-sm font-semibold">{t('sub.topics')}</h2>
      <NewsletterTopics value={topics} onChange={(v) => { setTopics(v); setMsg(null); }} />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" disabled={saving} onClick={save} className="h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60">{t('sub.save')}</button>
        {prefs.isActive && <button type="button" disabled={saving} onClick={unsubscribe} className="h-11 rounded-xl border border-red-300 px-6 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60">{t('sub.unsubscribe')}</button>}
      </div>
      {onForget && <button type="button" onClick={onForget} className="mt-4 text-xs text-gray-500 underline">{t('sub.notYou')}</button>}
      <p role="status" aria-live="polite" className={`mt-3 text-sm ${msg?.ok ? 'text-emerald-700' : 'text-red-600'}`}>{msg?.text ?? ''}</p>
      <Link href={href('/')} className="mt-8 inline-block text-sm text-primary">← {t('sub.home')}</Link>
    </div>
  );
}

function Prefs() {
  const token = useSearchParams().get('token') ?? '';
  return <SubscriptionManager token={token} />;
}

/** Landing page of "Choose topics" in the newsletter e-mails: pick the topics, save, or unsubscribe. */
export function SubscribePreferences() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Prefs /></Suspense>;
}
