'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { APPLICATION_KINDS, APPLICATION_STATUSES } from '@/components/site/expo-shared';

interface Row { id: number; kind: string; status: string; name: string; company: string; email: string; phone: string; sector: string; message: string; adminNote: string; createdAt: string }
const BADGE: Record<string, string> = { new: 'bg-sky-100 text-sky-700', in_review: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700' };

/** Requests sent from the EXPO site: stand requests, visitor registrations and information requests. Process (status + note), filter, export. */
export function ExpoApplicationsAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [edit, setEdit] = useState<{ row: Row; status: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const cols: Col<Row>[] = [
    { key: 'kind', searchable: false, label: t('ex.a.type'), render: (r) => t(`ex.kind.${r.kind}`), text: (r) => t(`ex.kind.${r.kind}`) },
    { key: 'status', searchable: false, label: t('tr.status'), render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${BADGE[r.status] ?? ''}`}>{t(`ex.status.${r.status}`)}</span>, text: (r) => t(`ex.status.${r.status}`) },
    { key: 'name', label: t('tr.fullName') },
    { key: 'company', label: t('ex.f.company') },
    { key: 'email', label: t('contact.email') },
    { key: 'phone', label: t('site.phone') },
    { key: 'sector', label: t('ex.f.sector') },
    { key: 'message', label: t('contact.message') },
    { key: 'createdAt', label: t('ex.a.sentAt'), render: (r) => fmtDate(lang, r.createdAt, true), text: (r) => fmtDate(lang, r.createdAt, true) },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    try {
      await api(`/admin/expo-applications/${edit.row.id}`, { method: 'PATCH', body: { status: edit.status, adminNote: edit.note.trim() } });
      toast(t('app.saved'));
      setEdit(null);
      setKey((k) => k + 1);
    } catch (e2: any) { toast(e2.message, 'err'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/expo-applications/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (e2: any) { toast(e2.message, 'err'); }
  };

  return (
    <RequirePerm any={['expo.applications.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.expoApplications')}</h1>
      <DataTable<Row>
        endpoint="/admin/expo-applications"
        columns={cols}
        refreshKey={key}
        dateFilter
        exportable={can('expo.applications.export')}
        exportName="expo-applications"
        filters={[
          { key: 'kind', label: t('ex.a.type'), options: APPLICATION_KINDS.map((k) => ({ value: k, label: t(`ex.kind.${k}`) })) },
          { key: 'status', label: t('tr.status'), options: APPLICATION_STATUSES.map((k) => ({ value: k, label: t(`ex.status.${k}`) })) },
        ]}
        bulkDelete={{ path: '/admin/expo-applications/bulk-delete', can: can('expo.applications.delete') }}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('expo.applications.update') && <Button size="sm" variant="outline" onClick={() => setEdit({ row: r, status: r.status, note: r.adminNote })}>{t('ex.a.process')}</Button>}
            {can('expo.applications.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `${t(`ex.kind.${edit.row.kind}`)}: ${edit.row.name}` : ''}>
        {edit && (
          <form onSubmit={save} className="space-y-3">
            <dl className="grid gap-1 rounded-lg bg-gray-50 p-3 text-sm">
              {edit.row.company && <div>🏢 {edit.row.company}</div>}
              <div dir="ltr" className="text-start">✉ {edit.row.email} · ☎ {edit.row.phone}</div>
              {edit.row.sector && <div>{t('ex.f.sector')}: {edit.row.sector}</div>}
              {edit.row.message && <div className="whitespace-pre-line">{edit.row.message}</div>}
            </dl>
            <Field label={t('tr.status')}><select className={inputCls} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{APPLICATION_STATUSES.map((k) => <option key={k} value={k}>{t(`ex.status.${k}`)}</option>)}</select></Field>
            <Field label={t('ex.a.note')}><textarea rows={3} maxLength={3000} className={inputCls} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEdit(null)}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
          </form>
        )}
      </Modal>
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{t('app.delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
