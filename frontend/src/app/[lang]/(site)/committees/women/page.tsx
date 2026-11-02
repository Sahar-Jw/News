'use client';
import { CommitteeView } from '@/components/site/committee-view';

/** Businesswomen committee: same template as any committee (kind "women"), plus the initiatives tab. */
export default function WomenCommitteePage() {
  return <CommitteeView path="/public/committees/women" />;
}
