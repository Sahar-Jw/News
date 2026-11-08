'use client';
import { CommitteeView } from '@/components/site/committee-view';

/** Women Business Committee page, rendered inside its own branded site shell. */
export default function WomenCommitteePage() {
  return <CommitteeView path="/public/committees/women" />;
}
