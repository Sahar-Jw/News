'use client';
import { useEffect } from 'react';

/** "/" -> Arabic site by default (browser language is ignored); remembers a language the visitor chose explicitly. */
export default function Root() {
  useEffect(() => {
    const saved = localStorage.getItem('lang');
    const lang = saved === 'en' || saved === 'ar' ? saved : 'ar';
    window.location.replace(`/${lang}/`);
  }, []);
  return null;
}
