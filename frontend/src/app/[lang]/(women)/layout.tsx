'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { fileUrl } from '@/lib/api';
import { SiteProvider, useSite } from '@/components/site/site-context';
import { BackToTop } from '@/components/site/shell';
import { SocialIcon } from '@/components/site/icons';
import { readBrandedPageLinks } from '@/lib/branded-page-links';

const HEX = /^#[0-9a-f]{6}$/i;

function WomenChrome({ children }: { children: React.ReactNode }) {
  const { lang, href, otherLangHref } = useI18n();
  const { me, can, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { s, loc, img } = useSite();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
  const socialKeys = ['facebook_url', 'x_url', 'instagram_url', 'linkedin_url', 'youtube_url', 'whatsapp_url', 'telegram_url'] as const;
  const adminUrl = can('committees.read') ? '/admin/settings?page=women&tab=content' : '/admin/settings?page=women&tab=settings';
  const canManage = can('committees.read', 'settings.read');
  const logoutUser = async () => {
    await logout();
    router.push(href('/'));
  };
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
          <nav aria-label={name} className="hidden max-w-[55vw] items-center gap-1 overflow-x-auto lg:flex">
            {links.navigation.filter((link) => link.isActive !== false).map((link, index) => <Link key={`${link.href}-${index}`} href={href(link.href)} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition hover:bg-white/15 ${active(link.href) ? 'bg-white/15 text-accent' : 'text-white/90'}`}>{(lang === 'ar' ? link.labelAr : link.labelEn) || link.labelAr || link.labelEn}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={href('/')} className="hidden rounded-full border border-white/40 px-3 py-1.5 text-xs font-bold hover:bg-white/15 md:inline-block">{lang === 'ar' ? 'موقع الغرفة' : 'Chamber website'}</Link>
            {me && <div className="relative hidden md:block">
              <button type="button" aria-label={me.fullName} aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/50 bg-white/15 text-sm font-bold text-white">
                {me.avatarUrl ? <img src={fileUrl(me.avatarUrl)} alt="" className="h-full w-full object-cover" /> : me.fullName.slice(0, 1)}
              </button>
              {profileOpen && <div className="absolute end-0 top-full z-50 mt-2 min-w-48 rounded-xl bg-white p-2 text-sm text-ink shadow-xl">
                <div className="border-b border-line px-3 py-2 font-semibold">{me.fullName}</div>
                <Link href={href('/profile')} onClick={() => setProfileOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-primary/10">{lang === 'ar' ? 'الملف الشخصي' : 'Profile'}</Link>
                {canManage && <Link href={href(adminUrl)} onClick={() => setProfileOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-primary/10">{lang === 'ar' ? 'إدارة الصفحة' : 'Manage page'}</Link>}
                <button type="button" onClick={logoutUser} className="w-full rounded-lg px-3 py-2 text-start text-red-600 hover:bg-red-50">{lang === 'ar' ? 'تسجيل الخروج' : 'Log out'}</button>
              </div>}
            </div>}
            <Link href={otherLangHref(pathname)} onClick={() => { try { localStorage.setItem('lang', lang === 'ar' ? 'en' : 'ar'); } catch {} }} className="rounded-full border border-white/30 px-3 py-1.5 text-xs font-bold hover:bg-white/15">{lang === 'ar' ? 'English' : 'العربية'}</Link>
            <button type="button" aria-label="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-lg border border-white/30 px-2.5 py-1.5 text-lg leading-none lg:hidden">☰</button>
          </div>
        </div>
        {open && <nav className="border-t border-white/15 px-4 pb-3 lg:hidden" onClick={() => setOpen(false)}>
          {links.navigation.filter((link) => link.isActive !== false).map((link, index) => <Link key={`${link.href}-${index}`} href={href(link.href)} className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10">{(lang === 'ar' ? link.labelAr : link.labelEn) || link.labelAr || link.labelEn}</Link>)}
          <Link href={href('/')} className="mt-1 block rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold">{lang === 'ar' ? 'موقع الغرفة' : 'Chamber website'}</Link>
          {me && <div className="mt-2 border-t border-white/15 pt-2">
            <div className="flex items-center gap-2 px-3 py-2 text-sm font-bold">
              {me.avatarUrl ? <img src={fileUrl(me.avatarUrl)} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">{me.fullName.slice(0, 1)}</span>}
              {me.fullName}
            </div>
            <Link href={href('/profile')} className="block rounded-lg px-3 py-2 text-sm">{lang === 'ar' ? 'الملف الشخصي' : 'Profile'}</Link>
            {canManage && <Link href={href(adminUrl)} className="block rounded-lg px-3 py-2 text-sm">{lang === 'ar' ? 'إدارة الصفحة' : 'Manage page'}</Link>}
            <button type="button" onClick={logoutUser} className="w-full rounded-lg px-3 py-2 text-start text-sm text-red-200">{lang === 'ar' ? 'تسجيل الخروج' : 'Log out'}</button>
          </div>}
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
          {(s('women', 'contact_phone') || s('women', 'contact_email') || s('women', 'contact_website') || socialKeys.some((key) => s('women', `social_${key}`))) && <div className="flex flex-wrap items-center gap-3 text-xs">
            {s('women', 'contact_phone') && <a href={`tel:${String(s('women', 'contact_phone')).replace(/[^\d+]/g, '')}`} dir="ltr" className="hover:text-accent">{s('women', 'contact_phone')}</a>}
            {s('women', 'contact_email') && <a href={`mailto:${s('women', 'contact_email')}`} dir="ltr" className="hover:text-accent">{s('women', 'contact_email')}</a>}
            {s('women', 'contact_website') && <a href={s('women', 'contact_website')} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{lang === 'ar' ? 'الموقع الإلكتروني' : 'Website'}</a>}
            {socialKeys.map((key) => {
              const url = s('women', `social_${key}`);
              return url ? <a key={key} href={url} target="_blank" rel="noopener noreferrer" aria-label={key.replace('_url', '')} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 hover:border-accent hover:text-accent"><SocialIcon name={key} size={15} /></a> : null;
            })}
          </div>}
        </div>
      </footer>
      <BackToTop />
    </div>
  );
}

export default function WomenLayout({ children }: { children: React.ReactNode }) {
  return <SiteProvider><WomenChrome>{children}</WomenChrome></SiteProvider>;
}
