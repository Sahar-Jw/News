'use client';
import { useEffect } from 'react';
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
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal className={cn('max-h-[90vh] w-full overflow-auto rounded-xl bg-white p-5 shadow-xl', wide ? 'max-w-3xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="close">✕</button>
        </div>
        {children}
      </div>
    </div>
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
