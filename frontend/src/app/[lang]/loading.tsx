'use client';
import { usePathname } from 'next/navigation';
import { DICT } from '@/lib/dict';

export default function Loading() {
  // a loading boundary receives no params, so the language comes from the URL
  const lang = usePathname()?.split('/')[1] === 'en' ? 'en' : 'ar';
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/85 backdrop-blur-sm" role="status" aria-label={DICT[lang]['app.loadingPage']}>
      <span className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden="true" />
    </div>
  );
}
