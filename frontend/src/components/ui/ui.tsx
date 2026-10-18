'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <div className={cn('h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary', className)} aria-label="loading" />;
}

export function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[30vh] items-center justify-center text-gray-500">{children}</div>;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'outline'; size?: 'sm' | 'md' };
export function Button({ variant = 'primary', size = 'md', className, ...p }: BtnProps) {
  const v = {
    primary: 'bg-primary text-white hover:opacity-90',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  }[variant];
  return (
    <button
      {...p}
      className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm', v, className)}
    />
  );
}

export const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-100';

export function Field({ label, children, hint, error }: { label?: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block space-y-1">
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      {error && <span className="block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; wide?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const h = (e: KeyboardEvent) => {
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
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : 'Dialog'} tabIndex={-1} className={cn('max-h-[90vh] w-full overflow-auto rounded-xl bg-white p-5 shadow-2xl outline-none', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="mb-4 flex items-center justify-between">
          {title ? <h3 id={titleId} className="text-lg font-bold">{title}</h3> : <span />}
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FilePicker({ label, hint, accept, multiple, onChange }: { label: string; hint?: string; accept?: string; multiple?: boolean; onChange: (files: FileList | null) => void }) {
  const [selected, setSelected] = useState('');
  return (
    <label className="group relative block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 transition hover:border-primary hover:bg-blue-50/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length) setSelected(multiple ? `${files.length} files selected` : files[0].name);
          onChange(files);
          e.target.value = '';
        }}
      />
      <span className="flex items-center gap-3">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-xl text-primary shadow-sm">↑</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-800">{selected || label}</span>
          {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
        </span>
        <span className="shrink-0 rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 group-hover:border-primary group-hover:text-primary">{multiple ? 'Choose files' : 'Choose file'}</span>
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
