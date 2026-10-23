import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // brand colours come from Settings (CSS variables); <alpha-value> makes bg-primary/10, ring-primary/20 … work
        primary: 'color-mix(in srgb, var(--primary) calc(<alpha-value> * 100%), transparent)',
        secondary: 'color-mix(in srgb, var(--secondary) calc(<alpha-value> * 100%), transparent)',
        accent: 'color-mix(in srgb, var(--accent) calc(<alpha-value> * 100%), transparent)',
        ink: 'color-mix(in srgb, var(--ink) calc(<alpha-value> * 100%), transparent)',
        canvas: 'var(--canvas)',
        line: 'var(--line)',
      },
      // ~15% smaller type scale than Tailwind's defaults (rem based, so it applies to the whole site)
      fontSize: {
        xs: ['0.65rem', { lineHeight: '1rem' }],
        sm: ['0.75rem', { lineHeight: '1.15rem' }],
        base: ['0.85rem', { lineHeight: '1.4rem' }],
        lg: ['0.95rem', { lineHeight: '1.5rem' }],
        xl: ['1.05rem', { lineHeight: '1.6rem' }],
        '2xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '3xl': ['1.55rem', { lineHeight: '2rem' }],
        '4xl': ['1.9rem', { lineHeight: '2.25rem' }],
        '5xl': ['2.5rem', { lineHeight: '1' }],
        '6xl': ['3.1rem', { lineHeight: '1' }],
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
        display: ['"Readex Pro Variable"', '"IBM Plex Sans Arabic"', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
      boxShadow: { card: 'var(--shadow-card)', lift: 'var(--shadow-lift)' },
      keyframes: {
        ticker: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
      },
      animation: { ticker: 'ticker 18s linear infinite' },
    },
  },
  plugins: [],
};
export default config;
