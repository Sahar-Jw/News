'use client';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { COURSE_KINDS } from '@/components/site/training-shared';

type Text = 'nameEn' | 'fieldAr' | 'fieldEn' | 'topicsAr' | 'topicsEn' | 'audienceAr' | 'audienceEn' | 'locationAr' | 'locationEn' | 'feeAr' | 'feeEn';
const TEXT: Text[] = ['nameEn', 'fieldAr', 'fieldEn', 'topicsAr', 'topicsEn', 'audienceAr', 'audienceEn', 'locationAr', 'locationEn', 'feeAr', 'feeEn'];
type Fields = Record<Text, string>;
interface Row extends Fields { id: number; kind: string; nameAr: string; trainerId: number | null; trainerName: string; startDate: string; endDate: string; hours: number | null; capacity: number | null; registrationClosed: boolean; isActive: boolean; registered: number; status: string; imageUrl: string | null }
interface Draft extends Fields { id?: number; kind: string; nameAr: string; trainerId: string; startDate: string; endDate: string; hours: string; capacity: string; registrationClosed: boolean; isActive: boolean; imageUrl: string | null; removeImage: boolean }
type Errors = Partial<Record<'nameAr' | 'startDate' | 'endDate' | 'hours' | 'capacity' | 'image', string>>;

const blank = (): Fields => Object.fromEntries(TEXT.map((k) => [k, ''])) as Fields;
const EMPTY: Draft = { ...blank(), kind: 'course', nameAr: '', trainerId: '', startDate: '', endDate: '', hours: '', capacity: '', registrationClosed: false, isActive: true, imageUrl: null, removeImage: false };
const posInt = (v: string, max: number) => /^\d+$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= max;

/** Courses of the Training Center. Current/archive is computed from the dates, never set by hand. */
export function CoursesAdmin() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [trainers, setTrainers] = useState<{ id: number; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => { api<{ id: number; name: string }[]>('/admin/trainers/options').then(setTrainers).catch(() => setTrainers([])); }, [key]);

  const open = (r?: Row) => {
    setImage(null);
    setErrors({});
    setDraft(r
      ? { ...(Object.fromEntries(TEXT.map((k) => [k, r[k] ?? ''])) as Fields), id: r.id, kind: r.kind, nameAr: r.nameAr, trainerId: r.trainerId != null ? String(r.trainerId) : '', startDate: r.startDate, endDate: r.endDate, hours: r.hours != null ? String(r.hours) : '', capacity: r.capacity != null ? String(r.capacity) : '', registrationClosed: r.registrationClosed, isActive: r.isActive, imageUrl: r.imageUrl, removeImage: false }
      : { ...EMPTY });
  };
  const up = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });

  const yn = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const cols: Col<Row>[] = [
    { key: 'nameAr', label: t('tr.nameAr') },
    { key: 'nameEn', label: t('tr.nameEn') },
    { key: 'kind', searchable: false, label: t('tr.kind'), render: (r) => t(`tr.kind.${r.kind}`), text: (r) => t(`tr.kind.${r.kind}`) },
    { key: 'trainerName', label: t('tr.trainer') },
    { key: 'startDate', label: t('tr.startDate') },
    { key: 'registered', searchable: false, label: t('tr.registered'), render: (r) => (r.capacity != null ? `${r.registered} / ${r.capacity}` : String(r.registered)), text: (r) => (r.capacity != null ? `${r.registered} / ${r.capacity}` : String(r.registered)) },
    { key: 'status', searchable: false, label: t('tr.status'), render: (r) => t(`tr.status.${r.status}`), text: (r) => t(`tr.status.${r.status}`) },
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
    if (!draft.startDate) err.startDate = t('tr.startRequired');
    if (draft.endDate && draft.startDate && draft.endDate < draft.startDate) err.endDate = t('tr.endBeforeStart');
    if (draft.hours.trim() && !posInt(draft.hours, 2000)) err.hours = t('tr.hoursInvalid');
    if (draft.capacity.trim() && !posInt(draft.capacity, 100000)) err.capacity = t('tr.capacityInvalid');
    setErrors(err);
    if (Object.keys(err).length) return;
    const fd = new FormData();
    fd.set('kind', draft.kind); fd.set('nameAr', draft.nameAr.trim()); fd.set('trainerId', draft.trainerId); fd.set('startDate', draft.startDate); fd.set('endDate', draft.endDate);
    fd.set('hours', draft.hours.trim()); fd.set('capacity', draft.capacity.trim()); fd.set('registrationClosed', String(draft.registrationClosed)); fd.set('isActive', String(draft.isActive));
    for (const k of TEXT) fd.set(k, draft[k].trim());
    if (draft.id) fd.set('removeImage', String(draft.removeImage));
    if (image) fd.set('image', image);
    setBusy(true);
    try {
      await api(draft.id ? `/admin/courses/${draft.id}` : '/admin/courses', { method: draft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      setDraft(null);
      setKey((k) => k + 1);
    } catch (e2: any) { toast(e2.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/courses/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (e2: any) { toast(e2.message, 'err'); }
  };

  const pair = (label: string, a: Text, b: Text, o: { area?: boolean; max: number; hint?: string }) => draft && (
    <>
      <Field label={t(`${label}Ar`)} hint={o.hint}>
        {o.area ? <textarea rows={4} maxLength={o.max} dir="rtl" className={inputCls} value={draft[a]} onChange={(e) => up({ [a]: e.target.value })} /> : <input maxLength={o.max} dir="rtl" className={inputCls} value={draft[a]} onChange={(e) => up({ [a]: e.target.value })} />}
      </Field>
      <Field label={t(`${label}En`)} hint={o.hint}>
        {o.area ? <textarea rows={4} maxLength={o.max} dir="ltr" className={inputCls} value={draft[b]} onChange={(e) => up({ [b]: e.target.value })} /> : <input maxLength={o.max} dir="ltr" className={inputCls} value={draft[b]} onChange={(e) => up({ [b]: e.target.value })} />}
      </Field>
    </>
  );
  const cls = (bad?: string) => `${inputCls} ${bad ? 'border-red-500' : ''}`;

  return (
    <RequirePerm any={['courses.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.courses')}</h1>
      <DataTable<Row>
        endpoint="/admin/courses"
        columns={cols}
        refreshKey={key}
        exportable={false}
        filters={[
          { key: 'scope', label: t('tr.status'), options: [{ value: 'current', label: t('tr.scopeCurrent') }, { value: 'archive', label: t('tr.scopeArchive') }] },
          { key: 'kind', label: t('tr.kind'), options: COURSE_KINDS.map((k) => ({ value: k, label: t(`tr.kind.${k}`) })) },
        ]}
        bulkDelete={{ path: '/admin/courses/bulk-delete', can: can('courses.delete') }}
        toolbar={can('courses.create') && <Button onClick={() => open()}>＋ {t('tr.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('courses.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('courses.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('tr.edit') : t('tr.add')} wide>
        {draft && (
          <form onSubmit={save} noValidate className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('tr.kind')}><select className={inputCls} value={draft.kind} onChange={(e) => up({ kind: e.target.value })}>{COURSE_KINDS.map((k) => <option key={k} value={k}>{t(`tr.kind.${k}`)}</option>)}</select></Field>
              <Field label={t('tr.trainer')}><select className={inputCls} value={draft.trainerId} onChange={(e) => up({ trainerId: e.target.value })}><option value="">{t('tr.noTrainer')}</option>{trainers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
              <Field label={t('tr.nameAr')} error={errors.nameAr}><input maxLength={255} dir="rtl" aria-invalid={!!errors.nameAr} className={cls(errors.nameAr)} value={draft.nameAr} onChange={(e) => up({ nameAr: e.target.value })} /></Field>
              <Field label={t('tr.nameEn')} hint={t('faq.hint')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.nameEn} onChange={(e) => up({ nameEn: e.target.value })} /></Field>
              {pair('tr.field', 'fieldAr', 'fieldEn', { max: 150 })}
              {pair('tr.topics', 'topicsAr', 'topicsEn', { area: true, max: 3000, hint: t('tr.linesHint') })}
              {pair('tr.audience', 'audienceAr', 'audienceEn', { max: 255 })}
              {pair('tr.location', 'locationAr', 'locationEn', { max: 255 })}
              {pair('tr.fee', 'feeAr', 'feeEn', { max: 150, hint: t('tr.feeHint') })}
              <Field label={t('tr.startDate')} error={errors.startDate}><input type="date" dir="ltr" aria-invalid={!!errors.startDate} className={cls(errors.startDate)} value={draft.startDate} onChange={(e) => up({ startDate: e.target.value })} /></Field>
              <Field label={t('tr.endDate')} error={errors.endDate}><input type="date" dir="ltr" min={draft.startDate || undefined} aria-invalid={!!errors.endDate} className={cls(errors.endDate)} value={draft.endDate} onChange={(e) => up({ endDate: e.target.value })} /></Field>
              <Field label={t('tr.hoursField')} error={errors.hours}><input inputMode="numeric" dir="ltr" aria-invalid={!!errors.hours} className={cls(errors.hours)} value={draft.hours} onChange={(e) => up({ hours: e.target.value })} /></Field>
              <Field label={t('tr.capacity')} hint={t('tr.capacityHint')} error={errors.capacity}><input inputMode="numeric" dir="ltr" aria-invalid={!!errors.capacity} className={cls(errors.capacity)} value={draft.capacity} onChange={(e) => up({ capacity: e.target.value })} /></Field>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.registrationClosed} onChange={(e) => up({ registrationClosed: e.target.checked })} />{t('tr.closeReg')}</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isActive} onChange={(e) => up({ isActive: e.target.checked })} />{t('faq.active')}</label>
            </div>
            <Field label={t('tr.image')} error={errors.image}><input type="file" accept="image/jpeg,image/png,image/webp" className={inputCls} onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ''; }} /></Field>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {image && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{image.name}</span>}
              {!image && draft.imageUrl && !draft.removeImage && <img src={fileUrl(draft.imageUrl)} alt="" className="h-16 w-24 rounded object-cover" />}
              {!image && draft.imageUrl && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.removeImage} onChange={(e) => up({ removeImage: e.target.checked })} />{t('tr.removeImage')}</label>}
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
