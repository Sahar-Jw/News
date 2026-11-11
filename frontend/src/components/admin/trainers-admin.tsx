'use client';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

interface Row { id: number; nameAr: string; nameEn: string; bioAr: string; bioEn: string; isActive: boolean }
const EMPTY = { nameAr: '', nameEn: '', bioAr: '', bioEn: '', isActive: true };

/** Trainers of the Training Center (picked in the course form). Errors show under each field. */
export function TrainersAdmin() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<(typeof EMPTY & { id?: number }) | null>(null);
  const [errors, setErrors] = useState<{ nameAr?: string }>({});
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const open = (r?: Row) => { setErrors({}); setDraft(r ? { id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, bioAr: r.bioAr, bioEn: r.bioEn, isActive: r.isActive } : { ...EMPTY }); };
  const up = (p: Partial<typeof EMPTY>) => draft && setDraft({ ...draft, ...p });
  // the "add" buttons on the public Training page link here with ?add=1: open the add window straight away
  const addLink = useSearchParams().get('add') === '1';
  useEffect(() => { if (addLink && can('courses.create')) open(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const yn = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const cols: Col<Row>[] = [
    { key: 'nameAr', label: t('tr.trainerNameAr') },
    { key: 'nameEn', label: t('tr.trainerNameEn') },
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (draft.nameAr.trim().length < 2) return setErrors({ nameAr: t('tr.nameRequired') });
    setErrors({});
    const { id, ...body } = draft;
    setBusy(true);
    try {
      await api(id ? `/admin/trainers/${id}` : '/admin/trainers', { method: id ? 'PATCH' : 'POST', body: { ...body, nameAr: body.nameAr.trim() } });
      toast(t('app.saved'));
      setDraft(null);
      setKey((k) => k + 1);
    } catch (e2: any) { toast(e2.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/trainers/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (e2: any) { toast(e2.message, 'err'); }
  };

  return (
    <RequirePerm any={['courses.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.trainers')}</h1>
      <DataTable<Row>
        endpoint="/admin/trainers"
        columns={cols}
        refreshKey={key}
        exportable={false}
        bulkDelete={{ path: '/admin/trainers/bulk-delete', can: can('courses.delete') }}
        toolbar={can('courses.create') && <Button onClick={() => open()}>＋ {t('tr.addTrainer')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('courses.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('courses.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('tr.editTrainer') : t('tr.addTrainer')}>
        {draft && (
          <form onSubmit={save} noValidate className="space-y-3">
            <Field label={t('tr.trainerNameAr')} error={errors.nameAr}><input maxLength={150} dir="rtl" aria-invalid={!!errors.nameAr} className={`${inputCls} ${errors.nameAr ? 'border-red-500' : ''}`} value={draft.nameAr} onChange={(e) => up({ nameAr: e.target.value })} /></Field>
            <Field label={t('tr.trainerNameEn')} hint={t('faq.hint')}><input maxLength={150} dir="ltr" className={inputCls} value={draft.nameEn} onChange={(e) => up({ nameEn: e.target.value })} /></Field>
            <Field label={t('tr.bioAr')}><textarea rows={4} maxLength={3000} dir="rtl" className={inputCls} value={draft.bioAr} onChange={(e) => up({ bioAr: e.target.value })} /></Field>
            <Field label={t('tr.bioEn')}><textarea rows={4} maxLength={3000} dir="ltr" className={inputCls} value={draft.bioEn} onChange={(e) => up({ bioEn: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => up({ isActive: e.target.checked })} />{t('faq.active')}</label>
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
