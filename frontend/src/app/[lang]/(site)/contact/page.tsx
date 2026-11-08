'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { ContactSection } from '@/components/site/home-sections';

/** Contact us as a page of its own (it used to be a section of the home page): details, the message form and the map. */
export default function ContactPage() {
  const { t, href } = useI18n();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="breadcrumb" className="mb-4 text-sm text-gray-500"><Link href={href('/')} className="hover:text-primary">{t('site.home')}</Link><span className="mx-1.5">›</span><span className="text-ink">{t('contact.title')}</span></nav>
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-secondary md:text-3xl">{t('contact.title')}</h1>
        <p className="mt-2 text-sm text-gray-600">{t('ct.subtitle')}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
      </header>
      <ContactSection />
    </div>
  );
}
