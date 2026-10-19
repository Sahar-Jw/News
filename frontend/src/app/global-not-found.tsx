'use client';

import './globals.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource-variable/readex-pro/index.css';
import { usePathname } from 'next/navigation';
import { NotFoundContent } from '@/components/site/not-found-content';

/**
 * Global 404 (experimental.globalNotFound). This project has several root layouts ((root) and [lang]) and no
 * app/layout.tsx, so a plain app/not-found.tsx fails with "not-found.tsx doesn't have a root layout".
 * This file is rendered without any layout, so it provides <html> and <body> itself. Unknown URLs such as /ar/l/ end up here.
 */
export default function NotFound() {
  const pathname = usePathname();
  const lang = pathname?.split('/')[1] === 'en' ? 'en' : 'ar';
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <NotFoundContent lang={lang} />
      </body>
    </html>
  );
}
