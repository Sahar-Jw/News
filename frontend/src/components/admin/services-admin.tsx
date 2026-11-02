'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { SERVICE_KINDS } from '@/components/site/services-shared';

type Text = 'nameEn' | 'descriptionAr' | 'descriptionEn' | 'audienceAr' | 'audienceEn' | 'documentsAr' | 'documentsEn' | 'stepsAr' | 'stepsEn' | 'locationAr' | 'locationEn' | 'departmentAr' | 'departmentEn' | 'durationAr' | 'durationEn' | 'feeAr' | 'feeEn' | 'formUrl';
type Fields = Record<Text, string>;
interface Row extends Fields { id: number; kind: string; nameAr: string; sortOrder: number; isActive: boolean; imageUrl: string | null }
interface Draft extends Fields { id?: number; kind: string; nameAr: string; sortOrder: string; isActive: boolean; imageUrl: string | null; removeImage: boolean }

const TEXT: Text[] = ['nameEn', 'descriptionAr', 'descriptionEn', 'audienceAr', 'audienceEn', 'documentsAr', 'documentsEn', 'stepsAr', 'stepsEn', 'locationAr', 'locationEn', 'departmentAr', 'departmentEn', 'durationAr', 'durationEn', 'feeAr', 'feeEn', 'formUrl'];
const blank = (): Fields => Object.fromEntries(TEXT.map((k) => [k, ''])) as Fields;
const EMPTY: Draft = { ...blank(), kind: 'other', nameAr: '', sortOrder: '0', isActive: true, imageUrl: null, removeImage: false };
const URL_RE = /^https?:\/\/\S+$/i;

/** Chamber services (feeds the One-Stop page and, later, the Services page). Errors show under each field. */
export function ServicesAdmin() {
  const { t, href } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<'nameAr' | 'formUrl' | 'sortOrder' | 'image', string>>>({});
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const open = (r?: Row) => {
    setImage(null);
    setErrors({});
    setDraft(r ? { ...(Object.fromEntries(TEXT.map((k) => [k, r[k] ?? ''])) as Fields), id: r.id, kind: r.kind, nameAr: r.nameAr, sortOrder: String(r.sortOrder), isActive: r.isActive, imageUrl: r.imageUrl, removeImage: false } : { ...EMPTY });
  };
  const up = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });

  const yn = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const cols: Col<Row>[] = [
    { key: 'nameAr', label: t('svc.nameAr') },
    { key: 'nameEn', label: t('svc.nameEn') },
    { key: 'kind', searchable: false, label: t('svc.kind'), render: (r) => t(`svc.kind.${r.kind}`), text: (r) => t(`svc.kind.${r.kind}`) },
    { key: 'departmentAr', label: t('svc.department') },
    { key: 'feeAr', label: t('svc.fee') },
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
  ];

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
    if (draft.formUrl.trim() && !URL_RE.test(draft.formUrl.trim())) err.formUrl = t('svc.formUrlInvalid');
    const order = Number(draft.sortOrder);
    if (draft.sortOrder.trim() === '' || !Number.isInteger(order) || order < 0 || order > 100000) err.sortOrder = t('svc.orderInvalid');
    setErrors(err);
    if (Object.keys(err).length) return;
    const fd = new FormData();
    fd.set('kind', draft.kind); fd.set('nameAr', draft.nameAr.trim()); fd.set('sortOrder', String(order)); fd.set('isActive', String(draft.isActive));
    for (const k of TEXT) fd.set(k, draft[k].trim());
    if (draft.id) fd.set('removeImage', String(draft.removeImage));
    if (image) fd.set('image', image);
    setBusy(true);
    try {
      await api(draft.id ? `/admin/services/${draft.id}` : '/admin/services', { method: draft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      setDraft(null);
      setKey((k) => k + 1);
    } catch (e2: any) { toast(e2.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/services/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (e2: any) { toast(e2.message, 'err'); }
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
    <RequirePerm any={['services.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.services')}</h1>
      <DataTable<Row>
        endpoint="/admin/services"
        columns={cols}
        refreshKey={key}
        exportable={false}
        bulkDelete={{ path: '/admin/services/bulk-delete', can: can('services.delete') }}
        toolbar={can('services.create') && <Button onClick={() => open()}>＋ {t('svc.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            <Link href={href(`/services/view?id=${r.id}`)} target="_blank" className="rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50">{t('pg.view')}</Link>
            {can('services.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('services.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('svc.edit') : t('svc.add')} wide>
        {draft && (
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
              {pair('svc.duration', 'durationAr', 'durationEn', { max: 100 })}
              {pair('svc.fee', 'feeAr', 'feeEn', { max: 150, hint: t('svc.feeHint') })}
              <Field label={t('svc.formUrl')} error={errors.formUrl}><input maxLength={500} dir="ltr" placeholder="https://" aria-invalid={!!errors.formUrl} className={`${inputCls} ${errors.formUrl ? 'border-red-500' : ''}`} value={draft.formUrl} onChange={(e) => up({ formUrl: e.target.value })} /></Field>
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
