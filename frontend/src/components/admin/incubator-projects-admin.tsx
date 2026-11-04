'use client';
import { useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

type Text = 'nameEn' | 'sectorAr' | 'sectorEn' | 'founderAr' | 'founderEn' | 'summaryAr' | 'summaryEn' | 'storyAr' | 'storyEn' | 'website';
const TEXT: Text[] = ['nameEn', 'sectorAr', 'sectorEn', 'founderAr', 'founderEn', 'summaryAr', 'summaryEn', 'storyAr', 'storyEn', 'website'];
type Fields = Record<Text, string>;
interface Row extends Fields { id: number; status: string; nameAr: string; joinedYear: number | null; sortOrder: number; isActive: boolean; imageUrl: string | null }
interface Draft extends Fields { id?: number; status: string; nameAr: string; joinedYear: string; sortOrder: string; isActive: boolean; imageUrl: string | null; removeImage: boolean }
type Errors = Partial<Record<'nameAr' | 'website' | 'joinedYear' | 'sortOrder' | 'image', string>>;

const blank = (): Fields => Object.fromEntries(TEXT.map((k) => [k, ''])) as Fields;
const EMPTY: Draft = { ...blank(), status: 'incubated', nameAr: '', joinedYear: '', sortOrder: '0', isActive: true, imageUrl: null, removeImage: false };

/** Projects of the Business Incubator: incubated or graduated (graduated ones show their success story). */
export function IncubatorProjectsAdmin() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const open = (r?: Row) => {
    setImage(null);
    setErrors({});
    setDraft(r ? { ...(Object.fromEntries(TEXT.map((k) => [k, r[k] ?? ''])) as Fields), id: r.id, status: r.status, nameAr: r.nameAr, joinedYear: r.joinedYear != null ? String(r.joinedYear) : '', sortOrder: String(r.sortOrder), isActive: r.isActive, imageUrl: r.imageUrl, removeImage: false } : { ...EMPTY });
  };
  const up = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });
  const yn = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const cols: Col<Row>[] = [
    { key: 'nameAr', label: t('inc.a.nameAr') },
    { key: 'nameEn', label: t('inc.a.nameEn') },
    { key: 'status', searchable: false, label: t('tr.status'), render: (r) => t(`inc.status.${r.status}`), text: (r) => t(`inc.status.${r.status}`) },
    { key: 'sectorAr', label: t('ex.f.sector') },
    { key: 'founderAr', label: t('inc.founder') },
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
  ];

  const pickImage = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErrors((e) => ({ ...e, image: t('tr.imageType') }));
    if (f.size > 5 * 1024 * 1024) return setErrors((e) => ({ ...e, image: 'Image ≤ 5MB' }));
    setErrors((e) => ({ ...e, image: undefined }));
    setImage(f);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const err: Errors = {};
    if (draft.nameAr.trim().length < 2) err.nameAr = t('tr.nameRequired');
    if (draft.website.trim() && !/^https?:\/\/\S+$/i.test(draft.website.trim())) err.website = t('ex.a.websiteInvalid');
    if (draft.joinedYear.trim() && !(/^\d{4}$/.test(draft.joinedYear.trim()) && Number(draft.joinedYear) >= 1990 && Number(draft.joinedYear) <= 2100)) err.joinedYear = t('inc.a.yearInvalid');
    if (draft.sortOrder.trim() && !/^\d{1,6}$/.test(draft.sortOrder.trim())) err.sortOrder = t('svc.orderInvalid');
    setErrors(err);
    if (Object.keys(err).length) return;
    const fd = new FormData();
    fd.set('status', draft.status); fd.set('nameAr', draft.nameAr.trim()); fd.set('joinedYear', draft.joinedYear.trim()); fd.set('sortOrder', draft.sortOrder.trim()); fd.set('isActive', String(draft.isActive));
    for (const k of TEXT) fd.set(k, draft[k].trim());
    if (draft.id) fd.set('removeImage', String(draft.removeImage));
    if (image) fd.set('image', image);
    setBusy(true);
    try {
      await api(draft.id ? `/admin/incubator-projects/${draft.id}` : '/admin/incubator-projects', { method: draft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      setDraft(null);
      setKey((k) => k + 1);
    } catch (e2: any) { toast(e2.message, 'err'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/incubator-projects/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (e2: any) { toast(e2.message, 'err'); }
  };

  const txt = (label: string, k: Text, dir: 'rtl' | 'ltr', o: { area?: boolean; max: number }) => draft && (
    <Field label={t(label)}>{o.area ? <textarea rows={3} maxLength={o.max} dir={dir} className={inputCls} value={draft[k]} onChange={(e) => up({ [k]: e.target.value })} /> : <input maxLength={o.max} dir={dir} className={inputCls} value={draft[k]} onChange={(e) => up({ [k]: e.target.value })} />}</Field>
  );

  return (
    <RequirePerm any={['incubator.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.incubatorProjects')}</h1>
      <DataTable<Row>
        endpoint="/admin/incubator-projects"
        columns={cols}
        refreshKey={key}
        exportable={false}
        filters={[{ key: 'status', label: t('tr.status'), options: ['incubated', 'graduated'].map((k) => ({ value: k, label: t(`inc.status.${k}`) })) }]}
        bulkDelete={{ path: '/admin/incubator-projects/bulk-delete', can: can('incubator.delete') }}
        toolbar={can('incubator.create') && <Button onClick={() => open()}>＋ {t('inc.a.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('incubator.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('incubator.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={t(draft?.id ? 'inc.a.edit' : 'inc.a.add')}>
        {draft && (
          <form onSubmit={save} noValidate className="space-y-3">
            <Field label={t('tr.status')}><select className={inputCls} value={draft.status} onChange={(e) => up({ status: e.target.value })}>{['incubated', 'graduated'].map((k) => <option key={k} value={k}>{t(`inc.status.${k}`)}</option>)}</select></Field>
            <Field label={t('inc.a.nameAr')} error={errors.nameAr}><input maxLength={190} dir="rtl" aria-invalid={!!errors.nameAr} className={`${inputCls} ${errors.nameAr ? 'border-red-500' : ''}`} value={draft.nameAr} onChange={(e) => up({ nameAr: e.target.value })} /></Field>
            {txt('inc.a.nameEn', 'nameEn', 'ltr', { max: 190 })}
            {txt('ex.a.sectorAr', 'sectorAr', 'rtl', { max: 150 })}{txt('ex.a.sectorEn', 'sectorEn', 'ltr', { max: 150 })}
            {txt('inc.a.founderAr', 'founderAr', 'rtl', { max: 150 })}{txt('inc.a.founderEn', 'founderEn', 'ltr', { max: 150 })}
            {txt('inc.a.summaryAr', 'summaryAr', 'rtl', { area: true, max: 3000 })}{txt('inc.a.summaryEn', 'summaryEn', 'ltr', { area: true, max: 3000 })}
            {draft.status === 'graduated' && <>{txt('inc.a.storyAr', 'storyAr', 'rtl', { area: true, max: 5000 })}{txt('inc.a.storyEn', 'storyEn', 'ltr', { area: true, max: 5000 })}</>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('inc.a.year')} error={errors.joinedYear}><input inputMode="numeric" dir="ltr" maxLength={4} className={inputCls} value={draft.joinedYear} onChange={(e) => up({ joinedYear: e.target.value })} /></Field>
              <Field label={t('ex.a.order')} error={errors.sortOrder}><input inputMode="numeric" dir="ltr" maxLength={6} className={inputCls} value={draft.sortOrder} onChange={(e) => up({ sortOrder: e.target.value })} /></Field>
            </div>
            <Field label={t('ex.a.website')} error={errors.website}><input type="url" dir="ltr" maxLength={500} placeholder="https://" className={inputCls} value={draft.website} onChange={(e) => up({ website: e.target.value })} /></Field>
            <Field label={t('tr.image')} error={errors.image}><input type="file" accept="image/jpeg,image/png,image/webp" className={inputCls} onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ''; }} /></Field>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {image && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{image.name}</span>}
              {!image && draft.imageUrl && !draft.removeImage && <img src={fileUrl(draft.imageUrl)} alt="" className="h-16 w-24 rounded object-cover" />}
              {!image && draft.imageUrl && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.removeImage} onChange={(e) => up({ removeImage: e.target.checked })} />{t('tr.removeImage')}</label>}
            </div>
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
