'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { SECTIONS, cn } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { SiteProvider } from '@/components/site/site-context';
import { BackToTop, Footer, Navbar, TopBar } from '@/components/site/shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, can, logout } = useAuth();
  const { t, href, lang, otherLangHref } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => { if (!loading && !me) router.replace(href('/login')); }, [loading, me, router, href]);
  useEffect(() => setOpen(false), [pathname]);
  if (loading || !me) return <Center><Spinner /></Center>;

  const items: { label: string; to: string; show: boolean; sub?: boolean }[] = [
    { label: t('adm.dashboard'), to: '/admin', show: true },
    { label: t('adm.news'), to: '/admin/news', show: can('news.read') },
    ...SECTIONS.map((s) => ({ label: t(`section.${s}`), to: `/admin/sections/${s}`, show: can('news.read'), sub: true })),
    { label: t('adm.messages'), to: '/admin/messages', show: can('messages.read') },
    { label: t('adm.users'), to: '/admin/users', show: can('users.read') },
    { label: `${t('adm.roles')} / ${t('adm.permissions')}`, to: '/admin/roles', show: can('roles.manage', 'permissions.read', 'permissions.assign') },
    { label: t('adm.settings'), to: '/admin/settings', show: can('settings.read') },
    { label: t('adm.cities'), to: '/admin/cities', show: can('cities.manage') },
    { label: t('adm.audit'), to: '/admin/audit', show: can('audit.read') },
  ];
  const active = (to: string) => { const p = href(to); return to === '/admin' ? pathname === p : pathname.startsWith(p.replace(/\/$/, '')); };

  return (
    <SiteProvider>
      <div className="min-h-screen bg-gray-100">
        <TopBar />
        <Navbar />
        <div className="flex min-h-[70vh]">
          <aside className={cn('no-print fixed inset-y-0 start-0 z-40 w-64 overflow-y-auto bg-secondary p-4 text-gray-200 transition-transform md:static md:translate-x-0', open ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full')}>
            <div className="mb-6 text-lg font-bold text-white">{t('adm.title')}</div>
            <nav className="space-y-1">
              {items.filter((i) => i.show).map((i) => (
                <Link key={i.to} href={href(i.to)} className={cn('block rounded-lg px-3 py-2 text-sm hover:bg-white/10', i.sub && 'ms-4 text-xs', active(i.to) && 'bg-primary text-white')}>{i.label}</Link>
              ))}
            </nav>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="no-print flex items-center gap-3 border-b bg-white px-4 py-2">
              <button className="rounded border px-2 py-1 md:hidden" onClick={() => setOpen(!open)} aria-label="menu">☰</button>
              <Link href={href('/')} className="text-sm text-primary">{t('adm.visitSite')} ↗</Link>
              <div className="ms-auto flex items-center gap-3 text-sm">
                <Link href={href('/admin/profile')} className="hover:underline">{me.fullName}</Link>
                <Link href={otherLangHref(pathname)} onClick={() => localStorage.setItem('lang', lang === 'ar' ? 'en' : 'ar')} className="rounded border px-2 py-1">{t('site.language')}</Link>
                <button onClick={async () => { await logout(); router.push(href('/')); }} className="rounded border px-2 py-1 text-red-600">{t('site.logout')}</button>
              </div>
            </header>
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
        <Footer />
        <BackToTop />
      </div>
    </SiteProvider>
  );
}
