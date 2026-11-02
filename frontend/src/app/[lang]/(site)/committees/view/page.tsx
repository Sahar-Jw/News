'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { NotFoundContent } from '@/components/site/not-found-content';
import { CommitteeView } from '@/components/site/committee-view';

/** One committee: /committees/view?id=3 */
function View() {
  const { lang } = useI18n();
  const id = useSearchParams().get('id');
  if (!id) return <NotFoundContent lang={lang} />;
  return <CommitteeView path={`/public/committees/${encodeURIComponent(id)}`} />;
}

export default function CommitteePage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><View /></Suspense>;
}
