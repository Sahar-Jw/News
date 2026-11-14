'use client';
import { FooterBrand } from '@/components/site/footer-brand';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { fileUrl } from '@/lib/api';
import { SiteProvider, useSite } from '@/components/site/site-context';
import { useExpoInfo } from '@/components/site/expo-shared';
import { BackToTop } from '@/components/site/shell';
import { Breadcrumbs } from '@/components/site/breadcrumbs';
import { BrandedDropdown } from '@/components/site/branded-dropdown';
import { ExpoManageBar } from '@/components/site/expo-manage-bar';
import { SocialIcon } from '@/components/site/icons';
import { expoPageHref, readExpoMenu } from '@/lib/expo-menu';
import type { WomenMenuEntry, WomenMenuPage } from '@/lib/women-menu';
import { fmtDay } from '@/lib/utils';

const HEX = /^#[0-9a-f]{6}$/i;
const SOCIAL = ['facebook_url', 'x_url', 'instagram_url', 'linkedin_url', 'youtube_url', 'whatsapp_url', 'telegram_url'] as const;

/**
 * DCC EXPO is a separate site with its own identity (every colour, the logo, header, footer and menus are set in Settings → DCC EXPO):
 * the chamber colours are overridden for this subtree only.
 */
function Chrome({ children }: { children: React.ReactNode }) {
  const { lang, t, href, otherLangHref } = useI18n();
  const pathname = usePathname();
  const { me, can, logout } = useAuth();
  const router = useRouter();
  const x = useExpoInfo();
  const [open, setOpen] = useState(false);
  const { s } = useSite();
  const ar = lang === 'ar';
  const color = (key: string, fallback: string) => { const v = String(s('expo', key) ?? ''); return HEX.test(v) ? v : fallback; };
  const primary = color('primary_color', '#4b1d7a');
  const accent = color('accent_color', '#c9a227');
  const header = color('header_color', `color-mix(in srgb, ${primary} 70%, black)`);
  const footer = color('footer_color', header);
  const theme = { '--primary': primary, '--secondary': header, '--accent': accent, '--canvas': color('background_color', '#faf8fc'), '--ink': color('text_color', '#1f2937'), '--expo-footer': footer } as React.CSSProperties;

  const menu = readExpoMenu(s('expo', 'page_links'));
  const visible = (entries: WomenMenuEntry[]) => entries.filter((e) => e.isActive !== false && (e.type === 'page' || e.items.some((i) => i.isActive !== false)));
  const navEntries = visible(menu.navigation);
  const footerEntries = visible(menu.footer);
  const current = (slug: string) => { const p = pathname.replace(/\/+$/, ''); return slug === 'home' ? /\/expo$/.test(p) : p.endsWith(`/expo/${slug}`); };
  const label = (p: WomenMenuPage) => (ar ? p.labelAr : p.labelEn) || p.labelAr || p.labelEn;
  const link = (p: WomenMenuPage, className: string) => <Link key={p.slug} href={href(expoPageHref(p.slug))} target={p.newTab ? '_blank' : undefined} aria-current={current(p.slug) ? 'page' : undefined} onClick={() => setOpen(false)} className={className}>{label(p)}</Link>;
  const navClass = (p: WomenMenuPage) => `shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition ${current(p.slug) ? 'bg-white/15 text-accent ring-1 ring-white/20' : 'text-white/90 hover:bg-white/15 hover:text-accent'}`;
  const groupActive = (g: Extract<WomenMenuEntry, { type: 'dropdown' }>) => g.items.some((i) => i.isActive !== false && current(i.slug));
  const footerClass = 'rounded-lg px-2 py-1 text-sm text-white/80 transition hover:text-accent';
  const adminUrl = can('expo.read') ? '/admin/settings?page=expo&tab=exhibitors' : '/admin/settings?page=expo';
  const canManage = can('expo.read', 'settings.read');
  // quick links of the account menu, each shown only to people who hold its permission (the API still enforces every one)
  const tab = (k: string, add = false) => `/admin/settings?page=expo&tab=${k}${add ? '&add=1' : ''}`;
  const quick: { to: string; label: string }[] = [
    can('expo.create') && { to: tab('exhibitors', true), label: ar ? '＋ إضافة عارض' : '＋ Add exhibitor' },
    can('expo.create') && { to: tab('sponsors', true), label: ar ? '＋ إضافة راعٍ / شريك' : '＋ Add sponsor' },
    can('expo.create') && { to: tab('sessions', true), label: ar ? '＋ إضافة جلسة' : '＋ Add session' },
    can('news.create') && { to: '/expo/news', label: ar ? '＋ إضافة خبر' : '＋ Add news' },
    can('expo.applications.read') && { to: tab('applications'), label: ar ? '📥 طلبات المشاركة' : '📥 Participation requests' },
    can('settings.read') && { to: tab('identity'), label: ar ? '🎨 الهوية والمظهر' : '🎨 Identity & theme' },
  ].filter(Boolean) as { to: string; label: string }[];
  const logoutUser = async () => { await logout(); router.push(href('/')); };
  const avatar = me ? (me.avatarUrl ? <img src={fileUrl(me.avatarUrl)} alt="" className="h-full w-full object-cover" /> : me.fullName.slice(0, 1)) : null;
  const socials = SOCIAL.filter((k) => s('expo', `social_${k}`));
  const rights = x.L('rights');

  return (
    <div style={theme} data-brand-theme className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-40 bg-secondary text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href={href('/expo')} className="flex items-center gap-3">
            {x.logo ? <img src={x.logo} alt="" className="h-10 w-10 rounded-full bg-white object-contain p-0.5" /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-accent font-extrabold text-secondary">E</span>}
            <span className="text-lg font-extrabold tracking-wide">{x.name}</span>
          </Link>
          <nav aria-label={x.name} className="hidden max-w-[52vw] items-center gap-1 xl:flex 2xl:max-w-[62vw]">
            {navEntries.map((e, i) => e.type === 'page'
              ? <div key={`n-${e.slug}`}>{link(e, navClass(e))}</div>
              : <BrandedDropdown key={`g-${i}`} label={ar ? e.titleAr : e.titleEn} active={groupActive(e)}>
                {e.items.filter((it) => it.isActive !== false).map((it) => link(it, `block rounded-xl px-3 py-2 text-sm transition ${current(it.slug) ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-primary/10 hover:text-primary'}`))}
              </BrandedDropdown>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={href('/')} title={t('ex.backToChamber')} aria-label={t('ex.backToChamber')} className="hidden items-center gap-1.5 rounded-full border border-white/40 px-3 py-1.5 text-xs font-bold transition hover:bg-white/15 sm:inline-flex"><span aria-hidden="true" className="rtl:rotate-180">←</span><span aria-hidden="true">⌂</span><span className="hidden 2xl:inline">{t('ex.backToChamber')}</span></Link>
            {x.registerOpen && <Link href={href('/expo/register')} className="hidden rounded-full bg-accent px-4 py-2 text-sm font-extrabold text-secondary shadow transition hover:brightness-110 sm:inline-block">{t('ex.registerExhibitor')}</Link>}
            <Link href={otherLangHref(pathname)} onClick={() => { try { localStorage.setItem('lang', ar ? 'en' : 'ar'); } catch {} }} className="rounded-full border border-white/30 px-3 py-1.5 text-xs font-bold hover:bg-white/15">{t('site.language')}</Link>
            {me && <BrandedDropdown label={me.fullName} align="end" trigger={
              <span title={me.fullName} aria-label={me.fullName} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/50 bg-white/15 text-sm font-bold text-white">{avatar}</span>
            }>
              <div className="mb-1 border-b border-line px-3 py-2 text-sm font-semibold text-ink">{me.fullName}</div>
              <Link href={href('/profile')} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{ar ? 'الملف الشخصي' : 'Profile'}</Link>
              {canManage && <Link href={href(adminUrl)} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{ar ? 'إدارة الصفحة' : 'Manage page'}</Link>}
              {quick.length > 0 && <div className="my-1 border-t border-line px-3 pt-2 text-xs font-bold text-gray-500">{ar ? 'إدارة سريعة' : 'Quick manage'}</div>}
              {quick.map((q) => <Link key={q.to + q.label} href={href(q.to)} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{q.label}</Link>)}
              <button type="button" onClick={logoutUser} className="w-full rounded-xl px-3 py-2 text-start text-sm text-red-600 transition hover:bg-red-50">{ar ? 'تسجيل الخروج' : 'Log out'}</button>
            </BrandedDropdown>}
            {me && <Link href={href('/profile')} aria-label={ar ? 'الملف الشخصي' : 'Profile'} className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/50 bg-white/15 text-sm font-bold text-white xl:hidden">{avatar}</Link>}
            <button type="button" aria-label="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-lg border border-white/30 px-2.5 py-1.5 text-lg leading-none xl:hidden">☰</button>
          </div>
        </div>
        {open && (
          <nav className="max-h-[75vh] overflow-y-auto border-t border-white/15 px-4 pb-3 xl:hidden">
            {navEntries.map((e, i) => e.type === 'page'
              ? link(e, `block rounded-lg px-3 py-2 text-sm font-semibold ${current(e.slug) ? 'bg-white/15 text-accent' : 'hover:bg-white/10'}`)
              : <details key={`m-${i}`} className="group">
                <summary className={`flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${groupActive(e) ? 'bg-white/15 text-accent' : 'hover:bg-white/10'}`}>{ar ? e.titleAr : e.titleEn}<span aria-hidden="true">⌄</span></summary>
                <div className="ps-3">{e.items.filter((it) => it.isActive !== false).map((it) => link(it, `block rounded-lg px-3 py-2 text-sm ${current(it.slug) ? 'bg-white/10 font-semibold text-accent' : 'hover:bg-white/10'}`))}</div>
              </details>)}
            <Link href={href('/')} className="mt-1 block rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold hover:bg-white/10">← {t('ex.backToChamber')}</Link>
            {x.registerOpen && <Link href={href('/expo/register')} className="mt-2 block rounded-full bg-accent px-4 py-2 text-center text-sm font-extrabold text-secondary">{t('ex.registerExhibitor')}</Link>}
            {me && (
              <div className="mt-2 border-t border-white/15 pt-2">
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-bold"><span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-white/15">{avatar}</span>{me.fullName}</div>
                <Link href={href('/profile')} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm">{ar ? 'الملف الشخصي' : 'Profile'}</Link>
                {canManage && <Link href={href(adminUrl)} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm">{ar ? 'إدارة الصفحة' : 'Manage page'}</Link>}
                {quick.map((q) => <Link key={q.to + q.label} href={href(q.to)} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm">{q.label}</Link>)}
                <button type="button" onClick={logoutUser} className="w-full rounded-lg px-3 py-2 text-start text-sm text-red-200">{ar ? 'تسجيل الخروج' : 'Log out'}</button>
              </div>
            )}
          </nav>
        )}
      </header>
      {/* control buttons for people with permission; the wrapper disappears when the bar renders nothing */}
      <div className="mx-auto max-w-7xl px-4 pt-6 empty:hidden"><ExpoManageBar /></div>
      <main className="min-h-[60vh] min-w-0"><Breadcrumbs scope="expo" />{children}</main>
      <footer className="mt-12 text-white/90" style={{ backgroundColor: 'var(--expo-footer)' }}>
        <div className="h-1 bg-gradient-to-r from-accent via-primary to-transparent" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm md:grid-cols-[1.2fr_1.6fr_1fr]">
          <div>
            <FooterBrand logo={x.logo} name={x.name} summary={x.footerText || x.tagline} />
            <div className="mt-4 space-y-1.5 text-white/85">
              {x.start && <div>📅 {fmtDay(lang, x.start)}{x.end && x.end !== x.start ? ` — ${fmtDay(lang, x.end)}` : ''}</div>}
              {x.venue && <div>📍 {x.venue}</div>}
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            {footerEntries.map((e, i) => e.type === 'page'
              ? <div key={`f-${e.slug}`}>{link(e, footerClass)}</div>
              : <div key={`fg-${i}`} className="min-w-36">
                <div className="px-2 py-1 text-sm font-bold text-white">{ar ? e.titleAr : e.titleEn}</div>
                <div className="flex flex-col">{e.items.filter((it) => it.isActive !== false).map((it) => link(it, footerClass))}</div>
              </div>)}
          </div>
          <div className="space-y-2">
            {x.phone && <div>☎ <a href={`tel:${x.phone.replace(/[^\d+]/g, '')}`} dir="ltr" className="hover:text-accent">{x.phone}</a></div>}
            {x.email && <div>✉ <a href={`mailto:${x.email}`} dir="ltr" className="hover:text-accent">{x.email}</a></div>}
            {x.website && <div>🌐 <a href={x.website} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{ar ? 'الموقع الإلكتروني' : 'Website'}</a></div>}
            {socials.length > 0 && <div className="flex flex-wrap gap-2 pt-1">{socials.map((k) => <a key={k} href={String(s('expo', `social_${k}`))} target="_blank" rel="noopener noreferrer" aria-label={k.replace('_url', '')} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 hover:border-accent hover:text-accent"><SocialIcon name={k} size={15} /></a>)}</div>}
            <Link href={href('/')} className="block pt-1 text-accent hover:underline">← {t('ex.backToChamber')}</Link>
          </div>
        </div>
        {rights && <div className="border-t border-white/15"><div className="mx-auto max-w-7xl px-4 py-4 text-xs text-white/70">{rights}</div></div>}
      </footer>
      <BackToTop />
    </div>
  );
}

export default function ExpoLayout({ children }: { children: React.ReactNode }) {
  return <SiteProvider><Chrome>{children}</Chrome></SiteProvider>;
}
