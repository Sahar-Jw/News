'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** one top-level entry of a menu as the visitor sees it: a standalone link, or a dropdown with its links */
export interface PreviewEntry { kind: 'link' | 'dropdown'; title: string; active: boolean; items: { title: string; active: boolean }[] }

export interface PreviewConfig {
  /** `main`: the light bar of the chamber site; `branded`: the dark bar of the Women committee / DCC EXPO sites */
  variant: 'main' | 'branded';
  /** share of the screen width the menu may use (Women: 0.55, EXPO: 0.52, 0.62 from 1536px); main menu: the rest of the row */
  maxShare?: (w: number) => number;
  /** estimated width (px) of the logo + name block and of the buttons on the other side of the bar */
  brandWidth: number;
  actionsWidth: number;
  /** fixed links the site always draws around the editable ones (e.g. Home / Contact) */
  before?: string[];
  after?: string[];
}

export const MAIN_PREVIEW: PreviewConfig = { variant: 'main', brandWidth: 250, actionsWidth: 0 };
export const WOMEN_PREVIEW: PreviewConfig = { variant: 'branded', maxShare: () => 0.55, brandWidth: 230, actionsWidth: 130 };
export const EXPO_PREVIEW: PreviewConfig = { variant: 'branded', maxShare: (w) => (w >= 1536 ? 0.62 : 0.52), brandWidth: 200, actionsWidth: 380 };

const SIZES = [1280, 1536, 1920] as const;
const MOBILE = 390;

/** px available to the menu at screen width `w` (the real headers hide the menu under 1280px and show the hamburger instead) */
function available(cfg: PreviewConfig, w: number) {
  const row = Math.min(w, 1280) - 32; // max-w-7xl with px-4
  if (cfg.variant === 'main') return row - cfg.brandWidth - 16; // one row: the language button and the search are part of the menu itself
  return Math.min(row - cfg.brandWidth - cfg.actionsWidth - 24, (cfg.maxShare?.(w) ?? 0.55) * w);
}

const Chevron = ({ open }: { open?: boolean }) => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={open ? 'rotate-180' : ''}><path d="m3 6 5 5 5-5" /></svg>
);

/**
 * Live preview of a menu bar, drawn from the unsaved draft: the same pill sizes and fonts as the real header, at the real screen widths,
 * with the dropdowns that open on click, the mobile menu, and a check that tells whether the menu fits in the bar or would overflow it.
 */
export function NavPreview({ entries, cfg, lang, title }: { entries: PreviewEntry[]; cfg: PreviewConfig; lang: 'ar' | 'en'; title?: string }) {
  const ar = lang === 'ar';
  const [size, setSize] = useState<number>(1280);
  const [open, setOpen] = useState<number | null>(null);
  const [mobileOpen, setMobileOpen] = useState(true);
  const [natural, setNatural] = useState(0);
  const [scale, setScale] = useState(1);
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const [innerH, setInnerH] = useState(80);

  // what visitors see: hidden entries and dropdowns without a visible link are not drawn
  const shown = entries.map((e) => ({ ...e, items: e.items.filter((i) => i.active) })).filter((e) => e.active && (e.kind === 'link' || e.items.length > 0));
  const hidden = entries.length - shown.length;
  const before = cfg.before ?? [];
  const after = cfg.after ?? [];
  const mobile = size === MOBILE;
  const dark = cfg.variant === 'branded';

  const pill = `flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold ${dark ? 'text-white hover:bg-white/15' : 'text-ink/80 hover:bg-primary/10 hover:text-primary'}`;
  const pillOn = dark ? 'bg-white/15' : 'bg-primary/10 text-primary';

  // natural width of the whole menu (independent of the screen width): measured from a hidden, unwrapped copy
  const sig = JSON.stringify([shown, before, after, lang]);
  useLayoutEffect(() => { if (measure.current) setNatural(measure.current.offsetWidth); }, [sig]);

  // fit the frame (a real-width header) into the column
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / size));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setInnerH(el.offsetHeight));
    ro.observe(el);
    setInnerH(el.offsetHeight);
    return () => ro.disconnect();
  }, [size, open, mobileOpen, sig]);
  useEffect(() => { setOpen(null); }, [size, sig]);

  const fits = SIZES.map((w) => ({ w, avail: Math.floor(available(cfg, w)), ok: natural <= available(cfg, w) }));
  const cur = fits.find((f) => f.w === size);
  const over = cur && !cur.ok ? Math.ceil(natural - cur.avail) : 0;

  const items = (
    <>
      {before.map((b) => <span key={`b-${b}`} className={pill}>{b}</span>)}
      {shown.map((e, i) => e.kind === 'link'
        ? <span key={i} className={pill}>{e.title || '—'}</span>
        : (
          <span key={i} className="relative shrink-0">
            <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className={`${pill} ${open === i ? pillOn : ''}`}>{e.title || '—'}<Chevron open={open === i} /></button>
            {open === i && !mobile && (
              <span className="absolute top-full z-20 block pt-1 start-0 min-w-52">
                <span className="block max-h-72 overflow-y-auto rounded-2xl bg-white p-2 text-ink shadow-lift ring-1 ring-line">
                  {e.items.map((it, k) => <span key={k} className="block rounded-xl px-3 py-2 text-sm hover:bg-primary/10 hover:text-primary">{it.title || '—'}</span>)}
                </span>
              </span>
            )}
          </span>
        ))}
      {after.map((b) => <span key={`a-${b}`} className={pill}>{b}</span>)}
    </>
  );

  const utils = (
    <>
      <span className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold ${dark ? 'border-white/40 text-white' : 'border-line text-primary'}`}>{ar ? 'EN' : 'AR'}</span>
      <span className={`grid h-10 w-10 place-items-center rounded-full ${dark ? 'text-white' : 'text-primary'}`}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </span>
    </>
  );

  const brand = (
    <span className="flex shrink-0 items-center gap-3" style={{ width: cfg.brandWidth }}>
      <span className={`h-10 w-10 shrink-0 rounded-full ${dark ? 'bg-white/90' : 'bg-primary/15 ring-1 ring-accent/50'}`} />
      <span className={`h-3 flex-1 rounded-full ${dark ? 'bg-white/50' : 'bg-gray-300'}`} />
    </span>
  );

  return (
    <section className="mb-6 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line" aria-label={ar ? 'معاينة مباشرة' : 'Live preview'}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-gray-50 px-4 py-2">
        <span className="text-xs font-semibold text-gray-600">{title ?? (ar ? 'معاينة مباشرة (قبل الحفظ)' : 'Live preview (before saving)')}</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label={ar ? 'عرض المعاينة' : 'Preview width'}>
          {[...SIZES, MOBILE].map((w) => {
            const f = fits.find((x) => x.w === w);
            return (
              <button key={w} type="button" onClick={() => setSize(w)} aria-pressed={size === w}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${size === w ? 'bg-primary text-white' : 'bg-white text-gray-600 ring-1 ring-line hover:text-primary'}`}>
                {w === MOBILE ? (ar ? 'جوال' : 'Mobile') : `${w}px`}
                {f && <span aria-hidden="true" className={`ms-1 inline-block h-2 w-2 rounded-full ${f.ok ? 'bg-emerald-500' : 'bg-red-500'}`} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* hidden unwrapped copy used to measure the real width of the menu */}
      <div aria-hidden="true" className="pointer-events-none invisible absolute -z-10 h-0 overflow-hidden" dir={ar ? 'rtl' : 'ltr'}>
        <div ref={measure} className="flex w-max items-center gap-1 font-body">{items}{dark ? null : utils}</div>
      </div>

      <div ref={outer} className="overflow-hidden bg-gray-100 p-3">
        <div style={{ height: innerH * scale }}>
          <div ref={inner} dir={ar ? 'rtl' : 'ltr'} style={{ width: size, transform: `scale(${scale})`, transformOrigin: ar ? 'top right' : 'top left', paddingBottom: open !== null && !mobile ? 300 : 0 }}
            className={`${dark ? 'bg-secondary text-white' : 'bg-white text-ink'} ${open !== null && !mobile ? '' : ''} shadow`}>
            {mobile ? (
              <div className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  {brand}
                  <button type="button" onClick={() => setMobileOpen((v) => !v)} aria-expanded={mobileOpen} aria-label={ar ? 'القائمة' : 'Menu'} className={`grid h-10 w-10 place-items-center rounded-full border ${dark ? 'border-white/40' : 'border-line bg-white'}`}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">{mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
                  </button>
                </div>
                {mobileOpen && (
                  <div className="mt-2 flex flex-col gap-1 border-t border-white/15 pt-2">
                    {before.map((b) => <span key={b} className={`${pill} w-full`}>{b}</span>)}
                    {shown.map((e, i) => (
                      <div key={i}>
                        {e.kind === 'link'
                          ? <span className={`${pill} w-full`}>{e.title || '—'}</span>
                          : <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className={`${pill} w-full justify-between ${open === i ? pillOn : ''}`}>{e.title || '—'}<Chevron open={open === i} /></button>}
                        {e.kind === 'dropdown' && open === i && (
                          <div className={`mt-1 space-y-0.5 rounded-2xl p-2 ${dark ? 'bg-white/10' : 'bg-primary/5'}`}>
                            {e.items.map((it, k) => <span key={k} className="block rounded-xl px-3 py-2 text-sm">{it.title || '—'}</span>)}
                          </div>
                        )}
                      </div>
                    ))}
                    {after.map((b) => <span key={b} className={`${pill} w-full`}>{b}</span>)}
                  </div>
                )}
              </div>
            ) : (
              <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5" style={{ width: '100%' }}>
                {brand}
                <div className="ms-auto flex shrink-0 items-center" style={{ width: cur?.avail }}>
                  <div className={`flex w-max items-center gap-1 ${over ? 'rounded-full ring-2 ring-red-500' : ''} ms-auto`}>{items}{dark ? null : utils}</div>
                </div>
                {dark && <span className="h-8 shrink-0 rounded-full bg-white/20" style={{ width: cfg.actionsWidth - 24 }} />}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1 border-t border-line px-4 py-2 text-xs">
        {!mobile && over > 0 && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 font-semibold text-red-700">
            {ar ? `القائمة لا تتسع في الشريط عند عرض ${size}px: تزيد بنحو ${over}px وستتجاوز حدود الشريط. اختصر الأسماء أو انقل روابط إلى قائمة منسدلة أو أخفِ بعضها.` : `The menu does not fit the bar at ${size}px: it is about ${over}px too wide and would overflow. Shorten names, move links into a dropdown or hide some.`}
          </p>
        )}
        {!mobile && over === 0 && natural > 0 && <p className="font-semibold text-emerald-700">{ar ? `القائمة تتسع في الشريط عند ${size}px.` : `The menu fits the bar at ${size}px.`}</p>}
        {mobile && <p className="text-gray-600">{ar ? 'على الجوال والأجهزة اللوحية (أقل من 1280px) تظهر القائمة كزر يفتح قائمة عمودية، فلا تتجاوز الشريط.' : 'Under 1280px the menu is a button that opens a vertical list, so it cannot overflow the bar.'}</p>}
        <p className="text-gray-500">
          {entries.length ? `${shown.length}/${entries.length} ${ar ? 'ظاهر' : 'shown'}` : ''}
          {hidden > 0 ? ` — ${hidden} ${ar ? 'مخفي أو فارغ فلا يظهر للزوار' : 'hidden or empty, not shown to visitors'}` : ''}
          {' — '}{ar ? 'اضغط على قائمة منسدلة لرؤية روابطها.' : 'Click a dropdown to see its links.'}
        </p>
      </div>
    </section>
  );
}

/** footer links of the Women / EXPO sites: dropdowns become columns, standalone links a row */
export function FooterPreview({ entries, lang }: { entries: PreviewEntry[]; lang: 'ar' | 'en' }) {
  const ar = lang === 'ar';
  const shown = entries.map((e) => ({ ...e, items: e.items.filter((i) => i.active) })).filter((e) => e.active && (e.kind === 'link' || e.items.length > 0));
  const singles = shown.filter((e) => e.kind === 'link');
  const groups = shown.filter((e) => e.kind === 'dropdown');
  return (
    <section className="mb-6 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line" aria-label={ar ? 'معاينة التذييل' : 'Footer preview'}>
      <div className="border-b border-line bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600">{ar ? 'معاينة مباشرة للتذييل (قبل الحفظ)' : 'Live footer preview (before saving)'}</div>
      <div dir={ar ? 'rtl' : 'ltr'} className="bg-secondary px-5 py-5 text-white">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g, i) => (
            <div key={i} className="min-w-0">
              <div className="mb-2 break-words text-sm font-extrabold">{g.title || '—'}</div>
              <ul className="space-y-1 text-sm text-white/80">{g.items.map((it, k) => <li key={k} className="break-words">{it.title || '—'}</li>)}</ul>
            </div>
          ))}
          {singles.length > 0 && (
            <div className="min-w-0">
              <ul className="space-y-1 text-sm text-white/80">{singles.map((s, k) => <li key={k} className="break-words">{s.title || '—'}</li>)}</ul>
            </div>
          )}
        </div>
        {!shown.length && <p className="text-sm text-white/60">—</p>}
      </div>
    </section>
  );
}
