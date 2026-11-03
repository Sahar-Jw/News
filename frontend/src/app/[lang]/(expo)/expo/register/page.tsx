'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { APPLICATION_KINDS, ApplyForm, Heading, useExpoData, useExpoInfo } from '@/components/site/expo-shared';

type Kind = (typeof APPLICATION_KINDS)[number];

function Register() {
  const { t } = useI18n();
  const x = useExpoInfo();
  const data = useExpoData();
  const q = useSearchParams().get('kind');
  const [kind, setKind] = useState<Kind>('exhibitor');
  useEffect(() => { if (q && (APPLICATION_KINDS as readonly string[]).includes(q)) setKind(q as Kind); }, [q]);
  const tab = (k: Kind) => `rounded-full px-5 py-2.5 text-sm font-bold transition ${kind === k ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'}`;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Heading sub={t('ex.registerSub')}>{t('ex.register')}</Heading>
      <div className="mb-6 flex flex-wrap justify-center gap-2" role="tablist">
        {(['exhibitor', 'visitor', 'info'] as Kind[]).map((k) => <button key={k} type="button" role="tab" aria-selected={kind === k} className={tab(k)} onClick={() => setKind(k)}>{t(`ex.kind.${k}`)}</button>)}
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-line">
        {!x.registerOpen && kind !== 'info' ? <p className="text-center text-sm font-semibold text-gray-600">{t('ex.regClosed')}</p> : <ApplyForm kind={kind} sectors={data?.sectors ?? []} />}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Register /></Suspense>;
}
