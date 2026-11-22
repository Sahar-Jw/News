'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button, Modal } from '@/components/ui/ui';

/**
 * The site's own "are you sure?" window, used instead of the browser's confirm() box:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ message: t('tbl.confirmDelete'), danger: true }))) return;
 * It resolves to true (confirmed) or false (cancelled, Esc, or a click outside).
 */
export interface ConfirmOptions {
  message: string;
  title?: string;
  /** text of the confirm button (default: "Delete" when `danger`, else "Confirm") */
  confirmLabel?: string;
  /** red confirm button, for things that cannot be undone */
  danger?: boolean;
}
type Ask = (o: ConfirmOptions | string) => Promise<boolean>;

const Ctx = createContext<Ask>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const ask = useCallback<Ask>((o) => new Promise<boolean>((resolve) => {
    resolver.current?.(false); // a second question while one is open: the first one is cancelled
    resolver.current = resolve;
    setOpts(typeof o === 'string' ? { message: o } : o);
  }), []);

  const done = (v: boolean) => {
    const r = resolver.current;
    resolver.current = null;
    setOpts(null);
    r?.(v);
  };

  return (
    <Ctx.Provider value={ask}>
      {children}
      <Modal open={!!opts} onClose={() => done(false)} title={opts?.title ?? t('app.confirm')}>
        {opts && (
          <>
            <p className="mb-5 whitespace-pre-line text-sm leading-7">{opts.message}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => done(false)}>{t('app.cancel')}</Button>
              <Button type="button" variant={opts.danger ? 'danger' : 'primary'} onClick={() => done(true)}>{opts.confirmLabel ?? (opts.danger ? t('app.delete') : t('app.confirm'))}</Button>
            </div>
          </>
        )}
      </Modal>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);
