'use client';

import './globals.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource-variable/readex-pro/index.css';
import { useEffect, useState } from 'react';
import { NotFoundContent } from '@/components/site/not-found-content';
import { WomenNotFound } from '@/components/women/women-states';
import { ExpoNotFound } from '@/components/site/expo-states';
import { brandOf, brandTheme } from '@/lib/branded';

/**
 * Global 404 (experimental.globalNotFound). This project has several root layouts ((root) and [lang]) and no
 * app/layout.tsx, so a plain app/not-found.tsx fails with "not-found.tsx doesn't have a root layout".
 * This file is rendered without any layout, so it provides <html> and <body> itself. Unknown URLs such as /ar/l/ end up here.
 */
export default function NotFound() {
  // 404.html is prerendered once at build time (Arabic) and then served for EVERY unknown URL, so the language can only
  // be read from the real address in the browser. Start with the prerendered value (no hydration mismatch), then switch.
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [brand, setBrand] = useState<'expo' | 'women' | null>(null);
  useEffect(() => {
    setLang(window.location.pathname.split('/')[1] === 'en' ? 'en' : 'ar');
    setBrand(brandOf(window.location.pathname));
  }, []);
  // under /committees/women and /expo the 404 wears that site's default colours (the site settings are not loaded here)
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body>
        {brand ? <div style={brandTheme(brand)} className="min-h-screen bg-canvas text-ink">{brand === 'expo' ? <ExpoNotFound lang={lang} /> : <WomenNotFound lang={lang} />}</div> : <NotFoundContent lang={lang} />}
      </body>
    </html>
  );
}
