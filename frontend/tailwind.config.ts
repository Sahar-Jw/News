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
