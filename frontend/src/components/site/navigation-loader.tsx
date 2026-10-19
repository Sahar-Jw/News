'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getActiveApiRequests, subscribeToApiRequests } from '@/lib/api';

type PendingNavigation = { target: string; arrived: boolean };

function normalizePath(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

function locationKey(pathname: string, search: string) {
  return `${normalizePath(pathname)}${search ? `?${search}` : ''}`;
}

export function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const currentLocation = locationKey(pathname, search);
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const [activeRequests, setActiveRequests] = useState(getActiveApiRequests);

  useEffect(() => subscribeToApiRequests(setActiveRequests), []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;

      const targetLocation = locationKey(destination.pathname, destination.searchParams.toString());
      if (targetLocation === currentLocation) return;
      setPending({ target: targetLocation, arrived: false });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [currentLocation]);

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

  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/80 backdrop-blur-sm" role="status" aria-label="Loading page">
      <span className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden="true" />
    </div>
  );
}
