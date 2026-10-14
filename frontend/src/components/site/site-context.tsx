'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export interface CategoryItem { name: string; subcategories: string[] }
type Settings = Record<string, Record<string, any>>;

interface SiteCtx {
  settings: Settings;
  categories: CategoryItem[];
  /** raw setting value (null when unset) */
  s: (cat: string, key: string) => any;
  /** localised setting: <key>_ar / <key>_en */
  loc: (cat: string, key: string) => string;
  img: (cat: string, key: string) => string;
  ready: boolean;
}
const Ctx = createContext<SiteCtx>(null as unknown as SiteCtx);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  const [settings, setSettings] = useState<Settings>({});
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api<Settings>('/public/settings').catch(() => ({})), api<CategoryItem[]>('/public/categories', { params: { lang } }).catch(() => [])]).then(([st, cats]) => {
      if (!alive) return;
      setSettings(st as Settings);
      setCategories(cats as CategoryItem[]);
      setReady(true);
      const a = (st as Settings).appearance ?? {};
      const r = document.documentElement.style;
      if (a.primary_color) r.setProperty('--primary', a.primary_color);
      if (a.secondary_color) r.setProperty('--secondary', a.secondary_color);
    });
    return () => {
      alive = false;
    };
  }, [lang]);

  const s = (cat: string, key: string) => settings[cat]?.[key] ?? null;
  const value: SiteCtx = {
    settings,
    categories,
    ready,
    s,
    loc: (cat, key) => s(cat, `${key}_${lang}`) ?? '',
    img: (cat, key) => fileUrl(settings[cat]?.[`${key}_url`]),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useSite = () => useContext(Ctx);
