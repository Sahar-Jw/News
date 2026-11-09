'use client';

import { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

/**
 * Opening animation, shown once per new browser tab, but not on reloads in that tab.
 *
 *  1. On a first visit, a full-page cover in the main colour hides the site while its branding loads.
 *  2. Once the logo, site name and font are ready: the logo and the name appear together on ONE line in the center.
 *  3. The whole line (logo + name) then expands together. Both the name and the logo are cut-outs in the cover, so the
 *     site shows through the letters and through the logo while they grow, and in the end the cover clears completely.
 *
 * It reads the site name / logo / colours itself (one small request) because the site shells each have their own settings
 * provider, and this component lives above all of them. With "reduce motion" on, or when nothing can be loaded, the
 * cover just fades away.
 */

const LOGO_IN_MS = 500;
const WRITE_AT = 250;
const WRITE_MS = 1100;
const HOLD_MS = 250;
const EXPAND_MS = 900;
const MAX_SCALE = 20;
const MAX_WAIT_MS = 4500; // never keep the visitor waiting for assets longer than this
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t: number) => t * t * t;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Geo { W: number; H: number; fs: number; cx: number; cy: number; textX: number; baseY: number; logoR: number; logoX: number }
interface PublicSettings { branding?: Record<string, unknown> }

function loadImage(src: string) {
  return new Promise<boolean>((resolve) => {
    const im = new Image();
    im.onload = () => resolve(true);
    im.onerror = () => resolve(false);
    im.src = src;
  });
}

function layout(name: string, hasLogo: boolean, rtl: boolean): Geo {
  const W = window.innerWidth;
  const H = window.innerHeight;
  let fs = Math.min(56, Math.max(26, W * 0.075));
  const ctx = document.createElement('canvas').getContext('2d');
  const measure = (size: number) => {
    if (!name) return 0;
    if (!ctx) return size * name.length * 0.6;
    ctx.font = `700 ${size}px "Readex Pro Variable", "IBM Plex Sans Arabic", sans-serif`;
    return ctx.measureText(name).width;
  };
  // everything is sized from the font size, so the logo + name line shrinks as one piece on narrow screens
  const logoK = 0.7;
  const gapK = 0.4;
  let tw = measure(fs);
  const total = () => (hasLogo ? fs * logoK * 2 : 0) + (hasLogo && name ? fs * gapK : 0) + tw;
  const maxW = W * 0.9;
  if (total() > maxW) { const k = maxW / total(); fs *= k; tw *= k; }
  const logoR = hasLogo ? fs * logoK : 0;
  const gap = hasLogo && name ? fs * gapK : 0;
  const line = logoR * 2 + gap + tw;
  const left = W / 2 - line / 2;
  const cy = H / 2;
  // logo first in reading order: on the left in LTR, on the right in RTL
  const logoX = rtl ? left + tw + gap + logoR : left + logoR;
  const textX = rtl ? left + tw / 2 : left + logoR * 2 + gap + tw / 2;
  return { W, H, fs, cx: W / 2, cy, textX: name ? textX : W / 2, logoX: hasLogo ? logoX : W / 2, logoR, baseY: cy + fs * 0.35 };
}

export function IntroSplash() {
  const { lang, dir } = useI18n();
  const [geo, setGeo] = useState<Geo | null>(null);
  const [assets, setAssets] = useState<{ name: string; logo: string }>({ name: '', logo: '' });
  const [fade, setFade] = useState(false);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const underRef = useRef<SVGRectElement>(null);
  const coverRef = useRef<SVGRectElement>(null);
  const holeRef = useRef<SVGGElement>(null);
  const logoHoleRef = useRef<SVGGElement>(null);
  const logoWrapRef = useRef<SVGGElement>(null);
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
      setGeo(layout(name, logoOk, dir === 'rtl'));
    })();
    return () => { dead = true; document.documentElement.style.overflow = ''; };
  }, [lang, dir]);

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
    const SOFT = 0.14;
    const total = WRITE_AT + WRITE_MS + HOLD_MS + EXPAND_MS;
    const t0 = performance.now();
    let raf = 0;
    let unblocked = false;
    const frame = (now: number) => {
      const t = now - t0;
      // logo comes in
      const li = easeOut(clamp01(t / LOGO_IN_MS));
      // the name is written
      const w = easeInOut(clamp01((t - WRITE_AT) / WRITE_MS));
      const a = w * (1 + SOFT) - SOFT;
      stopA.current?.setAttribute('offset', String(clamp01(a)));
      stopB.current?.setAttribute('offset', String(clamp01(a + SOFT)));
      // expansion
      const u = clamp01((t - (WRITE_AT + WRITE_MS + HOLD_MS)) / EXPAND_MS);
      const e = easeIn(u);
      if (u > 0 && !unblocked) { unblocked = true; setBlocking(false); }
      const s = 1 + (MAX_SCALE - 1) * e;
      // the whole line (logo + name) grows together around the center of the line
      const grow = `translate(${geo.cx} ${geo.cy}) scale(${s}) translate(${-geo.cx} ${-geo.cy})`;
      holeRef.current?.setAttribute('transform', grow);
      logoWrapRef.current?.setAttribute('transform', grow);
      underRef.current?.setAttribute('opacity', String(1 - clamp01(u / 0.22)));
      coverRef.current?.setAttribute('opacity', String(1 - clamp01((u - 0.72) / 0.28)));
      // the logo picture fades out as it grows, so the site shows through the logo's cut-out too
      const ls = 0.7 + 0.3 * li;
      logoHoleRef.current?.setAttribute('transform', `translate(${geo.logoX} ${geo.cy}) scale(${ls})`);
      logoHoleRef.current?.setAttribute('opacity', String(li));
      if (logoRef.current) {
        logoRef.current.setAttribute('transform', `translate(${geo.logoX} ${geo.cy}) scale(${ls})`);
        logoRef.current.setAttribute('opacity', String(li * (1 - clamp01(u / 0.45))));
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
    }
  }, [done]);

  if (done) return null;
  const common = 'fixed inset-0 z-[2147483000]';
  const style = { background: 'var(--primary)', pointerEvents: blocking ? ('auto' as const) : ('none' as const) };

  if (!started) return <div id="splash" aria-hidden="true" className={`${common} pointer-events-none opacity-0`} />;

  if (!geo) {
    return <div id="splash" aria-hidden="true" className={`${common} transition-opacity duration-500 ${fade ? 'opacity-0' : ''}`} style={style} />;
  }

  const { W, H, fs, textX, baseY, logoR, logoX, cy } = geo;
  return (
    <div id="splash" aria-hidden="true" className={common} style={{ pointerEvents: style.pointerEvents }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        <defs>
          <linearGradient id="sp-grad" x1={lang === 'ar' ? '1' : '0'} x2={lang === 'ar' ? '0' : '1'} y1="0" y2="0">
            <stop offset="0" stopColor="#000" />
            <stop ref={stopA} offset="0" stopColor="#000" />
            <stop ref={stopB} offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id="sp-hole" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            <rect x="0" y="0" width={W} height={H} fill="#fff" />
            <g ref={holeRef}>
              {assets.name && (
                // black = cut out of the cover; the gradient is black behind the "pen" and white ahead of it, so the name is written
                <text x={textX} y={baseY} textAnchor="middle" fill="url(#sp-grad)" fontWeight="700" fontSize={fs} style={{ fontFamily: '"Readex Pro Variable", "IBM Plex Sans Arabic", sans-serif' }}>{assets.name}</text>
              )}
              {assets.logo && (
                <g ref={logoHoleRef} opacity="0" transform={`translate(${logoX} ${cy}) scale(0.7)`}>
                  <circle r={logoR + 3} cx="0" cy="0" fill="#000" />
                </g>
              )}
            </g>
          </mask>
          <clipPath id="sp-logo-clip"><circle r={logoR} cx="0" cy="0" /></clipPath>
        </defs>
        {/* what the name shows while it is a cut-out: plain white, which fades away when the name starts to expand */}
        <rect ref={underRef} x="0" y="0" width={W} height={H} fill="#fff" />
        <rect ref={coverRef} x="0" y="0" width={W} height={H} mask="url(#sp-hole)" style={{ fill: 'var(--primary)' }} />
        {assets.logo && (
          <g ref={logoWrapRef}>
            <g ref={logoRef} opacity="0" transform={`translate(${logoX} ${cy}) scale(0.7)`}>
              <circle r={logoR + 3} fill="#fff" />
              <image href={assets.logo} x={-logoR} y={-logoR} width={logoR * 2} height={logoR * 2} preserveAspectRatio="xMidYMid slice" clipPath="url(#sp-logo-clip)" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}