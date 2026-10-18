'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

interface Row { id: number; code: string; nameAr: string; nameEn: string }

export default function CitiesPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [edit, setEdit] = useState<null | Partial<Row>>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);
  const cols: Col<Row>[] = [
    { key: 'code', label: t('u.cityCode'), exportable: false },
    { key: 'nameAr', label: t('u.cityAr'), exportable: false },
    { key: 'nameEn', label: t('u.cityEn'), exportable: false },
  ];
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    try {
      if (edit.id) await api(`/admin/cities/${edit.id}`, { method: 'PATCH', body: { nameAr: edit.nameAr, nameEn: edit.nameEn } });
      else await api('/admin/cities', { method: 'POST', body: { code: edit.code, nameAr: edit.nameAr, nameEn: edit.nameEn } });
      toast(t('app.saved')); setEdit(null); setKey((k) => k + 1);
    } catch (err: any) { toast(err.message, 'err'); }
  };
  const removeCity = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/cities/${deleteTarget.row.id}`, { method: 'DELETE' });
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };
  return (
    <RequirePerm any={['cities.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.cities')}</h1>
      <DataTable<Row>
        endpoint="/admin/cities" columns={cols} exportable={false} refreshKey={key}
        toolbar={can('cities.create') && <Button onClick={() => setEdit({})}>＋ {t('app.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('cities.update') && <Button size="sm" variant="outline" onClick={() => setEdit(r)}>{t('app.edit')}</Button>}
            {can('cities.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t('u.addCity')}>
        {edit && (
          <form onSubmit={save} className="space-y-3">
            {!edit.id && <Field label={t('u.cityCode')}><input required dir="ltr" pattern="[a-z0-9][a-z0-9_\-]{1,49}" className={inputCls} value={edit.code ?? ''} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>}
            <Field label={t('u.cityAr')}><input required className={inputCls} value={edit.nameAr ?? ''} onChange={(e) => setEdit({ ...edit, nameAr: e.target.value })} /></Field>
            <Field label={t('u.cityEn')}><input required dir="ltr" className={inputCls} value={edit.nameEn ?? ''} onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEdit(null)}>{t('app.cancel')}</Button><Button>{t('app.save')}</Button></div>
          </form>
        )}
      </Modal>
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={removeCity}>{t('app.delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
