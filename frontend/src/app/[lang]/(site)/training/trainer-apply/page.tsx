'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { TrainerApplyForm } from '@/components/site/trainer-apply';

/** Register as a trainer: /training/trainer-apply */
export default function TrainerApplyPage() {
  const { t, href } = useI18n();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href={href('/training')} className="inline-block text-sm text-primary hover:underline">{t('tr.back')}</Link>
      <header className="text-center">
        <h1 className="text-2xl font-extrabold text-secondary md:text-3xl">{t('tr.ta.title')}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">{t('tr.ta.subtitle')}</p>
      </header>
      <TrainerApplyForm />
    </div>
  );
}
