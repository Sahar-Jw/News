'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { fmtNum } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { G2tProvider, useGet2Trade } from './context';

/** the tabs of the Get2Trade page: every one is its own nested page (the first one is the page itself) */
export const G2T_TABS = [
  { key: 'about', path: '', label: 'gt.about' },
  { key: 'services', path: '/services', label: 'gt.services' },
  { key: 'packages', path: '/packages', label: 'gt.packages' },
  { key: 'spaces', path: '/spaces', label: 'gt.spaces' },
  { key: 'news', path: '/news', label: 'gt.news' },
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  const { t, href, lang } = useI18n();
  const { page, openForm } = useGet2Trade();
  const path = (usePathname() ?? '').replace(/^\/(ar|en)(?=\/|$)/, '').replace(/\/+$/, '');
  const active = G2T_TABS.find((x) => x.path && path === `/get2trade${x.path}`)?.key ?? 'about';
  const count = (k: string) => (k === 'packages' ? page?.packages.length : k === 'spaces' ? page?.spaces.length : 0) || 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <nav aria-label="breadcrumb" className="text-sm text-gray-500">
        <Link href={href('/')} className="hover:text-primary">{t('site.home')}</Link><span className="mx-1.5">›</span>
        {active === 'about' ? <span className="text-ink">{t('gt.title')}</span> : <><Link href={href('/get2trade')} className="hover:text-primary">{t('gt.title')}</Link><span className="mx-1.5">›</span><span className="text-ink">{t(G2T_TABS.find((x) => x.key === active)!.label)}</span></>}
      </nav>

      <header className="rounded-3xl bg-gradient-to-l from-secondary to-primary p-6 text-white shadow-lift md:p-10">
        <h1 className="text-2xl font-extrabold md:text-3xl">{t('gt.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-white/85">{t('gt.subtitle')}</p>
        {page && !page.isOpen && <p role="status" className="mt-4 inline-block rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">{t('gt.closed')}</p>}
      </header>

      {/* control bar: the tabs and the booking buttons, always within reach while scrolling */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-3xl bg-white/90 px-2 py-1.5 shadow-card ring-1 ring-line backdrop-blur sm:flex-nowrap sm:rounded-full">
        <nav aria-label={t('gt.title')} className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {G2T_TABS.map((x) => (
            <Link key={x.key} href={href(`/get2trade${x.path}`)} aria-current={active === x.key ? 'page' : undefined}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${active === x.key ? 'bg-secondary text-white' : 'text-secondary hover:bg-primary/10 hover:text-primary'}`}>
              {t(x.label)}
              {count(x.key) > 0 && <span className={`rounded-full px-1.5 text-[11px] ${active === x.key ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>{fmtNum(lang, count(x.key))}</span>}
            </Link>
          ))}
        </nav>
        {page && (
          <div className="flex shrink-0 items-center gap-2 ps-1">
            {page.isOpen && <button type="button" onClick={() => openForm('booking')} className="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white shadow-card transition hover:-translate-y-px hover:shadow-lift">{t('gt.bookNow')}</button>}
            <button type="button" onClick={() => openForm('inquiry')} className="rounded-full border border-primary/50 px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/10">{t('gt.inquire')}</button>
          </div>
        )}
      </div>

      {page ? children : <Center><Spinner /></Center>}
    </div>
  );
}

/** layout of every Get2Trade page: shared header, control bar with the tabs, and the data / booking form they all use */
export function Get2TradeFrame({ children }: { children: React.ReactNode }) {
  return <G2tProvider><Shell>{children}</Shell></G2tProvider>;
}
