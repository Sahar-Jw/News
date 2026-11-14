'use client';
import { usePathname } from 'next/navigation';
import { ExpoError } from '@/components/site/expo-states';

export default function ExpoErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = usePathname()?.split('/')[1] === 'en' ? 'en' : 'ar';
  return <ExpoError lang={lang} onRetry={reset} />;
}
