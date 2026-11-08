'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { ContactSection } from '@/components/site/home-sections';
import { useSite } from '@/components/site/site-context';

/** Contact us as a page of its own (it used to be a section of the home page): details, the message form and the map. */
export default function ContactPage() {
  const { t, href } = useI18n();
  const { s } = useSite();
  const map = String(s('contact', 'map_url') ?? '');
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="breadcrumb" className="mb-4 text-sm text-gray-500"><Link href={href('/')} className="hover:text-primary">{t('site.home')}</Link><span className="mx-1.5">›</span><span className="text-ink">{t('contact.title')}</span></nav>
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-secondary md:text-3xl">{t('contact.title')}</h1>
        <p className="mt-2 text-sm text-gray-600">{t('ct.subtitle')}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
      </header>
      <ContactSection />
      {map && (
        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
          <h2 className="border-b border-line px-5 py-3 text-sm font-bold text-secondary">{t('ct.map')}</h2>
          <iframe src={map} title={t('site.map')} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-[22rem] w-full border-0" />
        </section>
      )}
    </div>
  );
}
