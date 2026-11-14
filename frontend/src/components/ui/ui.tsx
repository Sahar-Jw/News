'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  const t = useI18n()?.t ?? ((k: string) => k);
  return <div className={cn('h-6 w-6 animate-spin rounded-full border-2 border-primary/15 border-t-primary', className)} role="status" aria-label={t('app.loading')} />;
}

export function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[30vh] items-center justify-center text-gray-500">{children}</div>;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'outline'; size?: 'sm' | 'md' };
export function Button({ variant = 'primary', size = 'md', className, onClick, disabled, ...p }: BtnProps) {
  // a click handler that returns a promise (a save, a delete) keeps the button off until it ends: no second press while it is still working
  const [pending, setPending] = useState(false);
  const v = {
    primary: 'bg-primary text-white shadow-md shadow-primary/25 ring-1 ring-inset ring-accent/40 hover:-translate-y-px hover:shadow-lg hover:shadow-primary/30 hover:brightness-110',
    ghost: 'bg-transparent text-ink/80 hover:bg-primary/10 hover:text-primary',
    danger: 'bg-red-600 text-white shadow-md shadow-red-600/20 hover:-translate-y-px hover:bg-red-700',
    outline: 'border border-line bg-white text-ink/85 shadow-sm hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
  }[variant];
  return (
    <button
      {...p}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      onClick={onClick && ((e) => {
        const out: unknown = onClick(e);
        if (out && typeof (out as Promise<unknown>).then === 'function') {
          setPending(true);
          void (out as Promise<unknown>).then(() => setPending(false), () => setPending(false));
        }
      })}
      className={cn('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-200 active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50', size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm', v, className)}
    />
  );
}

export const inputCls = 'w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-gray-400 hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:bg-gray-100';

export function Field({ label, children, hint, error }: { label?: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-semibold text-ink/85">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  );
}

// windows open on top of each other (e.g. a picture preview inside the news form): only the top one reacts to Esc / Tab,
// and the page behind stays locked until the last one closes
const openModals: string[] = [];
let lockedOverflow = '';

/**
 * `brand` = a header band in the colours of the page it opens on (header colour + accent line), e.g. the businesswomen site.
 * The window itself never scrolls: the header stays put and only the content below it scrolls, so the scrollbar sits inside
 * the rounded border instead of on top of it. `closeOnBackdrop={false}` keeps the window open when the dimmed area is clicked
 * (used by long forms, so a stray click does not throw the typed text away).
 */
export function Modal({ open, onClose, title, children, wide, brand, closeOnBackdrop = true }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean; brand?: boolean; closeOnBackdrop?: boolean }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!openModals.length) lockedOverflow = document.body.style.overflow;
    openModals.push(titleId);
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const h = (e: KeyboardEvent) => {
      if (openModals[openModals.length - 1] !== titleId) return;
      if (e.key === 'Escape') close.current();
      if (e.key !== 'Tab' || !dialog.current) return;
      const items = dialog.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])');
      if (!items.length) { e.preventDefault(); dialog.current.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', h);
    return () => {
      window.removeEventListener('keydown', h);
      const at = openModals.indexOf(titleId);
      if (at >= 0) openModals.splice(at, 1);
      if (!openModals.length) document.body.style.overflow = lockedOverflow;
      previous?.focus();
    };
  }, [open, titleId]);
  if (!open) return null;
  return (
    <div className="page-in fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-secondary/40 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : t('app.dialog')} tabIndex={-1} className={cn('flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-line outline-none [animation:pop_0.3s_var(--ease-out)]', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className={cn('shrink-0', brand ? '' : 'px-6 pt-6')}>
          <div className={cn('flex items-center justify-between gap-3', brand ? 'px-6 py-4 text-white' : 'border-b border-line pb-3')} style={brand ? { backgroundColor: 'var(--header-bg, var(--secondary))' } : undefined}>
            {title ? <h3 id={titleId} className="text-lg font-bold">{title}</h3> : <span />}
            <button type="button" onClick={onClose} className={cn('flex h-8 w-8 items-center justify-center rounded-full transition', brand ? 'text-white/85 hover:bg-white/15 hover:text-white' : 'text-gray-500 hover:bg-primary/10 hover:text-primary')} aria-label={t('app.close')}>✕</button>
          </div>
          {brand && <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent" aria-hidden="true" />}
        </div>
        {/* only this part scrolls; the scrollbar stays inside the rounded border */}
        <div className={cn('min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-6', brand ? 'pt-5' : 'pt-4')}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function FilePicker({ label, hint, accept, multiple, onChange }: { label: string; hint?: string; accept?: string; multiple?: boolean; onChange: (files: FileList | null) => void }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState('');
  return (
    <label className="group relative block cursor-pointer rounded-2xl border-2 border-dashed border-line bg-primary/[0.03] p-4 transition hover:border-primary hover:bg-primary/5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) setSelected(multiple ? `${files.length} ${t('app.filesSelected')}` : files[0].name);
          onChange(files);
          e.target.value = '';
        }}
      />
      <span className="flex items-center gap-3">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl text-primary shadow-sm ring-1 ring-line">↑</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-800">{selected || label}</span>
          {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
        </span>
        <span className="shrink-0 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-gray-700 group-hover:border-primary group-hover:text-primary">{multiple ? t('app.chooseFiles') : t('app.chooseFile')}</span>
      </span>
    </label>
  );
}

export function Stars({ value }: { value: number | null | undefined }) {
  const v = value ?? 0;
  return (
    <div className="flex gap-0.5 text-amber-400" aria-label={`${v}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= v ? '' : 'text-gray-300'}>★</span>
      ))}
    </div>
  );
}

/** Password field with a show / hide toggle (eye icon). Takes the same props as <input>. */
export function PasswordInput({ className, ...p }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const label = show ? t('app.hidePassword') : t('app.showPassword');
  return (
    // same direction as the input, so the padding and the button are always on the same side
    <div className="relative" dir={p.dir}>
      <input {...p} type={show ? 'text' : 'password'} className={cn(className, 'pe-10')} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        title={label}
        aria-label={label}
        aria-pressed={show}
        className="absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {/* the icon shows the current state: eye = password visible, crossed eye = hidden */}
          {show ? (
            <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>
          ) : (
            <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></>
          )}
        </svg>
      </button>
    </div>
  );
}
