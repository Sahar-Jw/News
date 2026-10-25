'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useSite } from './site-context';
import { SECTION_ORDER_KEYS } from './sections-meta';
import { SECTIONS, newsPerm } from '@/lib/utils';
import { ContactIcon, SocialIcon } from './icons';

type NavItem = { label: string; to: string; show: boolean };

function NavTrigger({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex cursor-default items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-ink/80 transition hover:bg-primary/10 hover:text-primary">
      {children}
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-300 ease-out group-hover:rotate-180 group-focus-within:rotate-180">
        <path d="m3 6 5 5 5-5" />
      </svg>
    </span>
  );
}

/**
 * Set when a dropdown link was clicked. The click often switches layout (site <-> admin), which remounts the navbar
 * under a pointer that has not moved: without this the new dropdown would be hover-open again. Cleared when the
 * pointer enters a dropdown again.
 */
let closedByClick = false;

function Dropdown({ label, trigger, panelClass, children }: { label: string; trigger: React.ReactNode; panelClass: string; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => closedByClick);
  const panelId = useId();
  const dismiss = () => {
    setMobileOpen(false);
    if (window.matchMedia('(min-width: 1280px)').matches) {
      closedByClick = true;
      setDismissed(true);
      // the clicked link keeps keyboard focus, and :focus-within would keep the panel open after the pointer leaves
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  };
  const desktopOpenClasses = dismissed ? '' : 'group-hover:visible group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:delay-[0ms] group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 group-focus-within:pointer-events-auto group-focus-within:delay-[0ms]';
  return (
    <>
      <div
        className="group relative hidden xl:block"
        onMouseEnter={() => { closedByClick = false; setDismissed(false); }}
        onFocusCapture={(event) => { if ((event.target as HTMLElement).matches?.(':focus-visible')) { closedByClick = false; setDismissed(false); } }}
      >
        {trigger}
        <div className={`invisible absolute top-full z-50 origin-top translate-y-2 scale-[0.98] pt-1 opacity-0 pointer-events-none transition-[opacity,transform,visibility] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-[0ms,0ms,250ms] ${desktopOpenClasses} ${panelClass}`}>
          <div onClickCapture={dismiss} className="rounded-2xl bg-white p-1.5 shadow-lift ring-1 ring-line">{children}</div>
        </div>
      </div>
      <div className="w-full xl:hidden">
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-controls={panelId}
          onClick={() => setMobileOpen((open) => !open)}
          className="flex w-full cursor-default items-center justify-between rounded-full px-3.5 py-2 text-start text-sm font-medium text-ink/80 transition hover:bg-primary/10 hover:text-primary"
        >
          <span>{label}</span>
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform duration-300 ${mobileOpen ? 'rotate-180' : ''}`}>
            <path d="m3 6 5 5 5-5" />
          </svg>
        </button>
        <div id={panelId} data-open={mobileOpen} className="grid w-full grid-rows-[0fr] -translate-y-2 opacity-0 pointer-events-none invisible transition-[grid-template-rows,opacity,transform,visibility] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-[0ms,0ms,0ms,350ms] data-[open=true]:grid-rows-[1fr] data-[open=true]:translate-y-0 data-[open=true]:opacity-100 data-[open=true]:pointer-events-auto data-[open=true]:visible data-[open=true]:delay-[0ms] xl:contents xl:translate-y-0 xl:opacity-100 xl:pointer-events-auto xl:visible xl:transition-none">
          <div className="min-h-0 overflow-hidden xl:contents">
            <div onClickCapture={dismiss} className="mt-1 w-full rounded-2xl border border-line bg-white p-1.5 shadow-card">{children}</div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Hover dropdown used for the permission-based menus (same look as the other nav dropdowns). */
function NavDropdown({ label, items, href }: { label: string; items: NavItem[]; href: (p: string) => string }) {
  const visible = items.filter((i) => i.show);
  if (visible.length === 0) return null;
  return (
    <Dropdown
      label={label}
      trigger={<NavTrigger>{label}</NavTrigger>}
      panelClass="start-0 min-w-52"
    >
      {visible.map((i) => (
        <Link key={i.to} href={href(i.to)} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{i.label}</Link>
      ))}
    </Dropdown>
  );
}

function SocialLinks() {
  const { s } = useSite();
  const keys = ['facebook_url', 'x_url', 'instagram_url', 'linkedin_url', 'youtube_url', 'whatsapp_url'];
  return (
    <div className="flex items-center gap-2">
      {keys.map((k) => {
        const v = s('social', k);
        return v ? (
          <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/30" aria-label={k.replace('_url', '')} title={k.replace('_url', '')}>
            <SocialIcon name={k} />
          </a>
        ) : null;
      })}
    </div>
  );
}

/** A colour chosen in Settings, or undefined while it is empty / still the old default (so the new look applies). */
function custom(v: string | undefined, oldDefaults: string[]) {
  return v && !oldDefaults.includes(v.toLowerCase()) ? v : undefined;
}

export function TopBar() {
  const { lang, t } = useI18n();
  const { s, loc } = useSite();
  const [now, setNow] = useState('');
  useEffect(() => {
    const loc2 = lang === 'ar' ? 'ar' : 'en-GB';
    setNow(new Intl.DateTimeFormat(loc2, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date()));
  }, [lang]);
  const phone = s('contact', 'phone');
  const email = s('contact', 'email');
  const addr = loc('contact', 'address');
  return (
    <div className="no-print bg-gradient-to-r from-secondary via-secondary to-primary/70 text-xs text-white/90">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5">
        <div className="flex flex-wrap items-center gap-4">
          {now && <span className="flex items-center gap-1.5"><ContactIcon name="date" />{now}</span>}
          {phone && <a href={`tel:${phone}`} className="flex items-center gap-1.5"><ContactIcon name="phone" /><bdi dir="ltr">{phone}</bdi></a>}
          {email && <a href={`mailto:${email}`} className="flex items-center gap-1.5"><ContactIcon name="email" /><bdi dir="ltr">{email}</bdi></a>}
          {addr && <span className="flex items-center gap-1.5"><ContactIcon name="address" />{addr}</span>}
        </div>
        <SocialLinks />
      </div>
    </div>
  );
}

export function Navbar() {
  const { lang, t, href, otherLangHref } = useI18n();
  const { loc, img, categories, settings } = useSite();
  const { me, can, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const avatar = me ? (
    me.avatarUrl
      ? <img src={fileUrl(me.avatarUrl)} alt="" className="h-8 w-8 rounded-full object-cover" />
      : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-white">{me.fullName.slice(0, 1)}</span>
  ) : null;
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const menuPanelId = useId();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const logo = img('branding', 'logo');
  const secs = SECTION_ORDER_KEYS.filter((c) => settings.sections_home?.[`${c}_visible`] !== false && c !== 'hero')
    .sort((a, b) => (settings.sections_home?.[`${a}_order`] ?? 99) - (settings.sections_home?.[`${b}_order`] ?? 99));
  const isHome = pathname === `/${lang}/` || pathname === `/${lang}`;

  // Extra dropdowns for logged-in users. Each item only appears if the user holds the permission
  // (UI hint only - the API still enforces every permission).
  const manageItems: NavItem[] = [
    { label: t('adm.news'), to: '/admin/news', show: can(newsPerm('read')) },
    ...SECTIONS.map((s) => ({ label: t(`section.${s}`), to: `/admin/sections/${s}`, show: can(newsPerm('read', s)) })),
    { label: t('adm.messages'), to: '/admin/messages', show: can('messages.read') },
  ];
  // Tools: each item shows only for users holding its own permission (technical_admin holds all); the dropdown hides when none applies.
  const toolsItems: NavItem[] = [
    { label: t('adm.occasions'), to: '/admin/occasions', show: can('occasions.read') },
    { label: t('adm.gallery'), to: '/admin/gallery', show: can('gallery.read') },
    { label: t('adm.subscribers'), to: '/admin/subscribers', show: can('subscribers.read') },
    { label: t('adm.ads'), to: '/admin/ads', show: can('ads.read') },
    { label: t('adm.customers'), to: '/admin/customers', show: can('customers.read') },
    { label: t('adm.dates'), to: '/admin/dates', show: can('appointments.read') },
    { label: t('adm.datesDashboard'), to: '/admin/dates-dashboard', show: can('appointments.dashboard') },
  ];
  // Services: public pages, visible to everyone.
  const servicesItems: NavItem[] = [
    { label: t('pub.upcoming'), to: '/occasions/upcoming', show: true },
    { label: t('pub.previous'), to: '/occasions/previous', show: true },
    { label: t('pub.gallery'), to: '/gallery', show: true },
  ];
  const securityItems: NavItem[] = [
    { label: t('adm.users'), to: '/admin/users', show: can('users.read') },
    { label: `${t('adm.roles')} / ${t('adm.permissions')}`, to: '/admin/roles', show: can('roles.read', 'permissions.read', 'permissions.assign') },
    { label: t('adm.settings'), to: '/admin/settings', show: can('settings.read') },
    { label: t('adm.cities'), to: '/admin/cities', show: can('cities.read') },
    { label: t('adm.audit'), to: '/admin/audit', show: can('audit.read') },
  ];

  // Live search: runs shortly after typing stops (no Enter needed). Clearing it returns to the page the visitor came from.
  const onSearchPage = /\/search\/?$/.test(pathname);
  const origin = useRef<string | null>(null); // page the search started from
  const selfNav = useRef(false); // true while our own navigation is in flight (so the input is not overwritten)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (selfNav.current) { selfNav.current = false; return; }
    if (onSearchPage) setQ(new URLSearchParams(window.location.search).get('q') ?? '');
    else { setQ(''); origin.current = null; }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const goSearch = (text: string) => {
    const value = text.trim();
    if (value.length < 2) return;
    if (!onSearchPage && origin.current === null) origin.current = window.location.pathname + window.location.search;
    selfNav.current = !onSearchPage;
    const url = href(`/search?q=${encodeURIComponent(value)}`);
    onSearchPage ? router.replace(url) : router.push(url);
  };
  const leaveSearch = () => {
    clearTimeout(timer.current);
    const back = origin.current;
    origin.current = null;
    if (!onSearchPage) return;
    selfNav.current = false;
    router.push(back || href('/'));
  };
  const typing = (text: string) => {
    setQ(text);
    clearTimeout(timer.current);
    if (!text.trim()) { if (onSearchPage) leaveSearch(); return; }
    timer.current = setTimeout(() => goSearch(text), 500);
  };
  const clear = () => { setQ(''); leaveSearch(); };
  useEffect(() => () => clearTimeout(timer.current), []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    clearTimeout(timer.current);
    goSearch(q);
  };

  return (
    <header className={`no-print sticky top-0 z-40 border-b border-line/70 bg-white/80 backdrop-blur-xl transition-shadow duration-300 ${scrolled ? 'shadow-card' : ''}`} style={{ background: custom(settings.appearance?.header_background, ['#ffffff', '#fff']) }}>
      <div className={`mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 transition-all duration-300 xl:flex-nowrap xl:gap-x-4 ${scrolled ? 'py-1' : 'py-2.5'}`}>
        <Link href={href('/')} className="flex min-w-0 flex-1 items-center gap-3 xl:min-w-[9rem]">
          {logo && <img src={logo} alt="" className={`w-auto shrink-0 transition-all duration-300 ${scrolled ? 'h-9' : 'h-12'}`} />}
          <div className="min-w-0">
            {/* the name wraps (max two lines) beside the logo, so the menu never drops to a second row; longer name = smaller text */}
            <div className="line-clamp-2 break-words py-0.5 font-display font-bold leading-[1.75] text-primary" style={{ fontSize: `${Math.max(0.85, 1.125 - Math.max(0, loc('branding', 'site_name').length - 14) * 0.012).toFixed(3)}rem` }}>{loc('branding', 'site_name')}</div>
            {loc('branding', 'site_description') && <div className="max-w-[16rem] truncate text-xs text-gray-500">{loc('branding', 'site_description')}</div>}
          </div>
        </Link>

        <div className="ms-auto flex shrink-0 items-center gap-2 xl:hidden">
          {me && <Link href={href('/profile')} aria-label={t('site.profile')} className="flex items-center rounded-full border border-line bg-white p-1 transition hover:border-primary">{avatar}</Link>}
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white" onClick={() => setMenu((open) => !open)} aria-label="menu" aria-expanded={menu} aria-controls={menuPanelId}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={`transition-transform duration-300 ${menu ? 'rotate-90' : ''}`}>{menu ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>

        <div id={menuPanelId} data-open={menu} className="grid w-full grid-rows-[0fr] -translate-y-2 opacity-0 pointer-events-none invisible transition-[grid-template-rows,opacity,transform,visibility] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-[0ms,0ms,0ms,350ms] data-[open=true]:grid-rows-[1fr] data-[open=true]:translate-y-0 data-[open=true]:opacity-100 data-[open=true]:pointer-events-auto data-[open=true]:visible data-[open=true]:delay-[0ms] xl:contents xl:translate-y-0 xl:opacity-100 xl:pointer-events-auto xl:visible xl:transition-none">
          <div className="min-h-0 overflow-hidden xl:contents">
        <nav onClick={(e) => { if (window.matchMedia('(max-width: 1279px)').matches && (e.target as HTMLElement).closest('a')) setMenu(false); }} className="flex w-full flex-col gap-1 xl:ms-auto xl:w-auto xl:shrink-0 xl:flex-row xl:items-center xl:gap-1">
          <Link href={href('/')} className={`w-full rounded-full px-3.5 py-2 text-start text-sm font-medium transition hover:bg-primary/10 hover:text-primary xl:w-auto ${isHome ? 'bg-primary/10 text-primary' : 'text-ink/80'}`}>{t('site.home')}</Link>

          {categories.main.length > 0 && (
            <Dropdown
              label={t('site.categories')}
              trigger={<NavTrigger>{t('site.categories')}</NavTrigger>}
              panelClass="start-0 min-w-48"
            >
              {categories.main.map((c) => (
                <Link key={c} href={href(`/news?category=${encodeURIComponent(c)}`)} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{c}</Link>
              ))}
            </Dropdown>
          )}

          {categories.sub.length > 0 && (
            <Dropdown
              label={t('site.subcategories')}
              trigger={<NavTrigger>{t('site.subcategories')}</NavTrigger>}
              panelClass="start-0 min-w-48"
            >
              {/* 8 rows (each 2.15rem tall) are visible, the rest scroll */}
              <div className="max-h-[17.2rem] overflow-y-auto overscroll-contain">
                {categories.sub.map((c) => (
                  <Link key={c} href={href(`/news?subcategory=${encodeURIComponent(c)}`)} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{c}</Link>
                ))}
              </div>
            </Dropdown>
          )}

          <Dropdown
            label={t('site.sections')}
            trigger={<NavTrigger>{t('site.sections')}</NavTrigger>}
            panelClass="start-0 min-w-48"
          >
            {secs.map((c) => (
              <a key={c} href={isHome ? `#sec-${c}` : `${href('/')}#sec-${c}`} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">
                {loc('sections_home', `${c}_title`) || t(`sec.${c}`)}
              </a>
            ))}
          </Dropdown>

          <NavDropdown label={t('site.services')} items={servicesItems} href={href} />

          <form onSubmit={submit} role="search" className="relative w-full xl:w-auto">
            <input value={q} onChange={(e) => typing(e.target.value)} placeholder={t('site.searchPlaceholder')} className="h-10 w-full rounded-full border border-transparent bg-gray-100/80 ps-4 pe-[4.25rem] text-sm outline-none transition-all duration-300 placeholder:text-gray-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20 xl:w-40 xl:focus:w-56 2xl:w-48" />
            {q && (
              <button type="button" onClick={clear} title={t('site.clearSearch')} aria-label={t('site.clearSearch')} className="absolute end-10 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-200 hover:text-gray-800">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            )}
            <button className="absolute end-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white transition hover:brightness-110 active:scale-95" aria-label={t('app.search')}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </button>
          </form>

          {me && <NavDropdown label={t('adm.content')} items={manageItems} href={href} />}
          {me && <NavDropdown label={t('adm.tools')} items={toolsItems} href={href} />}
          {me && <NavDropdown label={t('adm.security')} items={securityItems} href={href} />}

          {me && (
            <div className="flex flex-col gap-1 xl:hidden">
              <Link href={href('/profile')} onClick={() => setMenu(false)} className="rounded-full px-3.5 py-2 text-sm font-medium text-ink/80 transition hover:bg-primary/10 hover:text-primary">{t('site.profile')}</Link>
              <button onClick={async () => { setMenu(false); await logout(); router.push(href('/')); }} className="w-full rounded-full px-3.5 py-2 text-start text-sm font-medium text-red-600 transition hover:bg-red-50">{t('site.logout')}</button>
            </div>
          )}

          {me && (
            <div className="hidden xl:block">
              <Dropdown
                label={t('site.profile')}
                trigger={
                  <span title={me.fullName} aria-label={me.fullName} className="flex items-center rounded-full border border-line bg-white p-1 transition hover:border-primary">
                    {avatar}
                  </span>
                }
                panelClass="end-0 min-w-44"
              >
                <Link href={href('/profile')} className="block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary">{t('site.profile')}</Link>
                <button onClick={async () => { await logout(); router.push(href('/')); }} className="block w-full rounded-xl px-3 py-2 text-start text-sm text-red-600 transition hover:bg-red-50">{t('site.logout')}</button>
              </Dropdown>
            </div>
          )}

          <Link href={otherLangHref(pathname)} onClick={() => localStorage.setItem('lang', lang === 'ar' ? 'en' : 'ar')} title={t('site.language')} aria-label={t('site.language')} className="flex h-8 w-fit items-center justify-center gap-1.5 rounded-full border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-2.5 text-xs font-semibold text-primary shadow-sm transition hover:border-primary hover:from-primary hover:to-primary hover:text-white">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 7h11M10 4v3c0 5-3 8-6 10M7 11c1 2 3 4 5 5M14 19l4-10 4 10M15.5 16h5" />
            </svg>
            <span>{lang === 'ar' ? 'EN' : 'AR'}</span>
          </Link>

        </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { lang, t, href } = useI18n();
  const { s, loc, img, settings } = useSite();
  const [services, setServices] = useState<{ id: number; title: string }[]>([]);
  useEffect(() => {
    import('@/lib/api').then(({ api }) => api('/public/sections/SERVICES', { params: { lang } }).then((r: any) => setServices(r.slice(0, 6))).catch(() => {}));
  }, [lang]);
  const logo = img('branding', 'logo');
  const bg = custom(settings.appearance?.footer_background, ['#111827']);
  return (
    <footer className="no-print relative mt-10 overflow-hidden rounded-t-[2rem] text-gray-300" style={{ background: bg || 'color-mix(in srgb, var(--secondary) 94%, black)' }}>
      <div className="h-1 bg-gradient-to-r from-primary via-accent to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute -start-24 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--primary)_45%,transparent),transparent_70%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute -end-24 bottom-0 h-72 w-72 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--accent)_28%,transparent),transparent_70%)]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-4">
        <div>
          {logo && <img src={logo} alt="" className="mb-3 h-12 w-auto" />}
          <div className="mb-2 font-display text-lg font-bold text-white">{loc('branding', 'site_name')}</div>
          <p className="text-sm leading-7">{loc('branding', 'site_description')}</p>
          <div className="mt-4"><SocialLinks /></div>
        </div>
        <div>
          <h4 className="mb-4 flex items-center gap-2 font-bold text-white"><span className="h-4 w-1 rounded-full bg-accent" />{t('site.quickLinks')}</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href={href('/')} className="transition hover:text-white">{t('site.home')}</Link></li>
            <li><Link href={href('/news')} className="hover:text-white">{t('site.allNews')}</Link></li>
            <li><Link href={href('/sitemap')} className="hover:text-white">{t('site.sitemap')}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 flex items-center gap-2 font-bold text-white"><span className="h-4 w-1 rounded-full bg-accent" />{t('site.services')}</h4>
          <ul className="space-y-2 text-sm">{services.map((x) => <li key={x.id}>{x.title}</li>)}</ul>
        </div>
        <div>
          <h4 className="mb-4 flex items-center gap-2 font-bold text-white"><span className="h-4 w-1 rounded-full bg-accent" />{t('site.contact')}</h4>
          <ul className="space-y-2 text-sm">
            {s('contact', 'phone') && <li className="flex items-center gap-2"><ContactIcon name="phone" /><bdi dir="ltr">{s('contact', 'phone')}</bdi></li>}
            {s('contact', 'email') && <li className="flex items-center gap-2"><ContactIcon name="email" /><bdi dir="ltr">{s('contact', 'email')}</bdi></li>}
            {loc('contact', 'address') && <li className="flex items-center gap-2"><ContactIcon name="address" />{loc('contact', 'address')}</li>}
            {loc('contact', 'working_hours') && <li className="flex items-center gap-2"><ContactIcon name="hours" />{loc('contact', 'working_hours')}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-3 text-center text-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4">
          <span>© {new Date().getFullYear()} {loc('branding', 'site_name')} — {t('site.rights')}</span>
          <div className="flex gap-4">
            <Link href={href('/privacy')} className="hover:text-white">{t('site.privacy')}</Link>
            <Link href={href('/terms')} className="hover:text-white">{t('site.terms')}</Link>
            <Link href={href('/sitemap')} className="hover:text-white">{t('site.sitemap')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function BackToTop() {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const h = () => setShow(window.scrollY > 300);
    h();
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`no-print fixed bottom-5 end-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white shadow-lift transition duration-300 hover:-translate-y-0.5 active:scale-95 ${show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}
      aria-label={t('site.backTop')}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 19V5" /></svg>
    </button>
  );
}
