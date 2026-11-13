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
import { UploadProgress } from '@/components/ui/upload-progress';
import { NavigationLoader } from '@/components/site/navigation-loader';
import { INTRO_BOOT_SCRIPT, THEME_BOOT_SCRIPT } from '@/lib/theme';
import { PageLoaderOverlay } from '@/components/ui/page-loader';
import { IntroSplash } from '@/components/site/intro-splash';

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
        {/* backend URL from the container's environment; must run before any bundle */}
        <script src="/runtime-config.js" />
        {/* applies the last saved brand colours before the first paint, so the default colours never flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/* choose open vs refresh synchronously, before any page content can paint */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT_SCRIPT }} />
      </head>
      <body>
        <div id="intro-boot-cover" aria-hidden="true" />
        {/* brand-color intro cover is enabled synchronously on every open of the site, never on a refresh */}
        <div id="boot-loader" aria-hidden="true"><PageLoaderOverlay /></div>
        <I18nProvider lang={l}>
          <AuthProvider>
            <ToastProvider>
              {/* opening animation with the configured site logo */}
              <IntroSplash />
              <Suspense fallback={null}><NavigationLoader /></Suspense>
              {children}
              <UploadProgress />
            </ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
