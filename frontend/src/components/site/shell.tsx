'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useSite } from './site-context';
import { SECTION_ORDER_KEYS } from './sections-meta';
import { SECTIONS } from '@/lib/utils';

type NavItem = { label: string; to: string; show: boolean };

/** Hover dropdown used for the permission-based menus (same look as the other nav dropdowns). */
function NavDropdown({ label, items, href }: { label: string; items: NavItem[]; href: (p: string) => string }) {
  const visible = items.filter((i) => i.show);
  if (visible.length === 0) return null;
  return (
    <div className="group relative">
      <button type="button" className="block cursor-pointer rounded px-3 py-2 text-sm font-medium hover:bg-gray-100">{label} ▾</button>
      <div className="invisible absolute start-0 top-full z-50 min-w-52 rounded-lg border bg-white py-1 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        {visible.map((i) => (
          <Link key={i.to} href={href(i.to)} className="block px-4 py-2 text-sm hover:bg-gray-50">{i.label}</Link>
        ))}
      </div>
    </div>
  );
}

function SocialLinks() {
  const { s } = useSite();
  const items: [string, string][] = [['facebook_url', 'f'], ['x_url', '𝕏'], ['instagram_url', 'ig'], ['linkedin_url', 'in'], ['youtube_url', '▶'], ['whatsapp_url', 'wa']];
  return (
    <div className="flex items-center gap-2">
      {items.map(([k, ic]) => {
        const v = s('social', k);
        return v ? (
          <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[10px] hover:bg-white/30" aria-label={k}>
            {ic}
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
  const addr = loc('contact', 'address');
  return (
    <div className="no-print bg-secondary text-xs text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5">
        <div className="flex flex-wrap items-center gap-4">
          <span>{now}</span>
          {phone && <a href={`tel:${phone}`} dir="ltr">☎ {phone}</a>}
          {addr && <span>⚲ {addr}</span>}
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
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const logo = img('branding', 'logo');
  const secs = SECTION_ORDER_KEYS.filter((c) => settings.sections_home?.[`${c}_visible`] !== false && c !== 'hero')
    .sort((a, b) => (settings.sections_home?.[`${a}_order`] ?? 99) - (settings.sections_home?.[`${b}_order`] ?? 99));
  const isHome = pathname === `/${lang}/` || pathname === `/${lang}`;

  // Extra dropdowns for logged-in users. Each item only appears if the user holds the permission
  // (UI hint only - the API still enforces every permission).
  const manageItems: NavItem[] = [
    { label: t('adm.news'), to: '/admin/news', show: can('news.read') },
    ...SECTIONS.map((s) => ({ label: t(`section.${s}`), to: `/admin/sections/${s}`, show: can('news.read') })),
    { label: t('adm.messages'), to: '/admin/messages', show: can('messages.read') },
  ];
  const securityItems: NavItem[] = [
    { label: t('adm.users'), to: '/admin/users', show: can('users.read') },
    { label: `${t('adm.roles')} / ${t('adm.permissions')}`, to: '/admin/roles', show: can('roles.manage', 'permissions.read', 'permissions.assign') },
    { label: t('adm.settings'), to: '/admin/settings', show: can('settings.read') },
    { label: t('adm.cities'), to: '/admin/cities', show: can('cities.manage') },
    { label: t('adm.audit'), to: '/admin/audit', show: can('audit.read') },
  ];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length >= 2) router.push(href(`/search?q=${encodeURIComponent(q.trim())}`));
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b bg-white shadow-sm" style={{ background: settings.appearance?.header_background || undefined }}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
        <Link href={href('/')} className="flex items-center gap-3">
          {logo && <img src={logo} alt="" className="h-12 w-auto" />}
          <div className="leading-tight">
            <div className="text-lg font-bold text-primary">{loc('branding', 'site_name')}</div>
            {loc('branding', 'site_description') && <div className="max-w-[16rem] truncate text-xs text-gray-500">{loc('branding', 'site_description')}</div>}
          </div>
        </Link>

        <button className="ms-auto rounded border px-2 py-1 md:hidden" onClick={() => setMenu(!menu)} aria-label="menu">☰</button>

        <nav className={`${menu ? 'flex' : 'hidden'} w-full flex-col gap-1 md:ms-auto md:flex md:w-auto md:flex-row md:items-center md:gap-1`}>
          <Link href={href('/')} className="rounded px-3 py-2 text-sm font-medium hover:bg-gray-100">{t('site.home')}</Link>

          {categories.main.length > 0 && (
            <div className="group relative">
              <Link href={href('/news')} className="block rounded px-3 py-2 text-sm font-medium hover:bg-gray-100">{t('site.categories')} ▾</Link>
              <div className="invisible absolute start-0 top-full z-50 min-w-48 rounded-lg border bg-white py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                {categories.main.map((c) => (
                  <Link key={c} href={href(`/news?category=${encodeURIComponent(c)}`)} className="block px-4 py-2 text-sm hover:bg-gray-50">{c}</Link>
                ))}
              </div>
            </div>
          )}

          {categories.sub.length > 0 && (
            <div className="group relative">
              <span className="block cursor-pointer rounded px-3 py-2 text-sm font-medium hover:bg-gray-100">{t('site.subcategories')} ▾</span>
              <div className="invisible absolute start-0 top-full z-50 min-w-48 rounded-lg border bg-white py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                {categories.sub.map((c) => (
                  <Link key={c} href={href(`/news?subcategory=${encodeURIComponent(c)}`)} className="block px-4 py-2 text-sm hover:bg-gray-50">{c}</Link>
                ))}
              </div>
            </div>
          )}

          <div className="group relative">
            <span className="block cursor-pointer rounded px-3 py-2 text-sm font-medium hover:bg-gray-100">{t('site.sections')} ▾</span>
            <div className="invisible absolute start-0 top-full z-50 min-w-48 rounded-lg border bg-white py-1 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              {secs.map((c) => (
                <a key={c} href={isHome ? `#sec-${c}` : `${href('/')}#sec-${c}`} className="block px-4 py-2 text-sm hover:bg-gray-50">
                  {loc('sections_home', `${c}_title`) || t(`sec.${c}`)}
                </a>
              ))}
            </div>
          </div>

          <form onSubmit={submit} className="flex">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('site.searchPlaceholder')} className="w-36 rounded-s-lg border px-3 py-1.5 text-sm outline-none focus:border-primary lg:w-48" />
            <button className="rounded-e-lg bg-primary px-3 text-sm text-white" aria-label={t('app.search')}>⌕</button>
          </form>

          <Link href={otherLangHref(pathname)} onClick={() => localStorage.setItem('lang', lang === 'ar' ? 'en' : 'ar')} className="rounded border px-3 py-1.5 text-sm font-medium hover:bg-gray-100">
            {t('site.language')}
          </Link>

          {me && <NavDropdown label={t('adm.content')} items={manageItems} href={href} />}
          {me && <NavDropdown label={t('adm.security')} items={securityItems} href={href} />}

          {me && (
            <div className="group relative">
              <button type="button" title={me.fullName} aria-label={me.fullName} className="flex items-center rounded-full border p-1 hover:bg-gray-50">
                {me.avatarUrl ? <img src={fileUrl(me.avatarUrl)} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-white">{me.fullName.slice(0, 1)}</span>}
              </button>
              <div className="invisible absolute end-0 top-full z-50 min-w-44 rounded-lg border bg-white py-1 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <Link href={href('/profile')} className="block px-4 py-2 text-sm hover:bg-gray-50">{t('site.profile')}</Link>
                <button onClick={async () => { await logout(); router.push(href('/')); }} className="block w-full px-4 py-2 text-start text-sm text-red-600 hover:bg-gray-50">{t('site.logout')}</button>
              </div>
            </div>
          )}
        </nav>
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
  const map = s('contact', 'map_url');
  const bg = settings.appearance?.footer_background;
  return (
    <footer className="no-print mt-16 text-gray-300" style={{ background: bg || '#111827' }}>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          {logo && <img src={logo} alt="" className="mb-3 h-12 w-auto" />}
          <div className="mb-2 text-lg font-bold text-white">{loc('branding', 'site_name')}</div>
          <p className="text-sm leading-7">{loc('branding', 'site_description')}</p>
        </div>
        <div>
          <h4 className="mb-3 font-bold text-white">{t('site.quickLinks')}</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href={href('/')} className="hover:text-white">{t('site.home')}</Link></li>
            <li><Link href={href('/news')} className="hover:text-white">{t('site.allNews')}</Link></li>
            <li><Link href={href('/sitemap')} className="hover:text-white">{t('site.sitemap')}</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-bold text-white">{t('site.services')}</h4>
          <ul className="space-y-2 text-sm">{services.map((x) => <li key={x.id}>{x.title}</li>)}</ul>
        </div>
        <div>
          <h4 className="mb-3 font-bold text-white">{t('site.contact')}</h4>
          <ul className="space-y-2 text-sm">
            {s('contact', 'phone') && <li dir="ltr" className="text-start">☎ {s('contact', 'phone')}</li>}
            {s('contact', 'email') && <li>✉ {s('contact', 'email')}</li>}
            {loc('contact', 'address') && <li>⚲ {loc('contact', 'address')}</li>}
            {loc('contact', 'working_hours') && <li>⏱ {loc('contact', 'working_hours')}</li>}
          </ul>
          {map && <iframe src={map} title="map" loading="lazy" className="mt-3 h-28 w-full rounded border-0" />}
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs">
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
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);
  if (!show) return null;
  return (
    <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="no-print fixed bottom-5 end-5 z-40 h-11 w-11 rounded-full bg-primary text-xl text-white shadow-lg" aria-label={t('site.backTop')}>↑</button>
  );
}
