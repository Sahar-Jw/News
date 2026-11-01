'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const Chevron = ({ left }: { left?: boolean }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={left ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} /></svg>
);

/**
 * Picture slider: moves on its own, stops while the pointer is over it (or a thumbnail is focused).
 * Pictures are always shown whole (never cropped) over a blurred copy of themselves; clicking opens the full picture
 * in a viewer where it can be zoomed (click / tap the picture) and, with several pictures, browsed.
 * Thumbnails never scroll sideways: up to 6 sit in one row, more are split over two rows.
 */
export function ImageSlider({ images, title, dir }: { images: string[]; title: string; dir?: 'rtl' | 'ltr' }) {
  const { t, lang } = useI18n();
  // the slider follows the direction of the article it sits in (a record's own language), else the page language
  const rtl = (dir ?? (lang === 'ar' ? 'rtl' : 'ltr')) === 'rtl';
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [viewer, setViewer] = useState(false);
  const n = images.length;
  useEffect(() => { setActive(0); }, [images]);
  useEffect(() => {
    if (n < 2 || paused || viewer) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % n), 4000);
    return () => clearInterval(timer);
  }, [n, paused, viewer, active]);
  const go = useCallback((d: number) => setActive((i) => (i + d + n) % n), [n]);
  const cols = n <= 6 ? n : Math.ceil(n / 2);
  const openLabel = lang === 'ar' ? 'عرض الصورة كاملة' : 'View full picture';
  return (
    <div className="mt-5" dir={rtl ? 'rtl' : 'ltr'} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="relative h-64 overflow-hidden rounded-2xl bg-gray-100 md:h-[26rem]" role="region" aria-roledescription="carousel">
        {images.map((im, i) => (
          <div key={im} aria-hidden={i !== active} className={`absolute inset-0 transition-opacity duration-700 ${i === active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
            {/* blurred copy fills the frame, the sharp picture is shown whole on top */}
            <img src={fileUrl(im)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
            <img src={fileUrl(im)} alt={i === active ? title : ''} className="absolute inset-0 h-full w-full object-contain" />
          </div>
        ))}
        <button type="button" onClick={() => setViewer(true)} aria-label={openLabel} title={openLabel} className="absolute inset-0 cursor-zoom-in">
          <span className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
          </span>
        </button>
        {n > 1 && (
          <>
            {/* arrows sit on the physical left / right edge and are SVGs, so the browser never mirrors them:
                the left one always points left, the right one right. In Arabic, forward is leftwards. */}
            <button type="button" onClick={() => go(rtl ? 1 : -1)} aria-label={rtl ? t('app.next') : t('app.prev')} className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"><Chevron left /></button>
            <button type="button" onClick={() => go(rtl ? -1 : 1)} aria-label={rtl ? t('app.prev') : t('app.next')} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition hover:bg-black/60"><Chevron /></button>
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
      {viewer && <Viewer images={images} index={active} title={title} rtl={rtl} onIndex={setActive} onClose={() => setViewer(false)} />}
    </div>
  );
}

/** Full-screen viewer: the whole picture, click (or tap) to zoom in and out, move the pointer to look around. */
function Viewer({ images, index, title, rtl, onIndex, onClose }: { images: string[]; index: number; title: string; rtl: boolean; onIndex: (i: number) => void; onClose: () => void }) {
  const { t, lang } = useI18n();
  const n = images.length;
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const closeBtn = useRef<HTMLButtonElement>(null);
  const step = useCallback((d: number) => { setZoom(false); onIndex((index + d + n) % n); }, [index, n, onIndex]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus?.(); };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (n > 1 && e.key === 'ArrowLeft') step(rtl ? 1 : -1);
      else if (n > 1 && e.key === 'ArrowRight') step(rtl ? -1 : 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [n, rtl, step, onClose]);

  const point = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };
  const btn = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30';
  const zoomLabel = zoom ? (lang === 'ar' ? 'تصغير' : 'Zoom out') : (lang === 'ar' ? 'تكبير' : 'Zoom in');

  return createPortal(
    <div dir={rtl ? 'rtl' : 'ltr'} role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-3 md:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3 text-white">
        <span className="rounded-full bg-white/15 px-3 py-1 text-xs backdrop-blur">{n > 1 ? `${index + 1} / ${n}` : ''}</span>
        <button ref={closeBtn} type="button" onClick={onClose} aria-label={t('app.close')} className={btn}>✕</button>
      </div>
      <div className="flex h-full w-full items-center justify-center overflow-hidden">
        <img
          src={fileUrl(images[index])}
          alt={title}
          draggable={false}
          title={zoomLabel}
          onClick={(e) => { setOrigin(point(e)); setZoom((z) => !z); }}
          onMouseMove={(e) => { if (zoom) setOrigin(point(e)); }}
          className={`max-h-full max-w-full select-none object-contain transition-transform duration-300 ease-out ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
          style={{ transform: zoom ? 'scale(2.4)' : 'scale(1)', transformOrigin: `${origin.x}% ${origin.y}%` }}
        />
      </div>
      {n > 1 && (
        <>
          <button type="button" onClick={() => step(rtl ? 1 : -1)} aria-label={rtl ? t('app.next') : t('app.prev')} className={`${btn} absolute left-3 top-1/2 -translate-y-1/2`}><Chevron left /></button>
          <button type="button" onClick={() => step(rtl ? -1 : 1)} aria-label={rtl ? t('app.prev') : t('app.next')} className={`${btn} absolute right-3 top-1/2 -translate-y-1/2`}><Chevron /></button>
        </>
      )}
    </div>,
    document.body,
  );
}
