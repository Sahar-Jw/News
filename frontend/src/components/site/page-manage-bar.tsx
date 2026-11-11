'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button, Modal } from '@/components/ui/ui';

const solid = 'inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110';
const ghost = 'inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-white px-3.5 py-1.5 text-xs font-bold text-primary shadow-sm transition hover:bg-primary/10';

/**
 * Bar at the top of a public page for the people who may manage it (visitors see nothing): buttons that open the add / edit windows
 * right on the page, so nobody has to go to Settings for every change. `show` = the permission check of the page;
 * `settingsUrl` = the page's full screen in Settings (a link, for everything the buttons do not cover).
 */
export function PageManageBar({ show, settingsUrl, children }: { show: boolean; settingsUrl?: string; children?: React.ReactNode }) {
  const { t, href } = useI18n();
  if (!show) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3" data-manage-bar>
      <span className="text-xs font-bold text-primary">⚙ {t('mg.bar')}:</span>
      {children}
      {settingsUrl && <Link href={href(settingsUrl)} className={ghost}>{t('mg.settings')}</Link>}
    </div>
  );
}

export function ManageBtn({ onClick, tone = 'solid', children }: { onClick: () => void; tone?: 'solid' | 'ghost'; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={tone === 'solid' ? solid : ghost}>{children}</button>;
}

/** Small edit / delete buttons under one card (render nothing when the person may do neither). */
export function ItemActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  const { t } = useI18n();
  if (!onEdit && !onDelete) return null;
  const b = 'rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold shadow-sm transition hover:border-primary hover:text-primary';
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5" data-manage>
      {onEdit && <button type="button" className={b} onClick={onEdit}>✎ {t('mg.editItem')}</button>}
      {onDelete && <button type="button" className={`${b} text-red-600 hover:border-red-400 hover:text-red-600`} onClick={onDelete}>🗑 {t('mg.deleteItem')}</button>}
    </div>
  );
}

/** "Delete for good?" window; `onConfirm` does the deleting and the caller closes the window afterwards. */
export function ConfirmDelete({ busy, onConfirm, onClose }: { busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal open onClose={onClose} title={t('mg.deleteTitle')}>
      <p className="mb-5 text-sm">{t('mg.deleteText')}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>{t('app.cancel')}</Button>
        <Button type="button" variant="danger" disabled={busy} onClick={onConfirm}>{t('app.delete')}</Button>
      </div>
    </Modal>
  );
}

/** state helper: the item waiting for the delete confirmation */
export function useDeleteAsk<T>() {
  const [ask, setAsk] = useState<T | null>(null);
  return [ask, setAsk] as const;
}
