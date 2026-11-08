'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { SiteProvider, useSite } from '@/components/site/site-context';
import { useExpoInfo } from '@/components/site/expo-shared';
import { BackToTop } from '@/components/site/shell';
import { fmtDay } from '@/lib/utils';

const HEX = /^#[0-9a-f]{6}$/i;

/** DCC EXPO has its own identity (purple + gold by default, editable in Settings → expo): the chamber colours are overridden for this subtree only. */
function Chrome({ children }: { children: React.ReactNode }) {
  const { lang, t, href, otherLangHref } = useI18n();
  const pathname = usePathname();
  const x = useExpoInfo();
  const [open, setOpen] = useState(false);
  const { s } = useSite();
  const c1 = String(s('expo', 'primary_color') ?? '');
  const c2 = String(s('expo', 'accent_color') ?? '');
  const c3 = String(s('expo', 'header_color') ?? '');
  const c4 = String(s('expo', 'footer_color') ?? '');
  const c5 = String(s('expo', 'background_color') ?? '');
  const c6 = String(s('expo', 'text_color') ?? '');
  const primary = HEX.test(c1) ? c1 : '#4b1d7a';
  const accent = HEX.test(c2) ? c2 : '#c9a227';
  const header = HEX.test(c3) ? c3 : `color-mix(in srgb, ${primary} 70%, black)`;
  const footer = HEX.test(c4) ? c4 : header;
  const canvas = HEX.test(c5) ? c5 : '#faf8fc';
  const text = HEX.test(c6) ? c6 : '#1f2937';
  const theme = { '--primary': primary, '--secondary': header, '--accent': accent, '--canvas': canvas, '--ink': text, '--expo-footer': footer } as React.CSSProperties;
  const active = (to: string) => !to.includes('#') && (to === '/expo' ? /\/expo\/?$/.test(pathname) : pathname.includes(to));

  return (
    <div style={theme} className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-40 bg-secondary text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href={href('/expo')} className="flex items-center gap-3">
            {x.logo ? <img src={x.logo} alt="" className="h-10 w-10 rounded-full bg-white object-contain p-0.5" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-accent font-extrabold text-secondary">E</span>}
            <span className="text-lg font-extrabold tracking-wide">{x.name}</span>
          </Link>
          <nav aria-label="EXPO" className="hidden items-center gap-1 lg:flex">
            {x.pageLinks.navigation.map((link, index) => <Link key={`${link.href}-${index}`} href={href(link.href)} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition hover:bg-white/15 ${active(link.href) ? 'bg-white/15 text-accent' : 'text-white/90'}`}>{(lang === 'ar' ? link.labelAr : link.labelEn) || link.labelAr || link.labelEn}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={href('/')} title={t('ex.backToChamber')} className="hidden items-center gap-1 rounded-full border border-white/40 px-3 py-1.5 text-xs font-bold transition hover:bg-white/15 md:inline-flex"><span aria-hidden="true" className="rtl:rotate-180">←</span>{t('ex.backToChamber')}</Link>
            {x.registerOpen && <Link href={href('/expo/register')} className="hidden rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-secondary shadow transition hover:brightness-110 sm:inline-block">{t('ex.registerExhibitor')}</Link>}
            <Link href={otherLangHref(pathname)} onClick={() => { try { localStorage.setItem('lang', lang === 'ar' ? 'en' : 'ar'); } catch {} }} className="rounded-full border border-white/30 px-3 py-1.5 text-xs font-bold hover:bg-white/15">{t('site.language')}</Link>
            <button type="button" aria-label="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-lg border border-white/30 px-2.5 py-1.5 text-lg leading-none lg:hidden">☰</button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-white/15 px-4 pb-3 lg:hidden" onClick={() => setOpen(false)}>
            {x.pageLinks.navigation.map((link, index) => <Link key={`${link.href}-${index}`} href={href(link.href)} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10">{(lang === 'ar' ? link.labelAr : link.labelEn) || link.labelAr || link.labelEn}</Link>)}
            <Link href={href('/')} className="mt-1 block rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold hover:bg-white/10">← {t('ex.backToChamber')}</Link>
            {x.registerOpen && <Link href={href('/expo/register')} className="mt-2 block rounded-full bg-accent px-4 py-2 text-center text-sm font-extrabold text-secondary">{t('ex.registerExhibitor')}</Link>}
          </nav>
        )}
      </header>
      <main className="min-h-[60vh] min-w-0">{children}</main>
      <footer className="mt-12 text-white/90" style={{ backgroundColor: 'var(--expo-footer)' }}>
        <div className="h-1 bg-gradient-to-r from-accent via-primary to-transparent" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm sm:grid-cols-3">
          <div><div className="text-lg font-extrabold text-white">{x.name}</div><p className="mt-2 leading-7 text-white/75">{x.tagline}</p></div>
          <div className="space-y-1.5">
            {x.footerText && <p className="mb-2 leading-7 text-white/75">{x.footerText}</p>}
            {x.start && <div>📅 {fmtDay(lang, x.start)}{x.end && x.end !== x.start ? ` — ${fmtDay(lang, x.end)}` : ''}</div>}
            {x.venue && <div>📍 {x.venue}</div>}
            {x.phone && <div>☎ <bdi dir="ltr">{x.phone}</bdi></div>}
            {x.email && <div>✉ <bdi dir="ltr">{x.email}</bdi></div>}
          </div>
          <div className="space-y-1.5">
            <Link href={href('/')} className="block text-accent hover:underline">← {t('ex.backToChamber')}</Link>
            {x.pageLinks.footer.map((link, index) => <Link key={`${link.href}-${index}`} href={href(link.href)} className="block hover:text-accent">{(lang === 'ar' ? link.labelAr : link.labelEn) || link.labelAr || link.labelEn}</Link>)}
          </div>
        </div>
      </footer>
      <BackToTop />
    </div>
  );
}

export default function ExpoLayout({ children }: { children: React.ReactNode }) {
  return <SiteProvider><Chrome>{children}</Chrome></SiteProvider>;
}
