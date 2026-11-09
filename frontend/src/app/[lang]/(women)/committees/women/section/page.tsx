'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CommitteeView } from '@/components/site/committee-view';
import { Center, Spinner } from '@/components/ui/ui';

function WomenSection() {
  const slug = useSearchParams().get('slug') ?? '';
  if (!slug) return <Center>Page not found</Center>;
  return <CommitteeView path="/public/committees/women" womenPage={slug} />;
}

export default function WomenSectionPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><WomenSection /></Suspense>;
}
