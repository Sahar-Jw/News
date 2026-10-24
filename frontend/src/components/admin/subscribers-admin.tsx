'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Modal } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

interface Row { id: number; email: string; isVerified: boolean; isActive: boolean; verifiedAt: string | null; rememberToken: string; createdAt: string }

/** Newsletter subscribers: e-mail, verified?, active?, when it became verified, and its remember token. */
export function SubscribersAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);
  const badge = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const yn = [{ value: 'true', label: t('sub.yes') }, { value: 'false', label: t('sub.no') }];

  const cols: Col<Row>[] = [
    { key: 'email', label: t('sub.email'), render: (r) => <bdi dir="ltr">{r.email}</bdi> },
    { key: 'isVerified', searchable: false, label: t('sub.verified'), render: (r) => badge(r.isVerified), text: (r) => t(r.isVerified ? 'sub.yes' : 'sub.no') },
    { key: 'isActive', searchable: false, label: t('sub.active'), render: (r) => badge(r.isActive), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
    { key: 'verifiedAt', type: 'date', label: t('sub.verifiedAt'), render: (r) => (r.verifiedAt ? fmtDate(lang, r.verifiedAt, true) : '—'), text: (r) => (r.verifiedAt ? fmtDate(lang, r.verifiedAt, true) : '') },
    {
      key: 'rememberToken', label: t('sub.token'),
      render: (r) => (
        <button type="button" title={t('sub.copy')} onClick={() => { navigator.clipboard?.writeText(r.rememberToken).then(() => toast(t('site.copied'))).catch(() => {}); }} className="max-w-[11rem] truncate font-mono text-xs text-gray-600 hover:text-primary">
          <bdi dir="ltr">{r.rememberToken}</bdi>
        </button>
      ),
      text: (r) => r.rememberToken,
    },
    { key: 'createdAt', type: 'date', label: t('sub.createdAt'), render: (r) => fmtDate(lang, r.createdAt, true), text: (r) => fmtDate(lang, r.createdAt, true) },
  ];

  const toggle = async (r: Row, reload: () => void) => {
    try {
      await api(`/admin/subscribers/${r.id}`, { method: 'PATCH', body: { isActive: !r.isActive } });
      toast(t('app.saved'));
      reload();
    } catch (e: any) { toast(e.message, 'err'); }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/subscribers/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (e: any) { toast(e.message, 'err'); }
  };

  return (
    <RequirePerm any={['subscribers.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.subscribers')}</h1>
      <DataTable<Row>
        endpoint="/admin/subscribers"
        columns={cols}
        dateFilter
        refreshKey={key}
        exportable={can('subscribers.export')}
        exportName="subscribers"
        filters={[
          { key: 'isVerified', label: t('sub.verified'), options: yn },
          { key: 'isActive', label: t('sub.active'), options: yn },
        ]}
        bulkDelete={{ path: '/admin/subscribers/bulk-delete', can: can('subscribers.delete') }}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('subscribers.update') && <Button size="sm" variant="outline" onClick={() => toggle(r, reload)}>{t(r.isActive ? 'sub.deactivate' : 'sub.activate')}</Button>}
            {can('subscribers.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{t('app.delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
