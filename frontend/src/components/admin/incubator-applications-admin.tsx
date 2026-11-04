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

const STATUSES = ['new', 'in_review', 'accepted', 'rejected'] as const;
interface Row { id: number; status: string; projectName: string; founderName: string; email: string; phone: string; sector: string; stage: string; description: string; adminNote: string; createdAt: string }
const BADGE: Record<string, string> = { new: 'bg-sky-100 text-sky-700', in_review: 'bg-amber-100 text-amber-700', accepted: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700' };

/** "Submit your project" requests: statuses (new / in review / accepted / rejected), internal note, export. */
export function IncubatorApplicationsAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [edit, setEdit] = useState<{ row: Row; status: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const cols: Col<Row>[] = [
    { key: 'status', searchable: false, label: t('tr.status'), render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${BADGE[r.status] ?? ''}`}>{t(`inc.appstatus.${r.status}`)}</span>, text: (r) => t(`inc.appstatus.${r.status}`) },
    { key: 'projectName', label: t('inc.project') },
    { key: 'founderName', label: t('inc.founder') },
    { key: 'email', label: t('contact.email') },
    { key: 'phone', label: t('site.phone') },
    { key: 'sector', label: t('ex.f.sector') },
    { key: 'stage', searchable: false, label: t('inc.stage'), render: (r) => (r.stage ? t(`inc.stage.${r.stage}`) : ''), text: (r) => (r.stage ? t(`inc.stage.${r.stage}`) : '') },
    { key: 'createdAt', label: t('ex.a.sentAt'), render: (r) => fmtDate(lang, r.createdAt, true), text: (r) => fmtDate(lang, r.createdAt, true) },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    try {
      await api(`/admin/incubator-applications/${edit.row.id}`, { method: 'PATCH', body: { status: edit.status, adminNote: edit.note.trim() } });
      toast(t('app.saved'));
      setEdit(null);
      setKey((k) => k + 1);
    } catch (e2: any) { toast(e2.message, 'err'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/incubator-applications/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (e2: any) { toast(e2.message, 'err'); }
  };

  return (
    <RequirePerm any={['incubator.applications.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.incubatorApplications')}</h1>
      <DataTable<Row>
        endpoint="/admin/incubator-applications"
        columns={cols}
        refreshKey={key}
        dateFilter
        exportable={can('incubator.applications.export')}
        exportName="incubator-applications"
        filters={[{ key: 'status', label: t('tr.status'), options: STATUSES.map((k) => ({ value: k, label: t(`inc.appstatus.${k}`) })) }]}
        bulkDelete={{ path: '/admin/incubator-applications/bulk-delete', can: can('incubator.applications.delete') }}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('incubator.applications.update') && <Button size="sm" variant="outline" onClick={() => setEdit({ row: r, status: r.status, note: r.adminNote })}>{t('ex.a.process')}</Button>}
            {can('incubator.applications.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? edit.row.projectName : ''}>
        {edit && (
          <form onSubmit={save} className="space-y-3">
            <dl className="grid gap-1 rounded-lg bg-gray-50 p-3 text-sm">
              <div>👤 {edit.row.founderName}{edit.row.sector ? ` · ${edit.row.sector}` : ''}{edit.row.stage ? ` · ${t(`inc.stage.${edit.row.stage}`)}` : ''}</div>
              <div dir="ltr" className="text-start">✉ {edit.row.email} · ☎ {edit.row.phone}</div>
              <div className="whitespace-pre-line">{edit.row.description}</div>
            </dl>
            <Field label={t('tr.status')}><select className={inputCls} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{STATUSES.map((k) => <option key={k} value={k}>{t(`inc.appstatus.${k}`)}</option>)}</select></Field>
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
