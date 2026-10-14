import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        ink: '#111827',
      },
      fontFamily: { sans: ['Cairo', 'Segoe UI', 'Tahoma', 'Arial', 'sans-serif'] },
      keyframes: {
        ticker: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
      },
      animation: { ticker: 'ticker 40s linear infinite' },
    },
  },
  plugins: [],
};
export default config;
