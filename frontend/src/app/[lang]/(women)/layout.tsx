'use client';
import { FooterBrand } from '@/components/site/footer-brand';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { fileUrl } from '@/lib/api';
import { SiteProvider, useSite } from '@/components/site/site-context';
import { BackToTop } from '@/components/site/shell';
import { SocialIcon } from '@/components/site/icons';
import { readWomenMenu, womenPageHref, type WomenMenuEntry } from '@/lib/women-menu';

const HEX = /^#[0-9a-f]{6}$/i;

function WomenActivePageSync({ onChange }: { onChange: (slug: string) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');
  useEffect(() => {
    onChange(pathname.replace(/\/+$/, '').endsWith('/section') ? slug ?? 'home' : 'home');
  }, [onChange, pathname, slug]);
  return null;
}

function WomenDropdown({ label, trigger, children, align = 'start', active = false }: { label: string; trigger?: React.ReactNode; children: React.ReactNode; align?: 'start' | 'end'; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [closedByClick, setClosedByClick] = useState(false);
  const expanded = open || (hovering && !closedByClick);
  const panelState = expanded
    ? 'visible translate-y-0 scale-100 opacity-100 pointer-events-auto'
    : 'invisible translate-y-2 scale-[0.98] opacity-0 pointer-events-none';
  return (
    <div className="group relative hidden xl:block"
      onMouseEnter={() => { setHovering(true); setClosedByClick(false); }}
      onMouseLeave={() => { setHovering(false); setClosedByClick(false); }}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
      {trigger ? (
        <button type="button" aria-label={label} aria-haspopup="true" aria-expanded={expanded} onClick={() => { setOpen((value) => !value); setClosedByClick(expanded); }} className="relative z-10 rounded-full">
          {trigger}
        </button>
      ) : (
        <button type="button" aria-haspopup="true" aria-expanded={expanded} onClick={() => { setOpen((value) => !value); setClosedByClick(expanded); }} className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition duration-200 hover:bg-white/15 hover:text-accent ${active || expanded ? 'bg-white/15 text-accent' : 'text-white/90'}`}>
          {label}
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
            <path d="m3 6 5 5 5-5" />
          </svg>
        </button>
      )}
      <div className={`absolute top-full z-50 origin-top pt-1 transition-[opacity,transform,visibility] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${panelState} ${align === 'end' ? 'end-0 min-w-52' : 'start-0 min-w-52'}`}>
        <div onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest('[data-keep-open]')) return;
          setOpen(false);
          setClosedByClick(true);
          (document.activeElement as HTMLElement | null)?.blur?.();
        }} className="max-h-72 overflow-y-auto overscroll-contain rounded-2xl bg-white/95 p-2 text-ink shadow-lift ring-1 ring-line backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
}

function WomenChrome({ children }: { children: React.ReactNode }) {
  const { lang, href, otherLangHref } = useI18n();
  const { me, can, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { s, loc, img } = useSite();
  const [open, setOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState('home');
  const color = (key: string, fallback: string) => {
    const value = String(s('women', key) ?? '');
    return HEX.test(value) ? value : fallback;
  };
  const primary = color('primary_color', '#c7878d');
  const accent = color('accent_color', '#34232c');
  const header = color('header_color', '#c7878d');
  const footer = color('footer_color', '#c7878d');
  const background = color('background_color', '#fff9fb');
  const text = color('text_color', '##34232c');
  const theme = {
    '--primary': primary,
    '--secondary': `color-mix(in srgb, ${primary} 70%, black)`,
    '--accent': accent,
    '--canvas': background,
    '--ink': text,
    '--header-bg': header,
    '--footer-bg': footer,
  } as React.CSSProperties;
  const links = readWomenMenu(s('women', 'page_links'));
  const logo = img('women', 'logo');
  const name = loc('women', 'name') || (lang === 'ar' ? 'لجنة سيدات الأعمال' : 'Women Business Committee');
  const tagline = loc('women', 'tagline');
  const footerText = loc('women', 'footer_text');
  const footerRights = loc('women', 'rights');
  const socialKeys = ['facebook_url', 'x_url', 'instagram_url', 'linkedin_url', 'youtube_url', 'whatsapp_url', 'telegram_url'] as const;
  const adminUrl = can('committees.read') ? '/admin/settings?page=women&tab=content' : '/admin/settings?page=women&tab=settings';
  const canManage = can('committees.read', 'settings.read');
  const canEdit = can('committees.update');
  const ar = lang === 'ar';
  const addItems = [
    { slug: 'initiatives', add: 'initiative', label: ar ? '＋ مبادرة / مشروع' : '＋ Initiative / project' },
    { slug: 'activities', add: 'activity', label: ar ? '＋ نشاط / فعالية' : '＋ Activity / event' },
    { slug: 'success', add: 'success', label: ar ? '＋ قصة نجاح' : '＋ Success story' },
  ];
  const logoutUser = async () => {
    await logout();
    router.push(href('/'));
  };
  const label = (entry: Extract<WomenMenuEntry, { type: 'page' }>) => (lang === 'ar' ? entry.labelAr : entry.labelEn) || entry.labelAr || entry.labelEn;
  const pageLink = (entry: Extract<WomenMenuEntry, { type: 'page' }>, className: string) => (
    <Link href={href(womenPageHref(entry.slug))} target={entry.newTab ? '_blank' : undefined} rel={entry.newTab ? 'noopener noreferrer' : undefined} aria-current={activeSlug === entry.slug ? 'page' : undefined} onClick={() => { setOpen(false); setActiveSlug(entry.slug); }} key={entry.slug} className={className}>{label(entry)}</Link>
  );
  // always the first link of the menu: the main page of the committee (the committee's own menu is edited in Settings)
  const homeEntry: Extract<WomenMenuEntry, { type: 'page' }> = { type: 'page', slug: 'home', labelAr: 'الرئيسية', labelEn: 'Home', isActive: true, newTab: false };
  const footerClass = 'rounded-lg px-2 py-1 text-sm text-white/80 transition hover:text-accent';
  const navPageClass = (entry: Extract<WomenMenuEntry, { type: 'page' }>) =>
    `shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition ${activeSlug === entry.slug ? 'bg-white/15 text-accent ring-1 ring-white/20' : 'text-white/90 hover:bg-white/15 hover:text-accent'}`;
  const visibleEntries = (entries: WomenMenuEntry[]) => entries.filter((entry) =>
    entry.isActive !== false && (entry.type === 'page' || entry.items.some((item) => item.isActive !== false)),
  );
  const navEntries = visibleEntries(links.navigation);
  const footerEntries = visibleEntries(links.footer);

  return (
    <div style={theme} className="min-h-screen bg-canvas text-ink">
      <Suspense fallback={null}><WomenActivePageSync onChange={setActiveSlug} /></Suspense>
      <header className="sticky top-0 z-40 text-white shadow-lg" style={{ backgroundColor: 'var(--header-bg)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href={href('/committees/women')} className="flex items-center gap-3">
            <img src={logo || '/brand/women-committee-icon.svg'} alt="" className="h-10 w-10 rounded-full bg-white object-contain p-1" />
            <span className="text-lg font-extrabold">{name}</span>
          </Link>
          <nav aria-label={name} className="hidden max-w-[55vw] items-center gap-1 xl:flex">
            <div key="nav-page-home">{pageLink(homeEntry, navPageClass(homeEntry))}</div>
            {navEntries.map((entry, index) => entry.type === 'page'
              ? <div key={`nav-page-${entry.slug}`}>{pageLink(entry, navPageClass(entry))}</div>
              : <WomenDropdown key={`nav-group-${index}`} label={lang === 'ar' ? entry.titleAr : entry.titleEn} active={entry.items.some((item) => item.isActive !== false && item.slug === activeSlug)}>
                {entry.items.filter((item) => item.isActive !== false).map((item) => pageLink(item, `block rounded-xl px-3 py-2 text-sm transition ${activeSlug === item.slug ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-primary/10 hover:text-primary'}`))}
              </WomenDropdown>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={href('/')} className="hidden rounded-full border border-white/40 px-3 py-1.5 text-xs font-bold hover:bg-white/15 md:inline-block">{lang === 'ar' ? 'موقع الغرفة' : 'Chamber website'}</Link>
            {me && <WomenDropdown label={me.fullName} align="end" trigger={
              <span title={me.fullName} aria-label={me.fullName} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/50 bg-white/15 text-sm font-bold text-white">
                {me.avatarUrl ? <img src={fileUrl(me.avatarUrl)} alt="" className="h-full w-full object-cover" /> : me.fullName.slice(0, 1)}
              </span>
            }>
              <div className="mb-1 border-b border-line px-3 py-2 text-sm font-semibold text-ink">{me.fullName}</div>
              <Link href={href('/profile')} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{lang === 'ar' ? 'الملف الشخصي' : 'Profile'}</Link>
              {canManage && <Link href={href(adminUrl)} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{lang === 'ar' ? 'إدارة الصفحة' : 'Manage page'}</Link>}
              {canEdit && <>
                <div className="my-1 border-t border-line px-3 pt-2 text-xs font-bold text-gray-500">{ar ? 'إضافة محتوى جديد' : 'Add new content'}</div>
                {addItems.map((x) => <Link key={x.add} href={href(`${womenPageHref(x.slug)}&add=${x.add}`)} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{x.label}</Link>)}
                {can('news.create') && <Link href={href(`${womenPageHref('news')}&add=news`)} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{ar ? '＋ خبر' : '＋ News item'}</Link>}
                <Link href={href(womenPageHref('archive'))} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{ar ? '🗄 أرشيف المبادرات والأنشطة' : '🗄 Archive'}</Link>
              </>}
              <button type="button" onClick={logoutUser} className="w-full rounded-xl px-3 py-2 text-start text-sm text-red-600 transition hover:bg-red-50">{lang === 'ar' ? 'تسجيل الخروج' : 'Log out'}</button>
            </WomenDropdown>}
            <Link href={otherLangHref(pathname)} onClick={() => { try { localStorage.setItem('lang', lang === 'ar' ? 'en' : 'ar'); } catch {} }} className="rounded-full border border-white/30 px-3 py-1.5 text-xs font-bold hover:bg-white/15">{lang === 'ar' ? 'English' : 'العربية'}</Link>
            {me && <Link href={href('/profile')} aria-label={lang === 'ar' ? 'الملف الشخصي' : 'Profile'} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/50 bg-white/15 text-sm font-bold text-white xl:hidden">
              {me.avatarUrl ? <img src={fileUrl(me.avatarUrl)} alt="" className="h-full w-full object-cover" /> : me.fullName.slice(0, 1)}
            </Link>}
            <button type="button" aria-label="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-lg border border-white/30 px-2.5 py-1.5 text-lg leading-none xl:hidden">☰</button>
          </div>
        </div>
        {open && <nav className="border-t border-white/15 px-4 pb-3 xl:hidden">
          {pageLink(homeEntry, `block rounded-lg px-3 py-2 text-sm font-semibold ${activeSlug === 'home' ? 'bg-white/15 text-accent' : 'hover:bg-white/10'}`)}
          {navEntries.map((entry, index) => entry.type === 'page'
            ? pageLink(entry, `block rounded-lg px-3 py-2 text-sm font-semibold ${activeSlug === entry.slug ? 'bg-white/15 text-accent' : 'hover:bg-white/10'}`)
            : <details key={`mobile-group-${index}`} className="group">
              <summary className={`flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${entry.items.some((item) => item.isActive !== false && item.slug === activeSlug) ? 'bg-white/15 text-accent' : 'hover:bg-white/10'}`}>{lang === 'ar' ? entry.titleAr : entry.titleEn}<span aria-hidden="true">⌄</span></summary>
              <div className="ps-3">{entry.items.filter((item) => item.isActive !== false).map((item) => pageLink(item, `block rounded-lg px-3 py-2 text-sm ${activeSlug === item.slug ? 'bg-white/10 font-semibold text-accent' : 'hover:bg-white/10'}`))}</div>
            </details>)}
          <Link href={href('/')} className="mt-1 block rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold">{lang === 'ar' ? 'موقع الغرفة' : 'Chamber website'}</Link>
          {me && <div className="mt-2 border-t border-white/15 pt-2">
            <div className="flex items-center gap-2 px-3 py-2 text-sm font-bold">
              {me.avatarUrl ? <img src={fileUrl(me.avatarUrl)} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15">{me.fullName.slice(0, 1)}</span>}
              {me.fullName}
            </div>
            <Link href={href('/profile')} className="block rounded-lg px-3 py-2 text-sm">{lang === 'ar' ? 'الملف الشخصي' : 'Profile'}</Link>
            {canManage && <Link href={href(adminUrl)} className="block rounded-lg px-3 py-2 text-sm">{lang === 'ar' ? 'إدارة الصفحة' : 'Manage page'}</Link>}
            {canEdit && <>
              {addItems.map((x) => <Link key={x.add} href={href(`${womenPageHref(x.slug)}&add=${x.add}`)} className="block rounded-lg px-3 py-2 text-sm">{x.label}</Link>)}
              {can('news.create') && <Link href={href(`${womenPageHref('news')}&add=news`)} className="block rounded-lg px-3 py-2 text-sm">{ar ? '＋ خبر' : '＋ News item'}</Link>}
              <Link href={href(womenPageHref('archive'))} className="block rounded-lg px-3 py-2 text-sm">{ar ? '🗄 الأرشيف' : '🗄 Archive'}</Link>
            </>}
            <button type="button" onClick={logoutUser} className="w-full rounded-lg px-3 py-2 text-start text-sm text-red-200">{lang === 'ar' ? 'تسجيل الخروج' : 'Log out'}</button>
          </div>}
        </nav>}
      </header>
      <main className="min-h-[60vh] min-w-0">{children}</main>
      <footer className="mt-12 text-white/90" style={{ backgroundColor: 'var(--footer-bg)' }}>
        <div className="h-1 bg-gradient-to-r from-accent via-primary to-transparent" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm">
          <div>
            <FooterBrand logo={logo || '/brand/women-committee-icon.svg'} name={name} summary={footerText || tagline} />
          </div>
          <div className="flex flex-wrap items-start gap-3">
            {footerEntries.map((entry, index) => entry.type === 'page'
              ? pageLink(entry, footerClass)
              : <details key={`footer-group-${index}`} className="min-w-36">
                <summary className="cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-white hover:text-accent">{lang === 'ar' ? entry.titleAr : entry.titleEn}</summary>
                <div className="mt-1 flex flex-col ps-2">{entry.items.filter((item) => item.isActive !== false).map((item) => pageLink(item, footerClass))}</div>
              </details>)}
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
        {footerRights && <div className="border-t border-white/15">
          <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-white/70">{footerRights}</div>
        </div>}
      </footer>
      <BackToTop />
    </div>
  );
}

export default function WomenLayout({ children }: { children: React.ReactNode }) {
  return <SiteProvider><WomenChrome>{children}</WomenChrome></SiteProvider>;
}
