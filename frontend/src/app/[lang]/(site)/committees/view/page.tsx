'use client';
import { useRecordId } from '@/lib/use-record-id';
import { Suspense } from 'react';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { NotFoundContent } from '@/components/site/not-found-content';
import { CommitteeView } from '@/components/site/committee-view';

/** One committee: /committees/3 */
function View() {
  const { lang } = useI18n();
  const id = useRecordId('id');
  if (!id) return <NotFoundContent lang={lang} />;
  return <CommitteeView path={`/public/committees/${encodeURIComponent(id)}`} />;
}

export default function CommitteePage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><View /></Suspense>;
}
