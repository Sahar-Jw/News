'use client';

import { usePathname } from 'next/navigation';
import { NotFoundContent } from '@/components/site/not-found-content';

export default function NotFound() {
  const pathname = usePathname();
  const lang = pathname?.split('/')[1] === 'en' ? 'en' : 'ar';
  return <NotFoundContent lang={lang} />;
}
