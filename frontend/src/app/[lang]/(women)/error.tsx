'use client';
import { usePathname } from 'next/navigation';
import { WomenError } from '@/components/women/women-states';

export default function WomenErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = usePathname()?.split('/')[1] === 'en' ? 'en' : 'ar';
  return <WomenError lang={lang} onRetry={reset} />;
}
