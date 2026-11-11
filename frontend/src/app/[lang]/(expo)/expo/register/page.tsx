'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { APPLICATION_KINDS, ApplyForm, FloorPlanMap, Heading, useExpoData, useExpoInfo } from '@/components/site/expo-shared';

type Kind = (typeof APPLICATION_KINDS)[number];
type Tab = Kind | 'plan';

/** Registration and participation: exhibitor request, visitor registration, information request, and the floor plan (with the interactive stand map when available). */
function Register() {
  const { t, lang } = useI18n();
  const ar = lang === 'ar';
  const x = useExpoInfo();
  const data = useExpoData();
  const q = useSearchParams().get('kind');
  const [tab, setTab] = useState<Tab>('exhibitor');
  useEffect(() => { if (q && ([...APPLICATION_KINDS, 'plan'] as string[]).includes(q)) setTab(q as Tab); }, [q]);
  const hasPlan = !!(x.floorPlanImage || x.floorPlan);
  const btn = (k: Tab) => `rounded-full px-5 py-2.5 text-sm font-bold transition ${tab === k ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'}`;
  const tabs: Tab[] = ['exhibitor', 'visitor', 'info', ...(hasPlan ? ['plan' as const] : [])];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Heading sub={x.L('register_note') || t('ex.registerSub')}>{ar ? 'التسجيل والمشاركة' : 'Registration & participation'}</Heading>
      <div className="mb-6 flex flex-wrap justify-center gap-2" role="tablist">
        {tabs.map((k) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={btn(k)} onClick={() => setTab(k)}>{k === 'plan' ? (ar ? 'مخطط المعرض' : 'Floor plan') : t(`ex.kind.${k}`)}</button>)}
      </div>
      {tab === 'plan' ? (
        !data ? <Center><Spinner /></Center> : (
          <div className="space-y-4">
            {x.floorPlanImage && <FloorPlanMap image={x.floorPlanImage} exhibitors={data.exhibitors} />}
            {x.floorPlan && <div className="whitespace-pre-line rounded-2xl bg-white p-6 text-sm leading-7 text-gray-700 shadow-card ring-1 ring-line">{x.floorPlan}</div>}
          </div>
        )
      ) : (
        <div className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-line">
          {!x.registerOpen && tab !== 'info' ? <p className="text-center text-sm font-semibold text-gray-600">{t('ex.regClosed')}</p> : <ApplyForm kind={tab} sectors={data?.sectors ?? []} />}
        </div>
      )}
    </div>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Register /></Suspense>;
}
