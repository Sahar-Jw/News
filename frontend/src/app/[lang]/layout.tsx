import '../globals.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource-variable/readex-pro/index.css';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { LANGS, type Lang } from '@/lib/utils';
import { ToastProvider } from '@/components/ui/toast';
import { NavigationLoader } from '@/components/site/navigation-loader';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';
import { PageSkeletonOverlay } from '@/components/ui/page-skeleton';

export const dynamicParams = false;
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  const l = lang as Lang;
  return (
    // suppressHydrationWarning: the boot script below adds the remembered colours to <html style> before React starts
    <html lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        {/* applies the last saved brand colours before the first paint, so the default colours never flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        {/* first visit ever only: shown (by CSS) while the colours are still unknown, so nobody sees an empty page */}
        <div id="boot-skeleton" aria-hidden="true"><PageSkeletonOverlay /></div>
        <I18nProvider lang={l}>
          <AuthProvider>
            <ToastProvider>
              <Suspense fallback={null}><NavigationLoader /></Suspense>
              {children}
            </ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
