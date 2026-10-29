'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, fileUrl, onSiteChange } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { applyTheme, themeReady } from '@/lib/theme';

/** Two independent lists: a subcategory does not belong to any main category. */
export interface Categories { main: string[]; sub: string[] }
const NO_CATEGORIES: Categories = { main: [], sub: [] };
type Settings = Record<string, Record<string, any>>;

interface SiteCtx {
  settings: Settings;
  categories: Categories;
  /** raw setting value (null when unset) */
  s: (cat: string, key: string) => any;
  /** localised setting: <key>_ar / <key>_en */
  loc: (cat: string, key: string) => string;
  img: (cat: string, key: string) => string;
  ready: boolean;
  /** reload settings + categories now (also runs by itself after admin changes and when the tab regains focus) */
  refresh: () => void;
}
const Ctx = createContext<SiteCtx>(null as unknown as SiteCtx);

/** Points every <link rel="icon"> at the uploaded favicon (Next.js static export has no built-in hook for a DB-driven icon). */
function applyFavicon(url: string) {
  if (!url) return;
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  const type = ext === 'ico' ? 'image/x-icon' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
  document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((l) => l.remove());
  for (const rel of ['icon', 'shortcut icon']) {
    const l = document.createElement('link');
    l.rel = rel;
    l.type = type;
    l.href = url;
    document.head.appendChild(l);
  }
}

/** Browser-tab title (Settings → branding → meta_title_ar / meta_title_en, else the site name) and meta description. */
function applyMeta(st: Settings, lang: string) {
  const b = st.branding ?? {};
  const title = (b[`meta_title_${lang}`] || b[`site_name_${lang}`] || '').toString().trim();
  if (title) document.title = title;
  const desc = (b[`site_description_${lang}`] || '').toString().trim();
  let m = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (desc) {
    if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
    m.content = desc;
  } else m?.remove();
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  const [settings, setSettings] = useState<Settings>({});
  const [categories, setCategories] = useState<Categories>(NO_CATEGORIES);
  const [ready, setReady] = useState(false);

  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(() => {
    return Promise.all([
      api<Settings>('/public/settings', { cache: 'no-store' }).catch(() => null),
      api<Categories>('/public/categories', { params: { lang }, cache: 'no-store' }).catch(() => null),
    ]).then(([st, cats]) => {
      if (!alive.current) return;
      if (st) {
        setSettings(st);
        applyTheme(st.appearance); // sets the colours and remembers them for the next visit's first paint
        applyFavicon(fileUrl(st.branding?.favicon_url));
        applyMeta(st, lang);
      }
      if (cats) setCategories(cats);
      themeReady(); // also when the API did not answer: never leave the first-visit page blank
      setReady(true);
    });
  }, [lang]);

  useEffect(() => { void load(); }, [load]);

  // live updates: after any admin change (this tab or another one) and whenever the tab comes back into view
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => void load(), 150); };
    const onVisible = () => { if (document.visibilityState === 'visible') soon(); };
    const off = onSiteChange(soon);
    window.addEventListener('focus', soon);
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer); off(); window.removeEventListener('focus', soon); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const s = (cat: string, key: string) => settings[cat]?.[key] ?? null;
  const value: SiteCtx = {
    settings,
    categories,
    ready,
    s,
    loc: (cat, key) => s(cat, `${key}_${lang}`) ?? '',
    img: (cat, key) => fileUrl(settings[cat]?.[`${key}_url`]),
    refresh: () => void load(),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useSite = () => useContext(Ctx);
