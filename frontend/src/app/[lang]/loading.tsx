'use client';
import { usePathname } from 'next/navigation';
import { DICT } from '@/lib/dict';
import { brandOf, brandTheme } from '@/lib/branded';
import { PageLoaderOverlay } from '@/components/ui/page-loader';

export default function Loading() {
  // a loading boundary receives no params, so the language (and the brand site, if any) comes from the URL
  const pathname = usePathname();
  const lang = pathname?.split('/')[1] === 'en' ? 'en' : 'ar';
  const label = DICT[lang]['app.loadingPage'];
  const brand = brandOf(pathname);
  // opening EXPO or the Women Business Committee from elsewhere: their header is not loaded yet, so this plain screen wears their colours
  // (never the chamber's loader); once their layout is there, their own loading.tsx takes over
  if (brand) return <div style={brandTheme(brand)}><PageLoaderOverlay label={label} /></div>;
  return <PageLoaderOverlay label={label} />;
}
