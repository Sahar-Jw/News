'use client';
import { useEffect } from 'react';

/** "/" -> Arabic site by default; remembers the last chosen language. */
export default function Root() {
  useEffect(() => {
    const saved = localStorage.getItem('lang');
    const lang = saved === 'en' || saved === 'ar' ? saved : navigator.language.toLowerCase().startsWith('en') ? 'en' : 'ar';
    window.location.replace(`/${lang}/`);
  }, []);
  return null;
}
