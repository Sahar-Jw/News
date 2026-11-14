'use client';
import { usePathname } from 'next/navigation';
import { ExpoNotFound } from '@/components/site/expo-states';

export default function ExpoNotFoundPage() {
  const lang = usePathname()?.split('/')[1] === 'en' ? 'en' : 'ar';
  return <ExpoNotFound lang={lang} />;
}
