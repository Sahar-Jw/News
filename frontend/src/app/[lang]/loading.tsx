'use client';
import { usePathname } from 'next/navigation';
import { DICT } from '@/lib/dict';
import { PageSkeletonOverlay } from '@/components/ui/page-skeleton';

export default function Loading() {
  // a loading boundary receives no params, so the language comes from the URL
  const lang = usePathname()?.split('/')[1] === 'en' ? 'en' : 'ar';
  return <PageSkeletonOverlay label={DICT[lang]['app.loadingPage']} />;
}
