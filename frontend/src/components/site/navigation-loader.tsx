'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getActiveApiRequests, markUserAction, msUntilSlowRequest, subscribeToApiRequests } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { PageLoaderOverlay } from '@/components/ui/page-loader';
import { BRAND_DEFAULTS, brandOf, type Brand } from '@/lib/branded';

type PendingNavigation = { target: string; arrived: boolean };

/** A clicked link: the full-screen loader appears only if the new page has still not arrived after this long (ms). */
const NAV_DELAY = 700;
/** A request somebody is waiting for (started right after a click / submit / change) counts as slow after this long (ms)... */
const WAITING_SLOW = 500;
/** ...a request the page started by itself, after this long (ms). Faster ones never show anything. */
const IDLE_SLOW = 1500;
/** Once it appeared it stays at least this long (ms), so it does not blink. */
const MIN_VISIBLE = 400;
/** A link whose page never arrives does not keep the full-screen loader for ever (ms). */
const NAV_GIVE_UP = 15000;

function normalizePath(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function locationKey(pathname: string, search: string) {
  return `${normalizePath(pathname)}${search ? `?${search}` : ''}`;
}

/**
 * One loader for the whole app (public site and admin). It shows ONLY when something is really taking long - never because
 * a page opened or a request merely started:
 *  - PAGE LOADER (full screen): a link was clicked and the new page has not arrived after NAV_DELAY. It goes away the moment the page arrives.
 *  - SMALL (a thin bar + a small badge at the top, never blocks anything): a server request is slow - WAITING_SLOW after a click / submit / change
 *    (a save, a delete, an upload, a filter), IDLE_SLOW for what the page loads by itself. Dialogs, buttons and messages stay usable.
 * Background refreshes (api option `quiet`) never trigger it.
 */
export function NavigationLoader() {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentLocation = locationKey(pathname, search);
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const [navLate, setNavLate] = useState(false); // the clicked page is late
  const [active, setActive] = useState(getActiveApiRequests);
  const [slow, setSlow] = useState(false); // a request is taking long
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  // ---- requests: slow only after they have been running for a while
  useEffect(() => subscribeToApiRequests(setActive), []);
  useEffect(() => {
    if (active === 0) { setSlow(false); return; }
    let timer: number | undefined;
    const check = () => {
      const left = msUntilSlowRequest(WAITING_SLOW, IDLE_SLOW);
      if (left === null) setSlow(false);
      else if (left <= 0) setSlow(true);
      else timer = window.setTimeout(check, left + 5);
    };
    check();
    return () => window.clearTimeout(timer);
  }, [active]);

  // ---- user actions: link navigation + telling the request counter somebody is waiting
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      const control = target.closest('a[href], button, [role="button"], input[type="submit"], input[type="button"], summary');
      if (control && !control.matches(':disabled, [aria-disabled="true"]')) markUserAction();

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      if (!/^https?:$/.test(anchor.protocol)) return; // mailto:, tel:, ...

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;

      const targetLocation = locationKey(destination.pathname, destination.searchParams.toString());
      if (targetLocation === currentLocation) return;
      setPending({ target: targetLocation, arrived: false });
    };

    const onChange = (event: Event) => {
      const el = event.target;
      if (el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && ['checkbox', 'radio', 'file', 'date', 'datetime-local'].includes(el.type))) markUserAction();
    };

    // typing in a search box (the list reloads a moment after the last key)
    const onInput = (event: Event) => {
      const el = event.target;
      if (el instanceof HTMLInputElement && ['text', 'search', 'number', 'email', 'tel', 'url'].includes(el.type)) markUserAction();
    };

    document.addEventListener('input', onInput, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', markUserAction, true);
    document.addEventListener('change', onChange, true);
    return () => {
      document.removeEventListener('input', onInput, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', markUserAction, true);
      document.removeEventListener('change', onChange, true);
    };
  }, [currentLocation]);

  // ---- a clicked link: the full-screen loader only if the page is late, and it leaves as soon as the page has arrived
  useEffect(() => {
    if (!pending) { setNavLate(false); return; }
    if (currentLocation === pending.target) { setPending(null); return; }
    const late = window.setTimeout(() => setNavLate(true), NAV_DELAY);
    const giveUp = window.setTimeout(() => setPending(null), NAV_GIVE_UP);
    return () => { window.clearTimeout(late); window.clearTimeout(giveUp); };
  }, [pending, currentLocation]);

  // ---- show when something is late, and do not blink
  const busy = (pending !== null && navLate) || slow;

  useEffect(() => {
    if (busy) {
      if (!visible) { shownAt.current = Date.now(); setVisible(true); }
      return;
    }
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), Math.max(0, MIN_VISIBLE - (Date.now() - shownAt.current)));
    return () => window.clearTimeout(timer);
  }, [busy, visible]);

  if (!visible) return null;

  // EXPO and the Women Business Committee are separate sites: the chamber's full-screen loader and badge never appear there. Moving between
  // their pages shows the page's own loading screen (loading.tsx, inside their header and footer); an action shows a slim bar in their colours.
  const brand = brandOf(pathname);
  if (brand) return pending !== null && !slow ? null : <BrandedBar brand={brand} />;

  // moving to another page that is late
  if (pending !== null && navLate) return <PageLoaderOverlay label={t('app.loadingPage')} delay={0} />;

  // a slow request on the current page (save, delete, upload, filter, data ...): small, and the page stays usable.
  // pointer-events-none = clicks go straight through; z-[90] = below the messages (toasts are z-[300]).
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90]" role="status" aria-live="polite" aria-busy="true" aria-label={t('app.loading')}>
      <div dir="ltr" className="h-1 w-full overflow-hidden bg-primary/15">
        <div className="loader-bar h-full w-1/3 rounded-full bg-primary" />
      </div>
      <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-line bg-white/95 px-3 py-1.5 text-xs text-gray-600 shadow-card">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-hidden="true" />
        {t('app.loading')}
      </div>
    </div>
  );
}

/** The thin "something is being saved" bar of a brand site, in that site's own accent colour (read from its themed wrapper). */
function BrandedBar({ brand }: { brand: Brand }) {
  const [color, setColor] = useState(BRAND_DEFAULTS[brand].accent);
  useEffect(() => {
    const el = document.querySelector('[data-brand-theme]');
    const v = el ? getComputedStyle(el).getPropertyValue('--accent').trim() : '';
    if (v) setColor(v);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90]" role="status" aria-live="polite" aria-busy="true">
      <div dir="ltr" className="h-1 w-full overflow-hidden" style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)` }}>
        <div className="loader-bar h-full w-1/3 rounded-full" style={{ backgroundColor: color }} />
      </div>
    </div>
  );
}
