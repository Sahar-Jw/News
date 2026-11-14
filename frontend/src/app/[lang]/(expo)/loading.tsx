'use client';
import { usePathname } from 'next/navigation';
import { ExpoLoader } from '@/components/site/expo-states';

/** Shown inside the EXPO layout (its header and footer stay) while an EXPO page loads, instead of the chamber's loader. */
export default function ExpoLoading() {
  const lang = usePathname()?.split('/')[1] === 'en' ? 'en' : 'ar';
  return <ExpoLoader lang={lang} />;
}
