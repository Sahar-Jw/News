'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface FooterLinkItem { id: number; title: string; url: string; newTab: boolean }
export interface FooterGroupItem { id: number; kind: 'links' | 'official' | 'legal'; columns: 1 | 2; title: string; items: FooterLinkItem[] }

const cache: Record<string, FooterGroupItem[]> = {};

/** The footer's link groups, managed in Settings -> Footer. `null` while the first request is in flight; an empty list when it fails. */
export function useFooterGroups(lang: string): FooterGroupItem[] | null {
  const [groups, setGroups] = useState<FooterGroupItem[] | null>(() => cache[lang] ?? null);
  useEffect(() => {
    let off = false;
    api<FooterGroupItem[]>('/public/footer', { params: { lang }, cache: 'no-store' })
      .then((r) => { cache[lang] = r; if (!off) setGroups(r); })
      .catch(() => { if (!off) setGroups(cache[lang] ?? []); });
    return () => { off = true; };
  }, [lang]);
  return groups;
}
