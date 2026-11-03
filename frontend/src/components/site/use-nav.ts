'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { NAV_GROUPS } from '@/lib/nav';

export interface PublicNavGroup {
  id: number | string;
  title: string;
  items: { id: number | string; title: string; url: string; newTab: boolean }[];
}

/** last menu received per language: later navigations show it at once instead of waiting for the request */
const cache: Record<string, PublicNavGroup[]> = {};

/** The built-in menu (lib/nav.ts): shown only if the menu cannot be loaded from the API. */
function builtIn(t: (k: string) => string): PublicNavGroup[] {
  return NAV_GROUPS.map((g) => ({ id: g.key, title: t(g.label), items: g.items.filter((i) => i.ready).map((i) => ({ id: i.to, title: t(i.label), url: i.to, newTab: false })) })).filter((g) => g.items.length);
}

/**
 * The main-menu dropdowns, managed in Settings -> Main menu. `null` while the first request is in flight (nothing is drawn, so a
 * customised menu never flashes the default one); the built-in menu is used only when the request fails.
 */
export function useNavGroups(lang: string, t: (k: string) => string): PublicNavGroup[] | null {
  const [groups, setGroups] = useState<PublicNavGroup[] | null>(() => cache[lang] ?? null);
  useEffect(() => {
    let off = false;
    api<PublicNavGroup[]>('/public/nav', { params: { lang }, cache: 'no-store' })
      .then((r) => { cache[lang] = r; if (!off) setGroups(r); })
      .catch(() => { if (!off) setGroups(cache[lang] ?? builtIn(t)); });
    return () => { off = true; };
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return groups;
}
