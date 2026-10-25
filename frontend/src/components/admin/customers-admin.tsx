'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

interface Row { id: number; name: string; phone: string; age: number | null; gender: 'male' | 'female' | null; procedures: string | null }
interface Draft { id?: number; name: string; phone: string; age: string; gender: string; procedures: string }

/** Customers: # · name · phone · age · gender · procedures. */
export function CustomersAdmin() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);
  const genderText = (g: Row['gender']) => (g ? t(g === 'male' ? 'u.male' : 'u.female') : '');

  const open = (r?: Row) => setDraft(r
    ? { id: r.id, name: r.name, phone: r.phone, age: r.age == null ? '' : String(r.age), gender: r.gender ?? '', procedures: r.procedures ?? '' }
    : { name: '', phone: '', age: '', gender: '', procedures: '' });

  const cols: Col<Row>[] = [
    { key: 'id', label: '#', searchable: false },
    { key: 'name', label: t('cu.name') },
    { key: 'phone', label: t('cu.phone'), render: (r) => <bdi dir="ltr">{r.phone}</bdi> },
    { key: 'age', label: t('cu.age'), render: (r) => r.age ?? '—', text: (r) => (r.age == null ? '' : String(r.age)) },
    { key: 'gender', label: t('u.gender'), searchable: false, render: (r) => genderText(r.gender) || '—', text: (r) => genderText(r.gender) },
    { key: 'procedures', label: t('cu.procedures'), render: (r) => <span className="line-clamp-2 max-w-xs whitespace-pre-line text-xs text-gray-600">{r.procedures || '—'}</span>, text: (r) => r.procedures ?? '' },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const body = {
      name: draft.name.trim(), phone: draft.phone.trim(),
      age: Number(draft.age), gender: draft.gender, procedures: draft.procedures.trim() || null,
    };
    setBusy(true);
    try {
      await api(draft.id ? `/admin/customers/${draft.id}` : '/admin/customers', { method: draft.id ? 'PATCH' : 'POST', body });
      toast(t('app.saved'));
      setDraft(null);
      setKey((k) => k + 1);
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/customers/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); setDeleteTarget(null); }
  };

  return (
    <RequirePerm any={['customers.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.customers')}</h1>
      <DataTable<Row>
        endpoint="/admin/customers"
        columns={cols}
        dateFilter={false}
        refreshKey={key}
        exportable={can('customers.export')}
        exportName="customers"
        filters={[{ key: 'gender', label: t('u.gender'), options: [{ value: 'male', label: t('u.male') }, { value: 'female', label: t('u.female') }] }]}
        bulkDelete={{ path: '/admin/customers/bulk-delete', can: can('customers.delete') }}
        toolbar={can('customers.create') && <Button onClick={() => open()}>＋ {t('cu.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('customers.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('customers.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('cu.edit') : t('cu.add')} wide>
        {draft && (
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('cu.name')}><input required maxLength={150} className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label={t('cu.phone')}><input required type="tel" dir="ltr" maxLength={30} className={inputCls} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
              <Field label={t('cu.age')}><input required type="number" min={0} max={130} step={1} className={inputCls} value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value })} /></Field>
              <Field label={t('u.gender')}>
                <select required className={inputCls} value={draft.gender} onChange={(e) => setDraft({ ...draft, gender: e.target.value })}>
                  <option value="" disabled>—</option><option value="male">{t('u.male')}</option><option value="female">{t('u.female')}</option>
                </select>
              </Field>
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
