'use client';
import { useState } from 'react';

/** Header dropdown (hover, focus or click) used by the separate-identity sites. Desktop only; the mobile menu lists the items directly. */
export function BrandedDropdown({ label, trigger, children, align = 'start', active = false }: { label: string; trigger?: React.ReactNode; children: React.ReactNode; align?: 'start' | 'end'; active?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [closedByClick, setClosedByClick] = useState(false);
  const expanded = open || (hovering && !closedByClick);
  const panelState = expanded ? 'visible translate-y-0 scale-100 opacity-100 pointer-events-auto' : 'invisible translate-y-2 scale-[0.98] opacity-0 pointer-events-none';
  const toggle = () => { setOpen((v) => !v); setClosedByClick(expanded); };
  return (
    <div className="group relative hidden xl:block"
      onMouseEnter={() => { setHovering(true); setClosedByClick(false); }}
      onMouseLeave={() => { setHovering(false); setClosedByClick(false); }}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      {trigger ? (
        <button type="button" aria-label={label} aria-haspopup="true" aria-expanded={expanded} onClick={toggle} className="relative z-10 rounded-full">{trigger}</button>
      ) : (
        <button type="button" aria-haspopup="true" aria-expanded={expanded} onClick={toggle} className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition duration-200 hover:bg-white/15 hover:text-accent ${active || expanded ? 'bg-white/15 text-accent' : 'text-white/90'}`}>
          {label}
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}><path d="m3 6 5 5 5-5" /></svg>
        </button>
      )}
      <div className={`absolute top-full z-50 origin-top pt-1 transition-[opacity,transform,visibility] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${panelState} ${align === 'end' ? 'end-0 min-w-52' : 'start-0 min-w-52'}`}>
        <div onClickCapture={() => { setOpen(false); setClosedByClick(true); (document.activeElement as HTMLElement | null)?.blur?.(); }} className="max-h-72 overflow-y-auto overscroll-contain rounded-2xl bg-white/95 p-2 text-ink shadow-lift ring-1 ring-line backdrop-blur-xl">{children}</div>
      </div>
    </div>
  );
}
