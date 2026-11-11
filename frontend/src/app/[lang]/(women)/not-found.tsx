'use client';
import { usePathname } from 'next/navigation';
import { WomenNotFound } from '@/components/women/women-states';

export default function WomenNotFoundPage() {
  const lang = usePathname()?.split('/')[1] === 'en' ? 'en' : 'ar';
  return <WomenNotFound lang={lang} />;
}
