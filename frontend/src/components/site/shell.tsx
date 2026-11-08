'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useSite } from './site-context';
import { useNavGroups } from './use-nav';
import { useFooterGroups, type FooterLinkItem } from './use-footer';
import { FooterNewsletter } from './footer-newsletter';
import { SECTIONS, newsPerm, prettyUrl, telHref } from '@/lib/utils';
import { HUB_PERMS } from '@/lib/hubs-meta';
import { ContactIcon, SocialIcon } from './icons';

type NavItem = { label: string; to: string; show: boolean; newTab?: boolean };
type AdminGroup = { key: string; label: string; items: NavItem[] };

function NavTrigger({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex cursor-default items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold text-ink/80 transition duration-200 hover:bg-primary/10 hover:text-primary">
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

function Dropdown({ label, trigger, panelClass, children, mobileChildren }: { label: string; trigger: React.ReactNode; panelClass: string; children: React.ReactNode; mobileChildren?: React.ReactNode }) {
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
          <div onClickCapture={(e) => { if (!(e.target as HTMLElement).closest('[data-keep-open]')) dismiss(); }} className="rounded-2xl bg-white/95 p-2 shadow-lift ring-1 ring-line backdrop-blur-xl">{children}</div>
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
            <div onClickCapture={(e) => { if (!(e.target as HTMLElement).closest('[data-keep-open]')) dismiss(); }} className="mt-1 w-full rounded-2xl border border-line bg-white p-1.5 shadow-card">{mobileChildren ?? children}</div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Every dropdown shows at most 8 links (8 rows of 2.25rem); the rest scrolls inside the panel. */
const SCROLL_PANEL = 'max-h-72 overflow-y-auto overscroll-contain';
const ROW = 'block rounded-xl px-3 py-2 text-sm transition hover:bg-primary/10 hover:text-primary';

/** One link of a dropdown: a site path stays in the site (language prefix added), a full address opens as given. */
function NavLink({ item, href }: { item: NavItem; href: (p: string) => string }) {
  if (/^https?:\/\//i.test(item.to)) return <a href={item.to} target={item.newTab ? '_blank' : undefined} rel={item.newTab ? 'noopener noreferrer' : undefined} className={ROW}>{item.label}</a>;
  return <Link href={href(item.to)} target={item.newTab ? '_blank' : undefined} className={ROW}>{item.label}</Link>;
}

/** Hover dropdown used for the public menu groups (same look as the other nav dropdowns). */
function NavDropdown({ label, items, href }: { label: string; items: NavItem[]; href: (p: string) => string }) {
  const visible = items.filter((i) => i.show);
  if (visible.length === 0) return null;
  return (
    <Dropdown
      label={label}
      trigger={<NavTrigger>{label}</NavTrigger>}
      panelClass="start-0 min-w-52"
    >
      <div className={SCROLL_PANEL}>
        {visible.map((i) => <NavLink key={i.to + i.label} item={i} href={href} />)}
      </div>
    </Dropdown>
  );
}

/**
 * The one Admin dropdown (Content / Settings & security as sub-dropdowns). On large screens each sub-dropdown opens beside the panel (to the right in
 * Arabic, to the left in English, so it never runs off the screen) while the pointer or keyboard focus is on its row; on small screens
 * the groups collapse as an accordion (one at a time, or at once when there is only one). Every sub-dropdown shows at most 8 rows
 * and scrolls after that. Items appear only for holders of their permission (UI hint only - the API enforces every permission).
 */
function AdminMenu({ label, groups, href }: { label: string; groups: AdminGroup[]; href: (p: string) => string }) {
  const [open, setOpen] = useState<string | null>(null); // small screens only
  const shown = groups.map((g) => ({ ...g, items: g.items.filter((i) => i.show) })).filter((g) => g.items.length > 0);
  if (shown.length === 0) return null;
  const current = shown.length === 1 ? shown[0].key : open;

  const desktop = (
    <div>
      {shown.map((g) => (
        <div key={g.key} className="group/sub relative">
          <button
            type="button"
            aria-haspopup="true"
            data-keep-open
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-start text-sm font-bold text-secondary transition hover:bg-primary/10 hover:text-primary group-hover/sub:bg-primary/10 group-hover/sub:text-primary group-focus-within/sub:bg-primary/10 group-focus-within/sub:text-primary"
          >
            <span>{g.label}</span>
            {/* points toward the side the sub-dropdown opens on */}
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 rtl:rotate-180"><path d="m10 3-5 5 5 5" /></svg>
          </button>
          <div className="invisible absolute end-full top-0 z-50 pe-1 opacity-0 transition-[opacity,visibility] duration-150 group-hover/sub:visible group-hover/sub:opacity-100 group-focus-within/sub:visible group-focus-within/sub:opacity-100">
            <div className="min-w-56 rounded-2xl bg-white p-2 shadow-lift ring-1 ring-line">
              <div className={SCROLL_PANEL}>{g.items.map((i) => <NavLink key={i.to} item={i} href={href} />)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const mobile = (
    <div className={SCROLL_PANEL}>
      {shown.map((g) => {
        const on = current === g.key;
        return (
          <div key={g.key}>
            <button
              type="button"
              data-keep-open
              aria-expanded={on}
              onClick={() => setOpen(on ? null : g.key)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-sm font-bold transition hover:bg-primary/10 hover:text-primary ${on ? 'bg-primary/10 text-primary' : 'text-secondary'}`}
            >
              <span>{g.label}</span>
              <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 transition-transform duration-200 ${on ? 'rotate-180' : ''}`}><path d="m3 6 5 5 5-5" /></svg>
            </button>
            {on && <div className="mb-1 ms-3 border-s-2 border-accent/50 ps-1">{g.items.map((i) => <NavLink key={i.to} item={i} href={href} />)}</div>}
          </div>
        );
      })}
    </div>
  );

  return <Dropdown label={label} trigger={<NavTrigger>{label}</NavTrigger>} panelClass="start-0 min-w-52" mobileChildren={mobile}>{desktop}</Dropdown>;
}

function SocialLinks() {
  const { s } = useSite();
  const keys = ['facebook_url', 'x_url', 'instagram_url', 'linkedin_url', 'youtube_url', 'whatsapp_url', 'telegram_url'];
  return (
    <div className="flex items-center gap-2">
      {keys.map((k) => {
        const v = s('social', k);
        return v ? (
          <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition hover:-translate-y-px hover:bg-white/30" aria-label={k.replace('_url', '')} title={k.replace('_url', '')}>
            <SocialIcon name={k} />
          </a>
        ) : null;
      })}
    </div>
  );
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
  const mobile = s('contact', 'mobile');
  const email = s('contact', 'email');
  const website = s('contact', 'website_url');
  const addr = loc('contact', 'address');
  return (
    <div className="no-print border-b border-accent/40 bg-gradient-to-r from-secondary via-secondary to-primary text-xs text-white/90">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex flex-wrap items-center gap-4">
          {now && <span className="flex items-center gap-1.5"><ContactIcon name="date" />{now}</span>}
          {phone && <a href={telHref(phone)} className="flex items-center gap-1.5"><ContactIcon name="phone" /><bdi dir="ltr">{phone}</bdi></a>}
          {mobile && <a href={telHref(mobile)} className="flex items-center gap-1.5"><ContactIcon name="mobile" /><bdi dir="ltr">{mobile}</bdi></a>}
          {email && <a href={`mailto:${email}`} className="flex items-center gap-1.5"><ContactIcon name="email" /><bdi dir="ltr">{email}</bdi></a>}
          {website && <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5"><ContactIcon name="website" /><bdi dir="ltr">{prettyUrl(website)}</bdi></a>}
          {addr && <span className="flex items-center gap-1.5"><ContactIcon name="address" />{addr}</span>}
        </div>
        <SocialLinks />
      </div>
    </div>
  );
}

export function Navbar() {
  const { lang, t, href, otherLangHref } = useI18n();
  const { loc, img } = useSite();
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
  const isHome = pathname === `/${lang}/` || pathname === `/${lang}`;

  // Extra dropdowns for logged-in users. Each item only appears if the user holds the permission
  // (UI hint only - the API still enforces every permission).
  const manageItems: NavItem[] = [
    { label: t('adm.news'), to: '/admin/news', show: can(newsPerm('read')) },
    ...SECTIONS.map((s) => ({ label: t(`section.${s}`), to: `/admin/sections/${s}`, show: can(newsPerm('read', s)) })),
    { label: t('adm.messages'), to: '/admin/messages', show: can('messages.read') },
  ];
  // Public dropdowns: managed in Settings -> Main menu (loaded from the API).
  const navGroups = useNavGroups(lang, t);
  const groups = (navGroups ?? []).map((g) => ({ key: String(g.id), label: g.title, items: g.items.map((i): NavItem => ({ label: i.title, to: i.url, show: true, newTab: i.newTab })) }));
  // Settings is the hub of every page of the site (courses, trainers, trainees, expo, membership ...): it is listed for anyone who can open at least one of its tabs.
  const securityItems: NavItem[] = [
    { label: t('adm.users'), to: '/admin/users', show: can('users.read') },
    { label: `${t('adm.roles')} / ${t('adm.permissions')}`, to: '/admin/roles', show: can('roles.read', 'permissions.read', 'permissions.assign') },
    { label: t('adm.settings'), to: '/admin/settings', show: can(...HUB_PERMS) },
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

  // icon-only search: click the icon to expand the field; it folds back when empty and unfocused
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (q) setSearchOpen(true); }, [q]);
  const toggleSearch = () => {
    if (!searchOpen) { setSearchOpen(true); requestAnimationFrame(() => searchInput.current?.focus()); return; }
    if (q.trim().length >= 2) { clearTimeout(timer.current); goSearch(q); return; }
    setSearchOpen(false);
  };
  const onSearchBlur = (e: React.FocusEvent<HTMLFormElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !q.trim()) setSearchOpen(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    clearTimeout(timer.current);
    goSearch(q);
  };

  return (
    <header className={`no-print sticky top-0 z-40 border-b border-accent/35 backdrop-blur-xl transition-shadow duration-300 ${scrolled ? 'shadow-card' : ''}`} style={{ background: 'var(--header-bg, color-mix(in srgb, var(--canvas) 88%, transparent))' }}>
      <div className={`mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 transition-all duration-300 xl:flex-nowrap xl:gap-x-4 ${scrolled ? 'py-1' : 'py-2.5'}`}>
        <Link href={href('/')} className="flex min-w-0 max-w-full shrink items-center gap-3 xl:min-w-[9rem]">
          {/* round logo with a 2px white border; it grows smoothly when hovered (and sits above the header content while doing so) */}
          {logo && <img src={logo} alt="" className={`relative z-10 shrink-0 origin-center rounded-full border-2 border-white bg-white object-cover shadow-md ring-1 ring-accent/50 transition-[width,height,transform,box-shadow] duration-300 ease-out hover:scale-125 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:scale-100 ${scrolled ? 'h-9 w-9' : 'h-10 w-10'}`} />}
          <div className="min-w-0">
            {/* the name wraps (max two lines) beside the logo, so the menu never drops to a second row; longer name = smaller text */}
            <div className="line-clamp-2 break-words py-0.5 font-display font-bold leading-[1.75] text-secondary" style={{ fontSize: `${Math.max(0.85, 1.125 - Math.max(0, loc('branding', 'site_name').length - 14) * 0.012).toFixed(3)}rem` }}>{loc('branding', 'site_name')}</div>
            {loc('branding', 'site_description') && <div className="max-w-[16rem] truncate text-xs text-gray-500">{loc('branding', 'site_description')}</div>}
          </div>
        </Link>

        <div className="ms-auto flex shrink-0 items-center gap-2 xl:hidden">
          {me && <Link href={href('/profile')} aria-label={t('site.profile')} className="flex items-center rounded-full border border-line bg-white p-1 transition hover:border-primary">{avatar}</Link>}
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white" onClick={() => setMenu((open) => !open)} aria-label={t('app.menu')} aria-expanded={menu} aria-controls={menuPanelId}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={`transition-transform duration-300 ${menu ? 'rotate-90' : ''}`}>{menu ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>

        <div id={menuPanelId} data-open={menu} className="grid w-full grid-rows-[0fr] -translate-y-2 opacity-0 pointer-events-none invisible transition-[grid-template-rows,opacity,transform,visibility] duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-[0ms,0ms,0ms,350ms] data-[open=true]:grid-rows-[1fr] data-[open=true]:translate-y-0 data-[open=true]:opacity-100 data-[open=true]:pointer-events-auto data-[open=true]:visible data-[open=true]:delay-[0ms] xl:contents xl:translate-y-0 xl:opacity-100 xl:pointer-events-auto xl:visible xl:transition-none">
          <div className="min-h-0 max-h-[calc(100dvh-5rem)] overflow-y-auto overflow-x-hidden overscroll-contain pb-3 xl:contents xl:max-h-none xl:overflow-visible xl:pb-0">
        <nav onClick={(e) => { if (window.matchMedia('(max-width: 1279px)').matches && (e.target as HTMLElement).closest('a')) setMenu(false); }} className="flex w-full flex-col gap-1 xl:ms-auto xl:w-auto xl:shrink-0 xl:flex-row xl:items-center xl:gap-1">
          <Link href={href('/')} className={`w-full rounded-full px-3.5 py-2 text-start text-sm font-semibold transition duration-200 hover:bg-primary/10 hover:text-primary xl:w-auto ${isHome ? 'bg-primary/10 text-primary ring-1 ring-primary/15' : 'text-ink/80'}`}>{t('site.home')}</Link>

          {groups.map((g) => <NavDropdown key={g.key} label={g.label} items={g.items} href={href} />)}

          <Link href={href('/contact')} className={`w-full rounded-full px-3.5 py-2 text-start text-sm font-semibold transition duration-200 hover:bg-primary/10 hover:text-primary xl:w-auto ${/\/contact\/?$/.test(pathname) ? 'bg-primary/10 text-primary ring-1 ring-primary/15' : 'text-ink/80'}`}>{t('contact.title')}</Link>


          {me && <AdminMenu label={t('adm.admin')} groups={[{ key: 'content', label: t('adm.content'), items: manageItems }, { key: 'security', label: t('adm.security'), items: securityItems }]} href={href} />}

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

          <form onSubmit={submit} onBlur={onSearchBlur} role="search" className="relative order-first h-10 w-full xl:order-none xl:w-10">
            <div className={`flex h-10 items-center overflow-hidden rounded-full transition-[width,background-color,box-shadow] duration-300 ease-out xl:absolute xl:end-0 xl:top-0 xl:z-50 ${searchOpen ? 'w-full bg-white shadow-lift ring-1 ring-primary/30 xl:w-72' : 'w-10 bg-primary/[0.08] hover:bg-primary/15'}`}>
              <input
                ref={searchInput}
                value={q}
                onChange={(e) => typing(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') { if (q) clear(); setSearchOpen(false); (e.target as HTMLInputElement).blur(); } }}
                placeholder={t('site.searchPlaceholder')}
                aria-label={t('app.search')}
                tabIndex={searchOpen ? 0 : -1}
                className={`h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 ${searchOpen ? 'ps-4' : 'pointer-events-none w-0 p-0'}`}
              />
              {q && searchOpen && (
                <button type="button" onClick={() => { clear(); searchInput.current?.focus(); }} title={t('site.clearSearch')} aria-label={t('site.clearSearch')} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-200 hover:text-gray-800">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              )}
              <button type="button" onClick={toggleSearch} aria-label={t('app.search')} aria-expanded={searchOpen} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary transition hover:scale-110">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              </button>
            </div>
          </form>

        </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

const FOOT_LINK = 'transition hover:text-white';
const SPAN: Record<number, string> = { 1: 'lg:col-span-1', 2: 'sm:col-span-2 lg:col-span-2' };

function FootTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-4 flex items-center gap-2 text-base font-bold text-white"><span className="h-4 w-1 rounded-full bg-accent" />{children}</h4>;
}

/** One link of the footer: a site path stays in the site (language prefix added), a full address opens as given. */
function FootLink({ item, href }: { item: FooterLinkItem; href: (p: string) => string }) {
  if (/^https?:\/\//i.test(item.url)) return <a href={item.url} target={item.newTab ? '_blank' : undefined} rel={item.newTab ? 'noopener noreferrer' : undefined} className={FOOT_LINK}>{item.title}</a>;
  return <Link href={href(item.url)} target={item.newTab ? '_blank' : undefined} className={FOOT_LINK}>{item.title}</Link>;
}

/**
 * Footer: the link columns (and the official links / legal links) come from Settings -> Footer, the contact column from Settings ->
 * Contact / Social, and the titles, newsletter text, tagline and rights line from Settings -> Footer (texts). A column with
 * "two lines" is wider and lays its links out in two columns side by side, so a long list does not make the footer tall.
 */
export function Footer() {
  const { lang, t, href } = useI18n();
  const { s, loc } = useSite();
  const groups = useFooterGroups(lang) ?? [];
  const columns = groups.filter((g) => g.kind === 'links');
  const official = groups.find((g) => g.kind === 'official');
  const legal = groups.filter((g) => g.kind === 'legal').flatMap((g) => g.items);
  const hasSocial = ['facebook_url', 'x_url', 'instagram_url', 'linkedin_url', 'youtube_url', 'whatsapp_url', 'telegram_url'].some((k) => s('social', k));
  const showNewsletter = String(s('footer', 'show_newsletter')) !== 'false';
  const tagline = loc('footer', 'tagline');
  const rights = loc('footer', 'rights');
  const phone = s('contact', 'phone');
  const mobile = s('contact', 'mobile');
  const email = s('contact', 'email');
  const address = loc('contact', 'address');
  const hours = loc('contact', 'working_hours');

  return (
    <footer className="no-print relative mt-10 overflow-hidden rounded-t-[2rem] text-stone-200" style={{ background: 'var(--footer-bg, color-mix(in srgb, var(--secondary) 94%, black))' }}>
      <div className="h-1 bg-gradient-to-r from-primary via-accent to-transparent" aria-hidden="true" />
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="corner-light pointer-events-none absolute inset-0 opacity-60 rtl:-scale-x-100" aria-hidden="true" />
      <div className="sheen" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-x-8 gap-y-9 px-4 py-10 sm:grid-cols-2 lg:grid-cols-6">
        {columns.map((g) => (
          <div key={g.id} className={SPAN[g.columns] ?? SPAN[1]}>
            <FootTitle>{g.title}</FootTitle>
            <ul className={`text-sm text-stone-300 ${g.columns === 2 ? 'grid grid-cols-2 gap-x-6 gap-y-2.5' : 'space-y-2.5'}`}>
              {g.items.map((i) => <li key={i.id}><FootLink item={i} href={href} /></li>)}
            </ul>
          </div>
        ))}

        <div className="sm:col-span-2 lg:col-span-2">
          <FootTitle>{loc('footer', 'contact_title') || t('site.contact')}</FootTitle>
          <ul className="space-y-2.5 text-sm text-stone-300">
            {address && <li className="flex items-start gap-2"><ContactIcon name="address" /><span>{address}</span></li>}
            {phone && <li><a href={telHref(phone)} className={`flex items-center gap-2 ${FOOT_LINK}`}><ContactIcon name="phone" /><bdi dir="ltr">{phone}</bdi></a></li>}
            {mobile && <li><a href={telHref(mobile)} className={`flex items-center gap-2 ${FOOT_LINK}`}><ContactIcon name="mobile" /><bdi dir="ltr">{mobile}</bdi></a></li>}
            {email && <li><a href={`mailto:${email}`} className={`flex items-center gap-2 ${FOOT_LINK}`}><ContactIcon name="email" /><bdi dir="ltr">{email}</bdi></a></li>}
            {hours && <li className="flex items-start gap-2"><ContactIcon name="hours" /><span>{hours}</span></li>}
          </ul>
          {hasSocial && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-white">{loc('footer', 'social_title')}</span>
              <SocialLinks />
            </div>
          )}
          {official && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-bold text-white">{official.title}</div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-stone-300">{official.items.map((i) => <li key={i.id}><FootLink item={i} href={href} /></li>)}</ul>
            </div>
          )}
          {showNewsletter && (
            <div className="mt-4">
              <div className="text-xs font-bold text-white">{loc('footer', 'newsletter_title')}</div>
              {loc('footer', 'newsletter_text') && <p className="mb-2 mt-0.5 text-xs text-stone-400">{loc('footer', 'newsletter_text')}</p>}
              <FooterNewsletter />
            </div>
          )}
        </div>
      </div>

      <div className="relative border-t border-white/10 py-4 text-center text-xs">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 px-4">
          {tagline && <span className="text-sm font-bold text-white">{tagline}</span>}
          {rights && <span className="text-stone-300">{rights}</span>}
          {legal.length > 0 && <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">{legal.map((i) => <FootLink key={i.id} item={i} href={href} />)}</div>}
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
