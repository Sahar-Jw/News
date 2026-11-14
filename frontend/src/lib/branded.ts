import type { CSSProperties } from 'react';

/**
 * DCC EXPO and the Women Business Committee are separate sites inside this one: each has its own header, footer, colours and now its own
 * loading, 404 and error screens. The chamber's opening animation and page loader (mounted once, above everything) must stay out of them.
 */
export type Brand = 'expo' | 'women';

/** the address of each brand site: /ar/expo/... and /ar/committees/women/... (the same pattern is used by the boot scripts in lib/theme.ts) */
export const BRANDED_PATH = /^\/(?:ar|en)\/(expo|committees\/women)(?:\/|$)/;
/** the same test as source text, for the scripts that run in <head> before React starts */
export const BRANDED_PATH_SOURCE = '^\\/(ar|en)\\/(expo|committees\\/women)(\\/|$)';

export function brandOf(pathname: string | null | undefined): Brand | null {
  const m = BRANDED_PATH.exec(pathname ?? '');
  return m ? (m[1] === 'expo' ? 'expo' : 'women') : null;
}

/** colours each brand site wears until its own settings arrive (the same defaults its layout uses) */
export const BRAND_DEFAULTS: Record<Brand, { primary: string; accent: string; canvas: string; ink: string }> = {
  expo: { primary: '#4b1d7a', accent: '#c9a227', canvas: '#faf8fc', ink: '#1f2937' },
  women: { primary: '#c7878d', accent: '#34232c', canvas: '#fff9fb', ink: '#34232c' },
};

/** CSS variables of a brand's default look, for screens that render outside the brand layout (full-screen loader, global 404) */
export function brandTheme(brand: Brand): CSSProperties {
  const c = BRAND_DEFAULTS[brand];
  return { '--primary': c.primary, '--secondary': `color-mix(in srgb, ${c.primary} 70%, black)`, '--accent': c.accent, '--canvas': c.canvas, '--ink': c.ink } as CSSProperties;
}
