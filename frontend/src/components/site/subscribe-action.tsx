'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';

function Action({ action }: { action: 'verify' | 'unsubscribe' }) {
  const { t, href } = useI18n();
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'busy' | 'ok' | 'bad'>('busy');

  useEffect(() => {
    if (!/^[a-f0-9]{48}$/.test(token)) { setState('bad'); return; }
    setState('busy');
    api(`/public/subscribe/${action}`, { method: 'POST', body: { token } }).then(() => setState('ok')).catch(() => setState('bad'));
  }, [token, action]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      {state === 'busy' ? <><Spinner /><p className="mt-4 text-sm text-gray-600">{t('sub.verifying')}</p></> : (
        <>
          <p className={`text-lg font-bold ${state === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{state === 'ok' ? t(action === 'verify' ? 'sub.verifiedOk' : 'sub.unsubOk') : t('sub.linkInvalid')}</p>
          <Link href={href('/')} className="mt-6 inline-block text-sm text-primary">← {t('sub.home')}</Link>
        </>
      )}
    </div>
  );
}

/** Landing page of the links in the newsletter e-mails (confirm / unsubscribe). */
export function SubscribeAction({ action }: { action: 'verify' | 'unsubscribe' }) {
  return <Suspense fallback={<Center><Spinner /></Center>}><Action action={action} /></Suspense>;
}
