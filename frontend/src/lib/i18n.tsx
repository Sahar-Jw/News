'use client';
import { createContext, useContext, useMemo } from 'react';
import { DICT } from './dict';
import type { Lang } from './utils';

interface I18n {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: (key: string) => string;
  /** build an internal link for the current language */
  href: (path: string) => string;
  /** same page in the other language */
  otherLangHref: (pathname: string) => string;
}

const Ctx = createContext<I18n>(null as unknown as I18n);

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo<I18n>(
    () => ({
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      t: (k) => DICT[lang][k] ?? k,
      href: (p) => {
        const [path, q] = p.split('?');
        const base = `/${lang}${path === '/' ? '' : path}`;
        const withSlash = base.endsWith('/') ? base : base + '/';
        return q ? `${withSlash}?${q}` : withSlash;
      },
      otherLangHref: (pathname) => {
        const other = lang === 'ar' ? 'en' : 'ar';
        const rest = pathname.replace(/^\/(ar|en)/, '');
        return `/${other}${rest || '/'}`;
      },
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
