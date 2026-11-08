'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { SiteProvider, useSite } from '@/components/site/site-context';
import { BackToTop } from '@/components/site/shell';
import { readBrandedPageLinks } from '@/lib/branded-page-links';

const HEX = /^#[0-9a-f]{6}$/i;

function WomenChrome({ children }: { children: React.ReactNode }) {
  const { lang, href, otherLangHref } = useI18n();
  const pathname = usePathname();
  const { s, loc, img } = useSite();
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('about');
  useEffect(() => {
    const sync = () => setActiveSection(window.location.hash.slice(1) || 'about');
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const color = (key: string, fallback: string) => {
    const value = String(s('women', key) ?? '');
    return HEX.test(value) ? value : fallback;
  };
  const primary = color('primary_color', '#8b3d63');
  const accent = color('accent_color', '#d2a84a');
  const header = color('header_color', '#54213d');
  const footer = color('footer_color', '#3c172c');
  const background = color('background_color', '#fff9fb');
  const text = color('text_color', '#34232c');
  const theme = {
    '--primary': primary,
    '--secondary': `color-mix(in srgb, ${primary} 70%, black)`,
    '--accent': accent,
    '--canvas': background,
    '--ink': text,
    '--header-bg': header,
    '--footer-bg': footer,
  } as React.CSSProperties;
  const links = readBrandedPageLinks(s('women', 'page_links'), 'women');
  const logo = img('women', 'logo');
  const name = loc('women', 'name') || (lang === 'ar' ? 'لجنة سيدات الأعمال' : 'Women Business Committee');
  const tagline = loc('women', 'tagline');
  const footerText = loc('women', 'footer_text');
  const active = (to: string) => {
    const [path, hash] = to.split('#');
    return pathname.endsWith(path) && (hash ? activeSection === hash : activeSection === 'about');
  };

  return (
    <div style={theme} className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-40 text-white shadow-lg" style={{ backgroundColor: 'var(--header-bg)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href={href('/committees/women')} className="flex items-center gap-3">
            <img src={logo || '/brand/women-committee-icon.svg'} alt="" className="h-10 w-10 rounded-full bg-white object-contain p-1" />
            <span className="text-lg font-extrabold">{name}</span>
          </Link>
          <nav aria-label={name} className="hidden items-center gap-1 lg:flex">
            {links.navigation.filter((link) => link.isActive !== false).map((link, index) => <Link key={`${link.href}-${index}`} href={href(link.href)} className={`rounded-full px-3 py-2 text-sm font-semibold transition hover:bg-white/15 ${active(link.href) ? 'bg-white/15 text-accent' : 'text-white/90'}`}>{(lang === 'ar' ? link.labelAr : link.labelEn) || link.labelAr || link.labelEn}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={href('/')} className="hidden rounded-full border border-white/40 px-3 py-1.5 text-xs font-bold hover:bg-white/15 md:inline-block">{lang === 'ar' ? 'موقع الغرفة' : 'Chamber website'}</Link>
            <Link href={otherLangHref(pathname)} onClick={() => { try { localStorage.setItem('lang', lang === 'ar' ? 'en' : 'ar'); } catch {} }} className="rounded-full border border-white/30 px-3 py-1.5 text-xs font-bold hover:bg-white/15">{lang === 'ar' ? 'English' : 'العربية'}</Link>
            <button type="button" aria-label="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-lg border border-white/30 px-2.5 py-1.5 text-lg leading-none lg:hidden">☰</button>
          </div>
        </div>
        {open && <nav className="border-t border-white/15 px-4 pb-3 lg:hidden" onClick={() => setOpen(false)}>
          {links.navigation.filter((link) => link.isActive !== false).map((link, index) => <Link key={`${link.href}-${index}`} href={href(link.href)} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10">{(lang === 'ar' ? link.labelAr : link.labelEn) || link.labelAr || link.labelEn}</Link>)}
          <Link href={href('/')} className="mt-1 block rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold">{lang === 'ar' ? 'موقع الغرفة' : 'Chamber website'}</Link>
        </nav>}
      </header>
      <main className="min-h-[60vh] min-w-0">{children}</main>
      <footer className="mt-12 text-white/90" style={{ backgroundColor: 'var(--footer-bg)' }}>
        <div className="h-1 bg-gradient-to-r from-accent via-primary to-transparent" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm">
          <div>
            <div className="font-extrabold text-white">{name}</div>
            {tagline && <p className="mt-1 text-white/75">{tagline}</p>}
            {footerText && <p className="mt-2 max-w-xl leading-6 text-white/75">{footerText}</p>}
          </div>
          <div className="flex flex-wrap gap-4">
            {links.footer.filter((link) => link.isActive !== false).map((link, index) => <Link key={`${link.href}-${index}`} href={href(link.href)} className="hover:text-accent">{(lang === 'ar' ? link.labelAr : link.labelEn) || link.labelAr || link.labelEn}</Link>)}
            <Link href={href('/')} className="text-accent hover:underline">{lang === 'ar' ? 'موقع الغرفة' : 'Chamber website'}</Link>
          </div>
        </div>
      </footer>
      <BackToTop />
    </div>
  );
}

export default function WomenLayout({ children }: { children: React.ReactNode }) {
  return <SiteProvider><WomenChrome>{children}</WomenChrome></SiteProvider>;
}
