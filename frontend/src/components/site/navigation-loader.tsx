'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getActiveApiRequests, subscribeToApiRequests } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { PageSkeletonOverlay } from '@/components/ui/page-skeleton';

type PendingNavigation = { target: string; arrived: boolean };

/** The loader only appears when something takes longer than this (ms), so quick clicks never flash it. */
const SHOW_DELAY = 250;
/** Once it appeared it stays at least this long (ms), so it does not blink. */
const MIN_VISIBLE = 400;
/** Safety net: the loader never keeps the page blocked longer than this (ms), whatever happens. */
const MAX_VISIBLE = 20000;
/** A server request that starts within this time (ms) after a click / submit / change counts as caused by it. */
const ARM_WINDOW = 1500;
/** Wait this long (ms) after the last request ended before treating the action as finished (covers chained requests). */
const SETTLE = 150;

function normalizePath(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function locationKey(pathname: string, search: string) {
  return `${normalizePath(pathname)}${search ? `?${search}` : ''}`;
}

/**
 * One loader for the whole app (public site and admin). It only appears when the visitor did something and the
 * result takes a while, and it comes in two sizes:
 *  - PAGE SKELETON (full screen, blocks the page): clicking a link to another page, until the new page has arrived and
 *    its data has loaded. Same as the route-level loading.tsx.
 *  - SMALL (a thin bar + a small badge at the top, never blocks anything): clicking a button, submitting a form or
 *    changing a filter / file while the request it started is still running. Dialogs, buttons and the success / error
 *    messages (toasts) stay usable and visible.
 * Requests that nobody asked for (background refreshes of settings, etc.) never trigger it.
 */
export function NavigationLoader() {
  const { t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentLocation = locationKey(pathname, search);
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const [activeRequests, setActiveRequests] = useState(getActiveApiRequests);
  const [actionBusy, setActionBusy] = useState(false); // a request started by a click / submit / change is running
  const [visible, setVisible] = useState(false);

  const armedUntil = useRef(0);
  const actionBusyRef = useRef(false);
  const settleTimer = useRef<number | undefined>(undefined);
  const shownAt = useRef(0);
  const gaveUp = useRef(false);

  // ---- server requests started right after a user action
  useEffect(() => {
    const setBusy = (v: boolean) => {
      actionBusyRef.current = v;
      setActionBusy(v);
    };
    const unsubscribe = subscribeToApiRequests((active) => {
      setActiveRequests(active);
      window.clearTimeout(settleTimer.current);
      if (active > 0) {
        if (actionBusyRef.current || Date.now() < armedUntil.current) setBusy(true);
      } else if (actionBusyRef.current) {
        settleTimer.current = window.setTimeout(() => setBusy(false), SETTLE);
      }
    });
    return () => {
      unsubscribe();
      window.clearTimeout(settleTimer.current);
    };
  }, []);

  // ---- user actions: link navigation + "arming" for the requests they cause
  useEffect(() => {
    const arm = () => {
      armedUntil.current = Date.now() + ARM_WINDOW;
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      const control = target.closest('a[href], button, [role="button"], input[type="submit"], input[type="button"], summary');
      if (control && !control.matches(':disabled, [aria-disabled="true"]')) arm();

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
      if (el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && ['checkbox', 'radio', 'file', 'date', 'datetime-local'].includes(el.type))) arm();
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', arm, true);
    document.addEventListener('change', onChange, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', arm, true);
      document.removeEventListener('change', onChange, true);
    };
  }, [currentLocation]);

  // ---- a clicked link: wait for the new page, then for the data it loads
  useEffect(() => {
    if (!pending || pending.arrived || currentLocation !== pending.target) return;
    setPending({ ...pending, arrived: true });
  }, [currentLocation, pending]);

  useEffect(() => {
    if (!pending) return;
    const timeout = window.setTimeout(() => setPending(null), 15000);
    return () => window.clearTimeout(timeout);
  }, [pending]);

  useEffect(() => {
    if (!pending?.arrived || activeRequests > 0) return;
    const timeout = window.setTimeout(() => setPending(null), 180);
    return () => window.clearTimeout(timeout);
  }, [activeRequests, pending]);

  // ---- show only when it takes a while, and do not blink
  const busy = pending !== null || actionBusy;

  useEffect(() => {
    if (busy) {
      if (visible || gaveUp.current) return;
      const timer = window.setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, SHOW_DELAY);
      return () => window.clearTimeout(timer);
    }
    gaveUp.current = false;
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), Math.max(0, MIN_VISIBLE - (Date.now() - shownAt.current)));
    return () => window.clearTimeout(timer);
  }, [busy, visible]);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      gaveUp.current = true;
      setVisible(false);
    }, MAX_VISIBLE);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  // moving to another page: a skeleton of the page (same one as the route-level loading.tsx)
  if (pending !== null) return <PageSkeletonOverlay label={t('app.loadingPage')} />;

  // an action on the current page (save, delete, upload, filter ...): small, and the page stays usable.
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
