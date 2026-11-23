'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, onSiteChange } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

/**
 * The positions a person can hold, one editable list per page (Settings -> the page -> Positions):
 *  board = Board of directors · committee = Committees & sectors · women = Women Business Committee.
 * The ORDER of a list is the hierarchy of the public page (first = top). A person keeps the position's `key`, never its label.
 */
export type RoleScope = 'board' | 'committee' | 'women';
export interface RoleOption { key: string; ar: string; en: string }
export type RoleLists = Record<RoleScope, RoleOption[]>;
/** the plain member: always exists (can be renamed, not deleted) */
export const BASE_ROLE = 'member';

/** shown until the lists arrive from the server (the same positions the site always had) */
export const DEFAULT_ROLES: RoleLists = {
  board: [
    { key: 'president', ar: 'الرئيس', en: 'President' }, { key: 'vice_president', ar: 'نائب الرئيس', en: 'Vice president' },
    { key: 'secretary', ar: 'أمين السر', en: 'Secretary' }, { key: 'treasurer', ar: 'أمين الصندوق', en: 'Treasurer' }, { key: 'member', ar: 'عضو', en: 'Member' },
  ],
  committee: [
    { key: 'chair', ar: 'الرئيس', en: 'Chair' }, { key: 'secretary', ar: 'أمين السر', en: 'Secretary' },
    { key: 'vice', ar: 'نائب الرئيس', en: 'Vice chair' }, { key: 'member', ar: 'عضو', en: 'Member' },
  ],
  women: [
    { key: 'chair', ar: 'رئيسة اللجنة', en: 'Chair' }, { key: 'vice', ar: 'نائبة الرئيسة', en: 'Vice chair' },
    { key: 'secretary', ar: 'أمينة السر', en: 'Secretary' }, { key: 'member', ar: 'عضوة', en: 'Member' },
  ],
};

let cached: RoleLists | null = null;
let inflight: Promise<RoleLists> | null = null;
const listeners = new Set<(r: RoleLists) => void>();

function fetchRoles(): Promise<RoleLists> {
  inflight ??= api<RoleLists>('/public/member-roles', { cache: 'no-store' })
    .then((r) => { cached = r; listeners.forEach((fn) => fn(r)); return r; })
    .finally(() => { inflight = null; });
  return inflight;
}

/** the name of a position in the page's language (the English name falls back to the Arabic one) */
export const roleName = (list: RoleOption[], key: string | null | undefined, lang: string): string => {
  const o = list.find((x) => x.key === key);
  return o ? (lang === 'ar' ? o.ar : o.en || o.ar) : '';
};

/** The positions of every page, kept fresh: reloaded when something is saved in the admin (this tab or another). */
export function useMemberRoles() {
  const { lang } = useI18n();
  const [roles, setRoles] = useState<RoleLists>(cached ?? DEFAULT_ROLES);
  useEffect(() => {
    listeners.add(setRoles);
    void fetchRoles().catch(() => undefined); // a failed load keeps the defaults
    const off = onSiteChange(() => { void fetchRoles().catch(() => undefined); });
    return () => { listeners.delete(setRoles); off(); };
  }, []);
  const label = useCallback((scope: RoleScope, key: string | null | undefined) => roleName(roles[scope], key, lang) || String(key ?? ''), [roles, lang]);
  return { roles, label };
}
