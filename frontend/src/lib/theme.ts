/**
 * Brand colours chosen in Settings → appearance are loaded from the API after the page has opened. To stop the old
 * (default) colours from showing for a moment on every visit, the last colours are remembered in this browser
 * (localStorage) and applied by THEME_BOOT_SCRIPT inside <head> - before the first paint, before React starts.
 * The values from the API still win as soon as they arrive (see applyTheme, called by SiteProvider).
 *
 * When no colors are remembered yet, data-theme-pending keeps the default palette hidden until the API responds. The new-tab
 * intro cover stays above that fallback, and a safety timer lifts the pending state if the API is slow or down.
 */
// v2: the palette changed to the logo's green / gold, so colours remembered by older visits are dropped instead of flashing blue first
export const THEME_STORAGE_KEY = 'site-theme-v2';
export const INTRO_SESSION_KEY = 'news-site-intro-seen';

/** Runs before paint so the main-color intro cover appears on a new tab, but not on reloads. */
export const INTRO_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,k=${JSON.stringify(INTRO_SESSION_KEY)};if(sessionStorage.getItem(k)==="true")return;sessionStorage.setItem(k,"true");d.setAttribute("data-intro-pending","")}catch(e){document.documentElement.setAttribute("data-intro-pending","")}})();`;

/** setting key -> CSS variable (+ values that count as "not customised", they keep the built-in look) */
const THEME_VARS: Record<string, { cssVar: string; fg?: string }> = {
  primary_color: { cssVar: '--primary' },
  secondary_color: { cssVar: '--secondary' },
  accent_color: { cssVar: '--accent' },
  header_background: { cssVar: '--header-bg' },
  footer_background: { cssVar: '--footer-bg' },
  breaking_bg_color: { cssVar: '--breaking-bg', fg: '--breaking-fg' },
  breaking_label_bg_color: { cssVar: '--breaking-label-bg', fg: '--breaking-label-fg' },
};

/** Black or white text, whichever reads better on the given #hex background. */
export function readableOn(hex: string) {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111827' : '#ffffff';
}

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
  for (const [key, { cssVar, fg }] of Object.entries(THEME_VARS)) {
    const v = typeof a[key] === 'string' ? a[key].trim() : '';
    if (v && HEX.test(v)) {
      // every colour that is set in Settings is used exactly as saved (nothing is treated as \"default\")
      root.setProperty(cssVar, v);
      saved[cssVar] = v;
      if (fg) {
        const c = readableOn(v);
        root.setProperty(fg, c);
        saved[fg] = c;
      }
    } else {
      root.removeProperty(cssVar);
      if (fg) root.removeProperty(fg);
    }
  }
  themeReady();
  try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(saved)); } catch { /* private mode / storage full: only the first paint is affected */ }
}

/** Runs synchronously in <head>. Plain ES5 on purpose; every value is validated before it touches the page. */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(!s){d.setAttribute("data-theme-pending","");setTimeout(function(){d.removeAttribute("data-theme-pending")},${THEME_PENDING_MAX_MS});return}var t=JSON.parse(s)||{},r=d.style;for(var k in t){if(/^--[a-z-]+$/.test(k)&&/^#[0-9a-fA-F]{3,8}$/.test(t[k]))r.setProperty(k,t[k])}}catch(e){}})();`;
