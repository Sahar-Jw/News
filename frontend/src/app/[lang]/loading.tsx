'use client';
import { usePathname } from 'next/navigation';
import { DICT } from '@/lib/dict';
import { PageLoaderOverlay } from '@/components/ui/page-loader';

export default function Loading() {
  // a loading boundary receives no params, so the language comes from the URL
  const lang = usePathname()?.split('/')[1] === 'en' ? 'en' : 'ar';
  return <PageLoaderOverlay label={DICT[lang]['app.loadingPage']} />;
}
