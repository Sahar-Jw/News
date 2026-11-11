'use client';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { Heading, SponsorTiers, useExpoData } from '@/components/site/expo-shared';

/** Sponsors and partners by tier */
export default function SponsorsPage() {
  const { t, lang } = useI18n();
  const data = useExpoData();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Heading>{t('ex.sponsors')}</Heading>
      {!data ? <Center><Spinner /></Center> : data.sponsors.length === 0 ? <Center>{lang === 'ar' ? 'سيتم الإعلان عن الرعاة والشركاء قريباً' : 'Sponsors and partners will be announced soon'}</Center> : <SponsorTiers sponsors={data.sponsors} />}
    </div>
  );
}
