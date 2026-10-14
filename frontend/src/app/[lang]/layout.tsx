import '../globals.css';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import { notFound } from 'next/navigation';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/lib/i18n';
import { LANGS, type Lang } from '@/lib/utils';
import { ToastProvider } from '@/components/ui/toast';

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
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
