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

export const dynamicParams = false;
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!LANGS.includes(lang as Lang)) notFound();
  const l = lang as Lang;
  return (
    <html lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'}>
      <body>
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
