'use client';

import { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

/**
 * Opening animation, shown once per new browser tab, but not on reloads in that tab.
 *
 *  1. On a first visit, a full-page cover in the main colour hides the site while its branding loads.
 *  2. Once the logo, site name and font are ready: logo and name form one lockup in the middle, written in together
 *     with a single sweep (left to right, right to left in Arabic), then it holds for a moment.
 *  3. The lockup then zooms in. Logo and name are cut-outs in the cover, so the site shows through their shapes while
 *     they grow past the screen, and the cover clears completely.
 *
 * It reads the site name / logo / colours itself (one small request) because the site shells each have their own settings
 * provider, and this component lives above all of them. With "reduce motion" on, or when nothing can be loaded, the
 * cover just fades away.
 */

const WRITE_AT = 150;
const WRITE_MS = 950; // the sweep that writes the lockup in
const HOLD_MS = 350;
const EXPAND_MS = 850; // the zoom
const MAX_SCALE = 45; // only used when there is no logo
const MAX_WAIT_MS = 4500; // never keep the visitor waiting for assets longer than this
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t: number) => t * t * t;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Geo { W: number; H: number; fs: number; cy: number; baseY: number; logoR: number; logoCx: number; textCx: number; x1: number; x2: number }
interface PublicSettings { branding?: Record<string, unknown> }

function loadImage(src: string) {
  return new Promise<boolean>((resolve) => {
    const im = new Image();
    im.onload = () => resolve(true);
    im.onerror = () => resolve(false);
    im.src = src;
  });
}

/** Logo and name side by side as one lockup, centred on the screen (logo first: on the left, or on the right in Arabic). */
function layout(name: string, hasLogo: boolean, rtl: boolean): Geo {
  const W = window.innerWidth;
  const H = window.innerHeight;
  let fs = Math.min(52, Math.max(24, W * 0.07));
  const logoR = hasLogo ? Math.min(46, Math.max(26, W * 0.085)) : 0;
  const gap = hasLogo && name ? Math.max(12, fs * 0.45) : 0;
  const ctx = document.createElement('canvas').getContext('2d');
  const measure = (size: number) => {
    if (!name) return 0;
    if (!ctx) return size * name.length * 0.6;
    ctx.font = `700 ${size}px "Readex Pro Variable", "IBM Plex Sans Arabic", sans-serif`;
    return ctx.measureText(name).width;
  };
  let tw = measure(fs);
  const room = W * 0.9 - logoR * 2 - gap;
  if (name && tw > room) { fs *= room / tw; tw = room; }
  const total = logoR * 2 + gap + tw;
  const left = W / 2 - total / 2;
  const cy = H / 2;
  const logoCx = rtl ? left + total - logoR : left + logoR;
  const textCx = rtl ? left + tw / 2 : left + logoR * 2 + gap + tw / 2;
  return { W, H, fs, cy, baseY: cy + fs * 0.35, logoR, logoCx, textCx, x1: rtl ? left + total : left, x2: rtl ? left : left + total };
}

export function IntroSplash() {
  const { lang } = useI18n();
  const [geo, setGeo] = useState<Geo | null>(null);
  const [assets, setAssets] = useState<{ name: string; logo: string }>({ name: '', logo: '' });
  const [fade, setFade] = useState(false);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const underRef = useRef<SVGRectElement>(null);
  const coverRef = useRef<SVGRectElement>(null);
  const holeRef = useRef<SVGGElement>(null);
  const logoRef = useRef<SVGGElement>(null);
  const stopA = useRef<SVGStopElement>(null);
  const stopB = useRef<SVGStopElement>(null);

  // 1. wait for the colours, the settings, the logo and the font; then decide how to play
  useEffect(() => {
    let dead = false;
    if (!document.documentElement.hasAttribute('data-intro-pending')) {
      setDone(true);
      return;
    }
    setStarted(true);
    setBlocking(true);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.style.overflow = 'hidden';
    (async () => {
      const started = Date.now();
      // On a new tab, wait for the theme colors if this browser has not cached them yet.
      while (document.documentElement.hasAttribute('data-theme-pending') && Date.now() - started < 2500) await wait(40);
      const settings = await Promise.race([api<PublicSettings>('/public/settings', { cache: 'no-store' }).catch(() => null), wait(3000).then(() => null)]);
      const b = settings?.branding ?? {};
      const rawName = b[`site_name_${lang}`];
      const name = typeof rawName === 'string' ? rawName.trim() : '';
      const rawLogo = typeof b.logo_url === 'string' && b.logo_url ? b.logo_url : b.logo;
      const logo = typeof rawLogo === 'string' ? fileUrl(rawLogo) : '';
      const left = () => Math.max(300, MAX_WAIT_MS - (Date.now() - started));
      const [logoOk] = await Promise.all([
        logo ? Promise.race([loadImage(logo), wait(left()).then(() => false)]) : Promise.resolve(false),
        Promise.race([document.fonts?.load('700 40px "Readex Pro Variable"').catch(() => null), wait(left())]),
      ]);
      if (dead) return;
      if (reduce || (!name && !logoOk)) { setFade(true); return; }
      setAssets({ name, logo: logoOk ? logo : '' });
      setGeo(layout(name, logoOk, lang === 'ar'));
    })();
    return () => { dead = true; document.documentElement.style.overflow = ''; };
  }, [lang]);

  // the cover just fades (reduced motion / nothing to show)
  useEffect(() => {
    if (!fade) return;
    setBlocking(false);
    const id = setTimeout(() => setDone(true), 600);
    return () => clearTimeout(id);
  }, [fade]);

  // 2. the animation itself (one requestAnimationFrame loop, nothing re-renders)
  useEffect(() => {
    if (!geo) return;
    document.documentElement.setAttribute('data-intro-playing', '');
    const SOFT = 0.14;
    const total = WRITE_AT + WRITE_MS + HOLD_MS + EXPAND_MS + 30;
    const t0 = performance.now();
    let raf = 0;
    let unblocked = false;
    // the zoom goes into the logo (a solid shape, so it fills the screen); without a logo, into the middle of the name
    const ox = geo.logoR ? geo.logoCx : geo.textCx;
    const maxScale = geo.logoR ? Math.max(14, (Math.hypot(Math.max(ox, geo.W - ox), Math.max(geo.cy, geo.H - geo.cy)) / geo.logoR) * 1.08) : MAX_SCALE;
    const frame = (now: number) => {
      const t = now - t0;
      // the lockup is written in with one sweep
      const w = easeInOut(clamp01((t - WRITE_AT) / WRITE_MS));
      const a = w * (1 + SOFT) - SOFT;
      stopA.current?.setAttribute('offset', String(clamp01(a)));
      stopB.current?.setAttribute('offset', String(clamp01(a + SOFT)));
      // zoom
      const u = clamp01((t - (WRITE_AT + WRITE_MS + HOLD_MS)) / EXPAND_MS);
      if (u > 0 && !unblocked) { unblocked = true; setBlocking(false); }
      const s = 1 + (maxScale - 1) * easeIn(u);
      holeRef.current?.setAttribute('transform', `translate(${ox} ${geo.cy}) scale(${s}) translate(${-ox} ${-geo.cy})`);
      underRef.current?.setAttribute('opacity', String(1 - clamp01(u / 0.12)));
      coverRef.current?.setAttribute('opacity', String(1 - clamp01((u - 0.88) / 0.12)));
      if (logoRef.current) {
        // the picture shows as the sweep passes it, then gives way to the cut-out
        const reach = clamp01((w - 0.02) / 0.25);
        logoRef.current.setAttribute('transform', `translate(${ox} ${geo.cy}) scale(${s}) translate(${-ox} ${-geo.cy})`);
        logoRef.current.setAttribute('opacity', String(reach * (1 - clamp01(u / 0.1))));
      }
      if (t < total) raf = requestAnimationFrame(frame);
      else setDone(true);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [geo, lang]);

  useEffect(() => {
    if (done) {
      document.documentElement.style.overflow = '';
      document.documentElement.removeAttribute('data-intro-pending');
      document.documentElement.removeAttribute('data-intro-playing');
    }
  }, [done]);

  if (done) return null;
  const common = 'fixed inset-0 z-[2147483000]';
  const style = { background: 'var(--primary)', pointerEvents: blocking ? ('auto' as const) : ('none' as const) };

  if (!started) return <div id="splash" aria-hidden="true" className={`${common} pointer-events-none opacity-0`} />;

  if (!geo) {
    return <div id="splash" aria-hidden="true" className={`${common} transition-opacity duration-500 ${fade ? 'opacity-0' : ''}`} style={style} />;
  }

  const { W, H, fs, cy, baseY, logoR, logoCx, textCx, x1, x2 } = geo;
  return (
    <div id="splash" aria-hidden="true" className={common} style={{ pointerEvents: style.pointerEvents }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        <defs>
          {/* spans the whole lockup: black behind the "pen" (cut out of the cover), white ahead of it (still covered) */}
          <linearGradient id="sp-grad" gradientUnits="userSpaceOnUse" x1={x1} x2={x2} y1="0" y2="0">
            <stop offset="0" stopColor="#000" />
            <stop ref={stopA} offset="0" stopColor="#000" />
            <stop ref={stopB} offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id="sp-hole" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            <rect x="0" y="0" width={W} height={H} fill="#fff" />
            <g ref={holeRef}>
              {assets.logo && <circle cx={logoCx} cy={cy} r={logoR} fill="url(#sp-grad)" />}
              {assets.name && <text x={textCx} y={baseY} textAnchor="middle" fill="url(#sp-grad)" fontWeight="700" fontSize={fs} style={{ fontFamily: '"Readex Pro Variable", "IBM Plex Sans Arabic", sans-serif' }}>{assets.name}</text>}
            </g>
          </mask>
          <clipPath id="sp-logo-clip"><circle r={logoR} cx={logoCx} cy={cy} /></clipPath>
        </defs>
        {/* what the cut-outs show while the lockup is written: plain white; it fades away as the zoom starts */}
        <rect ref={underRef} x="0" y="0" width={W} height={H} fill="#fff" />
        <rect ref={coverRef} x="0" y="0" width={W} height={H} mask="url(#sp-hole)" style={{ fill: 'var(--primary)' }} />
        {assets.logo && (
          <g ref={logoRef} opacity="0">
            <image href={assets.logo} x={logoCx - logoR} y={cy - logoR} width={logoR * 2} height={logoR * 2} preserveAspectRatio="xMidYMid slice" clipPath="url(#sp-logo-clip)" />
          </g>
        )}
      </svg>
    </div>
  );
}
