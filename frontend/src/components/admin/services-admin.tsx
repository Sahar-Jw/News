'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { SERVICE_KINDS } from '@/components/site/services-shared';

type Text = 'nameEn' | 'descriptionAr' | 'descriptionEn' | 'audienceAr' | 'audienceEn' | 'documentsAr' | 'documentsEn' | 'stepsAr' | 'stepsEn' | 'locationAr' | 'locationEn' | 'departmentAr' | 'departmentEn' | 'departmentUrl' | 'formUrl' | 'durationAr' | 'durationEn' | 'feeAr' | 'feeEn';
type Fields = Record<Text, string>;
interface Row extends Fields { id: number; kind: string; nameAr: string; sortOrder: number; isActive: boolean; imageUrl: string | null; formFileUrl: string | null }
interface Draft extends Fields { id?: number; kind: string; nameAr: string; sortOrder: string; isActive: boolean; imageUrl: string | null; removeImage: boolean; formFileUrl: string | null; removeForm: boolean }

const TEXT: Text[] = ['nameEn', 'descriptionAr', 'descriptionEn', 'audienceAr', 'audienceEn', 'documentsAr', 'documentsEn', 'stepsAr', 'stepsEn', 'locationAr', 'locationEn', 'departmentAr', 'departmentEn', 'departmentUrl', 'formUrl', 'durationAr', 'durationEn', 'feeAr', 'feeEn'];
const blank = (): Fields => Object.fromEntries(TEXT.map((k) => [k, ''])) as Fields;
const EMPTY: Draft = { ...blank(), kind: 'other', nameAr: '', sortOrder: '0', isActive: true, imageUrl: null, removeImage: false, formFileUrl: null, removeForm: false };

/**
 * The add / edit window of one service. Used by the Settings table and by the public One-Stop page (so a manager does not have
 * to leave the page). Give `id` to edit (loaded here); without it a new service is added. Errors show under each field.
 */
export function ServiceDialog({ id, onClose, onSaved }: { id?: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(id ? null : { ...EMPTY });
  const [image, setImage] = useState<File | null>(null);
  const [formFile, setFormFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<'nameAr' | 'sortOrder' | 'image', string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Row>(`/admin/services/${id}`)
      .then((r) => setDraft({ ...(Object.fromEntries(TEXT.map((k) => [k, r[k] ?? ''])) as Fields), id: r.id, kind: r.kind, nameAr: r.nameAr, sortOrder: String(r.sortOrder), isActive: r.isActive, imageUrl: r.imageUrl, removeImage: false, formFileUrl: r.formFileUrl ?? null, removeForm: false }))
      .catch((e) => { toast(e.message, 'err'); onClose(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const up = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });

  const pickImage = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErrors((e) => ({ ...e, image: t('svc.imageType') }));
    if (f.size > 5 * 1024 * 1024) return setErrors((e) => ({ ...e, image: 'Image ≤ 5MB' }));
    setErrors((e) => ({ ...e, image: undefined }));
    setImage(f);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const err: typeof errors = {};
    if (draft.nameAr.trim().length < 2) err.nameAr = t('svc.nameRequired');
    const order = Number(draft.sortOrder);
    if (draft.sortOrder.trim() === '' || !Number.isInteger(order) || order < 0 || order > 100000) err.sortOrder = t('svc.orderInvalid');
    setErrors(err);
    if (Object.keys(err).length) return;
    const fd = new FormData();
    fd.set('kind', draft.kind); fd.set('nameAr', draft.nameAr.trim()); fd.set('sortOrder', String(order)); fd.set('isActive', String(draft.isActive));
    for (const k of TEXT) fd.set(k, draft[k].trim());
    if (draft.id) fd.set('removeImage', String(draft.removeImage));
    if (image) fd.set('image', image);
    if (formFile) fd.set('form', formFile);
    if (draft.id) fd.set('removeForm', String(draft.removeForm));
    setBusy(true);
    try {
      await api(draft.id ? `/admin/services/${draft.id}` : '/admin/services', { method: draft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      onSaved();
      onClose();
    } catch (e2: any) { toast(e2.message, 'err'); }
    finally { setBusy(false); }
  };

  const pair = (label: string, a: Text, b: Text, opts: { area?: boolean; max: number; hint?: string }) => draft && (
    <>
      <Field label={t(label + 'Ar')} hint={opts.hint}>
        {opts.area ? <textarea rows={4} maxLength={opts.max} dir="rtl" className={inputCls} value={draft[a]} onChange={(e) => up({ [a]: e.target.value })} /> : <input maxLength={opts.max} dir="rtl" className={inputCls} value={draft[a]} onChange={(e) => up({ [a]: e.target.value })} />}
      </Field>
      <Field label={t(label + 'En')} hint={opts.hint}>
        {opts.area ? <textarea rows={4} maxLength={opts.max} dir="ltr" className={inputCls} value={draft[b]} onChange={(e) => up({ [b]: e.target.value })} /> : <input maxLength={opts.max} dir="ltr" className={inputCls} value={draft[b]} onChange={(e) => up({ [b]: e.target.value })} />}
      </Field>
    </>
  );


  return (
    <Modal open onClose={onClose} title={draft?.id || id ? t('svc.edit') : t('svc.add')} wide>
      {!draft ? <div className="flex justify-center py-10"><Spinner /></div> : (
          <form onSubmit={save} noValidate className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('svc.kind')}>
                <select className={inputCls} value={draft.kind} onChange={(e) => up({ kind: e.target.value })}>{SERVICE_KINDS.map((k) => <option key={k} value={k}>{t(`svc.kind.${k}`)}</option>)}</select>
              </Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => up({ isActive: e.target.checked })} />{t('faq.active')}</label>
              <Field label={t('svc.nameAr')} error={errors.nameAr}><input maxLength={255} dir="rtl" aria-invalid={!!errors.nameAr} className={`${inputCls} ${errors.nameAr ? 'border-red-500' : ''}`} value={draft.nameAr} onChange={(e) => up({ nameAr: e.target.value })} /></Field>
              <Field label={t('svc.nameEn')} hint={t('faq.hint')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.nameEn} onChange={(e) => up({ nameEn: e.target.value })} /></Field>
              {pair('svc.desc', 'descriptionAr', 'descriptionEn', { area: true, max: 5000 })}
              {pair('svc.audience', 'audienceAr', 'audienceEn', { max: 500 })}
              {pair('svc.documents', 'documentsAr', 'documentsEn', { area: true, max: 3000, hint: t('svc.linesHint') })}
              {pair('svc.steps', 'stepsAr', 'stepsEn', { area: true, max: 3000, hint: t('svc.linesHint') })}
              {pair('svc.location', 'locationAr', 'locationEn', { max: 255 })}
              {pair('svc.department', 'departmentAr', 'departmentEn', { max: 150 })}
              <Field label={t('svc.deptUrl')} hint={t('svc.deptUrlHint')}><input maxLength={300} dir="ltr" placeholder="/contact" className={inputCls} value={draft.departmentUrl} onChange={(e) => up({ departmentUrl: e.target.value })} /></Field>
              <Field label={t('svc.link')} hint={t('svc.linkHint')}><input type="url" maxLength={500} dir="ltr" placeholder="https://" className={inputCls} value={draft.formUrl} onChange={(e) => up({ formUrl: e.target.value })} /></Field>
              {pair('svc.duration', 'durationAr', 'durationEn', { max: 100 })}
              {pair('svc.fee', 'feeAr', 'feeEn', { max: 150, hint: t('svc.feeHint') })}
              <div className="md:col-span-2">
                <Field label={t('svc.formFile')} hint={t('svc.formFileHint')}>
                  <input type="file" accept=".pdf,.doc,.docx,application/pdf" className={inputCls} onChange={(e) => { setFormFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                </Field>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
                  {formFile && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{formFile.name}</span>}
                  {!formFile && draft.formFileUrl && !draft.removeForm && <a href={fileUrl(draft.formFileUrl)} target="_blank" rel="noreferrer" className="text-primary underline">{t('svc.formFileCurrent')}</a>}
                  {!formFile && draft.formFileUrl && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.removeForm} onChange={(e) => up({ removeForm: e.target.checked })} />{t('svc.removeForm')}</label>}
                </div>
              </div>
              <Field label={t('svc.order')} error={errors.sortOrder}><input inputMode="numeric" dir="ltr" aria-invalid={!!errors.sortOrder} className={`${inputCls} ${errors.sortOrder ? 'border-red-500' : ''}`} value={draft.sortOrder} onChange={(e) => up({ sortOrder: e.target.value })} /></Field>
            </div>
            <Field label={t('svc.image')} error={errors.image}>
              <input type="file" accept="image/jpeg,image/png,image/webp" className={inputCls} onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ''; }} />
            </Field>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {image && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{image.name}</span>}
              {!image && draft.imageUrl && !draft.removeImage && <img src={fileUrl(draft.imageUrl)} alt="" className="h-16 w-24 rounded object-cover" />}
              {!image && draft.imageUrl && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.removeImage} onChange={(e) => up({ removeImage: e.target.checked })} />{t('svc.removeImage')}</label>}
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
          </form>
      )}
    </Modal>
  );
}

/** Chamber services (feeds the One-Stop page and, later, the Services page). */
export function ServicesAdmin() {
  const { t, href } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ id?: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const yn = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const cols: Col<Row>[] = [
    { key: 'nameAr', label: t('svc.nameAr') },
    { key: 'nameEn', label: t('svc.nameEn') },
    { key: 'kind', searchable: false, label: t('svc.kind'), render: (r) => t(`svc.kind.${r.kind}`), text: (r) => t(`svc.kind.${r.kind}`) },
    { key: 'departmentAr', label: t('svc.department') },
    { key: 'feeAr', label: t('svc.fee') },
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
  ];

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/services/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (e2: any) { toast(e2.message, 'err'); }
  };

  return (
    <RequirePerm any={['services.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.services')}</h1>
      <DataTable<Row>
        endpoint="/admin/services"
        columns={cols}
        refreshKey={key}
        exportable={false}
        bulkDelete={{ path: '/admin/services/bulk-delete', can: can('services.delete') }}
        toolbar={can('services.create') && <Button onClick={() => setDialog({})}>＋ {t('svc.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            <Link href={href(`/services/view?id=${r.id}`)} target="_blank" className="rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50">{t('pg.view')}</Link>
            {can('services.update') && <Button size="sm" variant="outline" onClick={() => setDialog({ id: r.id })}>{t('app.edit')}</Button>}
            {can('services.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      {dialog && <ServiceDialog key={dialog.id ?? 'new'} id={dialog.id} onClose={() => setDialog(null)} onSaved={() => setKey((k) => k + 1)} />}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{t('app.delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
