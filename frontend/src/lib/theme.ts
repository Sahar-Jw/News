/**
 * Brand colours chosen in Settings → appearance are loaded from the API after the page has opened. To stop the old
 * (default) colours from showing for a moment on every visit, the last colours are remembered in this browser
 * (localStorage) and applied by THEME_BOOT_SCRIPT inside <head> - before the first paint, before React starts.
 * The values from the API still win as soon as they arrive (see applyTheme, called by SiteProvider).
 *
 * The very first visit has nothing remembered yet. Then a page skeleton is shown (html[data-theme-pending] + #boot-skeleton,
 * see globals.css and [lang]/layout.tsx) until the colours arrive from the API, so the default colours never show. A safety timer lifts the
 * skeleton after THEME_PENDING_MAX_MS even if the API is slow or down.
 */
export const THEME_STORAGE_KEY = 'site-theme-v1';

/** setting key -> CSS variable (+ values that count as "not customised", they keep the built-in look) */
const THEME_VARS: Record<string, { cssVar: string; ignore?: string[] }> = {
  primary_color: { cssVar: '--primary' },
  secondary_color: { cssVar: '--secondary' },
  accent_color: { cssVar: '--accent' },
  header_background: { cssVar: '--header-bg', ignore: ['#ffffff', '#fff'] },
  footer_background: { cssVar: '--footer-bg', ignore: ['#111827'] },
};

/** The first-visit skeleton is never kept longer than this (ms). */
export const THEME_PENDING_MAX_MS = 2000;

const HEX = /^#[0-9a-fA-F]{3,8}$/;

/** Lifts the first-visit skeleton (the colours are known, or the API did not answer). */
export function themeReady() {
  document.documentElement.removeAttribute('data-theme-pending');
}

/** Applies the appearance settings to <html> (an emptied colour goes back to the stylesheet default) and remembers them. */
export function applyTheme(appearance: Record<string, any> | undefined) {
  const a = appearance ?? {};
  const root = document.documentElement.style;
  const saved: Record<string, string> = {};
  for (const [key, { cssVar, ignore }] of Object.entries(THEME_VARS)) {
    const v = typeof a[key] === 'string' ? a[key].trim() : '';
    if (v && HEX.test(v) && !ignore?.includes(v.toLowerCase())) {
      root.setProperty(cssVar, v);
      saved[cssVar] = v;
    } else root.removeProperty(cssVar);
  }
  themeReady();
  try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(saved)); } catch { /* private mode / storage full: only the first paint is affected */ }
}

/** Runs synchronously in <head>. Plain ES5 on purpose; every value is validated before it touches the page. */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(!s){d.setAttribute("data-theme-pending","");setTimeout(function(){d.removeAttribute("data-theme-pending")},${THEME_PENDING_MAX_MS});return}var t=JSON.parse(s)||{},r=d.style;for(var k in t){if(/^--[a-z-]+$/.test(k)&&/^#[0-9a-fA-F]{3,8}$/.test(t[k]))r.setProperty(k,t[k])}}catch(e){}})();`;
