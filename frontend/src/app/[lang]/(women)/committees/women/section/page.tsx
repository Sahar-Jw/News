'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CommitteeView } from '@/components/site/committee-view';
import { useI18n } from '@/lib/i18n';
import { WomenLoader, WomenNotFound } from '@/components/women/women-states';

function SectionLoader() {
  const { lang } = useI18n();
  return <WomenLoader lang={lang} />;
}

function WomenSection() {
  const slug = useSearchParams().get('slug') ?? '';
  const { lang } = useI18n();
  if (!slug) return <WomenNotFound lang={lang} />;
  return <CommitteeView path="/public/committees/women" womenPage={slug} />;
}

export default function WomenSectionPage() {
  return <Suspense fallback={<SectionLoader />}><WomenSection /></Suspense>;
}
