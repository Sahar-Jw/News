'use client';
import { usePathname } from 'next/navigation';
import { WomenLoader } from '@/components/women/women-states';

/** Shown inside the women layout (header and footer stay) while a women page loads. */
export default function WomenLoading() {
  const lang = usePathname()?.split('/')[1] === 'en' ? 'en' : 'ar';
  return <WomenLoader lang={lang} />;
}
