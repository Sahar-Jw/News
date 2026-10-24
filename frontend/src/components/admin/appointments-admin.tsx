'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { StatusBadge, useStatuses } from '@/components/admin/appointment-status';

interface Row { id: number; customerId: number; customerName: string; customerPhone: string; appointmentDate: string; appointmentTime: string; status: string; procedures: string | null }
interface CustomerOption { id: number; name: string; phone: string }
interface Draft { id?: number; customerId: string; appointmentDate: string; appointmentTime: string; status: string; procedures: string }

/** Dates: the table, and the form (customer select · date · hour · status select · procedures). */
export function AppointmentsAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const statuses = useStatuses();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  // the customer list is loaded when the form opens (so a customer added a minute ago is there)
  useEffect(() => {
    if (!draft) return;
    api<CustomerOption[]>('/admin/customers/options').then(setCustomers).catch((e) => toast(e.message, 'err'));
    // eslint-disable-next-line
  }, [draft === null]);

  const open = (r?: Row) => setDraft(r
    ? { id: r.id, customerId: String(r.customerId), appointmentDate: r.appointmentDate.slice(0, 10), appointmentTime: r.appointmentTime, status: r.status, procedures: r.procedures ?? '' }
    : { customerId: '', appointmentDate: '', appointmentTime: '', status: statuses.list[0]?.code ?? 'scheduled', procedures: '' });

  const cols: Col<Row>[] = [
    { key: 'id', label: '#', searchable: false },
    { key: 'customerName', label: t('ap.customer'), render: (r) => <div><div className="font-medium">{r.customerName}</div><div className="text-xs text-gray-500" dir="ltr">{r.customerPhone}</div></div>, text: (r) => r.customerName },
    { key: 'appointmentDate', type: 'date', label: t('oc.date'), render: (r) => fmtDay(lang, r.appointmentDate), text: (r) => r.appointmentDate.slice(0, 10) },
    { key: 'appointmentTime', label: t('ap.hour'), render: (r) => <bdi dir="ltr">{r.appointmentTime}</bdi> },
    { key: 'status', label: t('oc.status'), searchable: false, render: (r) => <StatusBadge code={r.status} label={statuses.label(r.status)} color={statuses.color(r.status)} />, text: (r) => statuses.label(r.status) },
    { key: 'procedures', label: t('cu.procedures'), render: (r) => <span className="line-clamp-2 max-w-xs whitespace-pre-line text-xs text-gray-600">{r.procedures || '—'}</span>, text: (r) => r.procedures ?? '' },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const body = { customerId: Number(draft.customerId), appointmentDate: draft.appointmentDate, appointmentTime: draft.appointmentTime, status: draft.status, procedures: draft.procedures.trim() || null };
    setBusy(true);
    try {
      await api(draft.id ? `/admin/appointments/${draft.id}` : '/admin/appointments', { method: draft.id ? 'PATCH' : 'POST', body });
      toast(t('app.saved'));
      setDraft(null);
      setKey((k) => k + 1);
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/appointments/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  // a record may carry a status that was later removed from Settings: keep it selectable while editing that record
  const options = draft && draft.status && !statuses.list.some((s) => s.code === draft.status) ? [...statuses.list.map((s) => s.code), draft.status] : statuses.list.map((s) => s.code);

  return (
    <RequirePerm any={['appointments.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.dates')}</h1>
      <DataTable<Row>
        endpoint="/admin/appointments"
        columns={cols}
        dateFilter
        refreshKey={key}
        exportable={can('appointments.export')}
        exportName="dates"
        filters={[{ key: 'status', label: t('oc.status'), options: statuses.list.map((s) => ({ value: s.code, label: statuses.label(s.code) })) }]}
        bulkDelete={{ path: '/admin/appointments/bulk-delete', can: can('appointments.delete') }}
        toolbar={can('appointments.create') && <Button onClick={() => open()}>＋ {t('ap.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('appointments.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('appointments.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('ap.edit') : t('ap.add')} wide>
        {draft && (
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('ap.customer')}>
                <select required className={inputCls} value={draft.customerId} onChange={(e) => setDraft({ ...draft, customerId: e.target.value })}>
                  <option value="" disabled>—</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                </select>
              </Field>
              <Field label={t('oc.status')}>
                <select required className={inputCls} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  {options.map((code) => <option key={code} value={code}>{statuses.label(code)}</option>)}
                </select>
              </Field>
              <Field label={t('oc.date')}><input required type="date" className={inputCls} value={draft.appointmentDate} onChange={(e) => setDraft({ ...draft, appointmentDate: e.target.value })} /></Field>
              <Field label={t('ap.hour')}><input required type="time" dir="ltr" className={inputCls} value={draft.appointmentTime} onChange={(e) => setDraft({ ...draft, appointmentTime: e.target.value })} /></Field>
            </div>
            <Field label={t('cu.procedures')}>
              <textarea maxLength={5000} className={`${inputCls} h-32 resize-none overflow-y-auto`} value={draft.procedures} onChange={(e) => setDraft({ ...draft, procedures: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDraft(null)}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
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
