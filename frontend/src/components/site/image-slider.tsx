'use client';
import { useEffect, useState } from 'react';
import { fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

/**
 * Picture slider: moves on its own, stops while the pointer is over it (or a thumbnail is focused).
 * Thumbnails never scroll sideways: up to 6 sit in one row, more are split over two rows.
 */
export function ImageSlider({ images, title, dir }: { images: string[]; title: string; dir?: 'rtl' | 'ltr' }) {
  const { t, lang } = useI18n();
  // the slider follows the direction of the article it sits in (a record's own language), else the page language
  const rtl = (dir ?? (lang === 'ar' ? 'rtl' : 'ltr')) === 'rtl';
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = images.length;
  useEffect(() => { setActive(0); }, [images]);
  useEffect(() => {
    if (n < 2 || paused) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % n), 4000);
    return () => clearInterval(timer);
  }, [n, paused, active]);
  const go = (d: number) => setActive((i) => (i + d + n) % n);
  const cols = n <= 6 ? n : Math.ceil(n / 2);
  return (
    <div className="mt-5" dir={rtl ? 'rtl' : 'ltr'} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="relative h-64 overflow-hidden rounded-2xl bg-gray-100 md:h-[26rem]" role="region" aria-roledescription="carousel">
        {images.map((im, i) => (
          <img key={im} src={fileUrl(im)} alt={i === active ? title : ''} aria-hidden={i !== active} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${i === active ? 'opacity-100' : 'opacity-0'}`} />
        ))}
        {n > 1 && (
          <>
            {/* arrows sit on the physical left / right edge and are SVGs, so the browser never mirrors them:
                the left one always points left, the right one right. In Arabic, forward is leftwards. */}
            <button type="button" onClick={() => go(rtl ? 1 : -1)} aria-label={rtl ? t('app.next') : t('app.prev')} className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button type="button" onClick={() => go(rtl ? -1 : 1)} aria-label={rtl ? t('app.prev') : t('app.next')} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {images.map((im, i) => (
            <button key={im} type="button" onClick={() => setActive(i)} aria-label={`${i + 1}`} className={`aspect-[4/3] overflow-hidden rounded border-2 transition ${i === active ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100'}`}>
              <img src={fileUrl(im)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
