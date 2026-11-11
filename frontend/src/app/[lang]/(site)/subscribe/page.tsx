'use client';
import { useI18n } from '@/lib/i18n';
import { SubscribeSection } from '@/components/site/subscribe-section';

/** /subscribe: the newsletter page (the "Newsletter" menu / quick link points here). */
export default function SubscribePage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <h1 className="text-3xl font-extrabold text-secondary">{t('sub.pageTitle')}</h1>
      <p className="mx-auto mb-8 mt-3 max-w-xl text-sm leading-7 text-gray-600">{t('sub.pageText')}</p>
      <SubscribeSection showTopics />
    </div>
  );
}
