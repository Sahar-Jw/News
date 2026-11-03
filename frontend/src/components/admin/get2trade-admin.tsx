'use client';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Center, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { RichEditor } from '@/components/admin/rich-editor';

const STATUSES = ['new', 'in_review', 'accepted', 'rejected'];
const COLOR: Record<string, string> = { new: 'bg-blue-100 text-blue-700', in_review: 'bg-amber-100 text-amber-700', accepted: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700' };
const SPACE_KINDS = ['office', 'coworking', 'meeting_room', 'other'];
const cls = (bad?: string) => `${inputCls} ${bad ? 'border-red-500' : ''}`;
const yn = (on: boolean, t: (k: string) => string) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;

// ------------------------------------------------------------------ bookings inbox
interface Booking { id: number; reference: string; kind: string; name: string; company: string | null; phone: string; email: string; spaceName: string; packageName: string; startDate: string | null; people: number | null; message: string | null; status: string; staffNotes: string | null; createdAt: string }

function Bookings() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [sel, setSel] = useState<Booking | null>(null);
  const [status, setStatus] = useState('new');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);

  const cols: Col<Booking>[] = [
    { key: 'reference', searchable: false, label: '#', render: (r) => <span dir="ltr">{r.reference}</span>, text: (r) => r.reference },
    { key: 'kind', searchable: false, label: t('gt.a.type'), render: (r) => t(`gt.reqKind.${r.kind}`), text: (r) => t(`gt.reqKind.${r.kind}`) },
    { key: 'name', label: t('gt.name') },
    { key: 'company', label: t('gt.company') },
    { key: 'phone', label: t('site.phone') },
    { key: 'spaceName', label: t('gt.space') },
    { key: 'status', searchable: false, label: t('gt.a.status'), render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${COLOR[r.status] ?? ''}`}>{t(`gt.status.${r.status}`)}</span>, text: (r) => t(`gt.status.${r.status}`) },
    { key: 'createdAt', type: 'date', label: t('gt.a.date'), render: (r) => fmtDate(lang, r.createdAt), text: (r) => r.createdAt },
  ];

  const open = async (r: Booking) => {
    try { const full = await api<Booking>(`/admin/get2trade/bookings/${r.id}`); setSel(full); setStatus(full.status); setNotes(full.staffNotes ?? ''); } catch (e: any) { toast(e.message, 'err'); }
  };
  const save = async () => {
    if (!sel) return;
    setBusy(true);
    try { await api(`/admin/get2trade/bookings/${sel.id}`, { method: 'PATCH', body: { status, staffNotes: notes } }); toast(t('app.saved')); setSel(null); setKey((k) => k + 1); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <>
      <DataTable<Booking>
        endpoint="/admin/get2trade/bookings" columns={cols} dateFilter refreshKey={key} exportable={can('get2trade.export')} exportName="get2trade-bookings"
        filters={[
          { key: 'status', label: t('gt.a.status'), options: STATUSES.map((s) => ({ value: s, label: t(`gt.status.${s}`) })) },
          { key: 'kind', label: t('gt.a.type'), options: ['booking', 'inquiry'].map((k) => ({ value: k, label: t(`gt.reqKind.${k}`) })) },
        ]}
        bulkDelete={{ path: '/admin/get2trade/bookings/bulk-delete', can: can('get2trade.delete') }}
        rowActions={(r) => <Button size="sm" variant="outline" onClick={() => open(r)}>{t('gt.a.open')}</Button>}
      />
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.reference} — ${sel.name}` : ''} wide>
        {sel && (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {([[t('gt.a.type'), t(`gt.reqKind.${sel.kind}`)], [t('gt.name'), sel.name], [t('gt.company'), sel.company], [t('site.phone'), sel.phone], [t('contact.email'), sel.email], [t('gt.space'), sel.spaceName], [t('gt.package'), sel.packageName], [t('gt.a.startWish'), sel.startDate], [t('gt.a.people'), sel.people != null ? String(sel.people) : null]] as [string, string | null][]).map(([k, val]) => <div key={k}><dt className="text-xs text-gray-500">{k}</dt><dd className="font-semibold">{val || '—'}</dd></div>)}
            </dl>
            {sel.message && <div className="rounded-xl bg-canvas p-3 text-sm"><p className="mb-1 text-xs text-gray-500">{t('gt.a.messageLbl')}</p><p className="whitespace-pre-wrap">{sel.message}</p></div>}
            {can('get2trade.update') && (
              <>
                <Field label={t('gt.a.status')} hint={t('gt.a.statusHint')}><select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{t(`gt.status.${s}`)}</option>)}</select></Field>
                <Field label={t('gt.a.notes')} hint={t('gt.a.notesHint')}><textarea rows={3} maxLength={5000} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSel(null)}>{t('app.cancel')}</Button><Button disabled={busy} onClick={save}>{t('app.save')}</Button></div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

// ------------------------------------------------------------------ spaces
type SText = 'nameEn' | 'descriptionAr' | 'descriptionEn' | 'priceAr' | 'priceEn';
const S_TEXT: SText[] = ['nameEn', 'descriptionAr', 'descriptionEn', 'priceAr', 'priceEn'];
interface SpaceRow extends Record<SText, string> { id: number; kind: string; nameAr: string; capacity: number | null; areaSqm: number | null; sortOrder: number; isAvailable: boolean; isActive: boolean; imageUrl: string | null }
interface SpaceDraft extends Record<SText, string> { id?: number; kind: string; nameAr: string; capacity: string; areaSqm: string; sortOrder: string; isAvailable: boolean; isActive: boolean; imageUrl: string | null; removeImage: boolean }
type SErrors = Partial<Record<'nameAr' | 'capacity' | 'areaSqm' | 'sortOrder' | 'image', string>>;
const blankS = (): Record<SText, string> => Object.fromEntries(S_TEXT.map((k) => [k, ''])) as Record<SText, string>;
const S_EMPTY: SpaceDraft = { ...blankS(), kind: 'office', nameAr: '', capacity: '', areaSqm: '', sortOrder: '0', isAvailable: true, isActive: true, imageUrl: null, removeImage: false };
const intIn = (v: string, min: number, max: number) => /^\d+$/.test(v.trim()) && Number(v) >= min && Number(v) <= max;

function Spaces() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<SpaceDraft | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<SErrors>({});
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<{ row: SpaceRow; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const open = (r?: SpaceRow) => {
    setImage(null); setErrors({});
    setDraft(r ? { ...(Object.fromEntries(S_TEXT.map((k) => [k, r[k] ?? ''])) as Record<SText, string>), id: r.id, kind: r.kind, nameAr: r.nameAr, capacity: r.capacity != null ? String(r.capacity) : '', areaSqm: r.areaSqm != null ? String(r.areaSqm) : '', sortOrder: String(r.sortOrder), isAvailable: r.isAvailable, isActive: r.isActive, imageUrl: r.imageUrl, removeImage: false } : { ...S_EMPTY });
  };
  const up = (p: Partial<SpaceDraft>) => draft && setDraft({ ...draft, ...p });

  const cols: Col<SpaceRow>[] = [
    { key: 'nameAr', label: t('gt.a.nameAr') },
    { key: 'nameEn', label: t('gt.a.nameEn') },
    { key: 'kind', searchable: false, label: t('gt.a.type'), render: (r) => t(`gt.kind.${r.kind}`), text: (r) => t(`gt.kind.${r.kind}`) },
    { key: 'priceAr', label: t('gt.a.priceAr') },
    { key: 'isAvailable', searchable: false, label: t('gt.available'), render: (r) => yn(r.isAvailable, t), text: (r) => t(r.isAvailable ? 'sub.yes' : 'sub.no') },
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive, t), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
  ];

  const pickImage = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErrors((e) => ({ ...e, image: t('gt.a.imageType') }));
    if (f.size > 5 * 1024 * 1024) return setErrors((e) => ({ ...e, image: 'Image ≤ 5MB' }));
    setErrors((e) => ({ ...e, image: undefined }));
    setImage(f);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const err: SErrors = {};
    if (draft.nameAr.trim().length < 2) err.nameAr = t('tr.nameRequired');
    if (draft.capacity.trim() && !intIn(draft.capacity, 1, 1000)) err.capacity = t('gt.a.capacityInvalid');
    if (draft.areaSqm.trim() && !intIn(draft.areaSqm, 1, 100000)) err.areaSqm = t('gt.a.areaInvalid');
    if (!intIn(draft.sortOrder.trim() || '0', 0, 100000)) err.sortOrder = t('gt.a.orderInvalid');
    setErrors(err);
    if (Object.keys(err).length) return;
    const fd = new FormData();
    fd.set('kind', draft.kind); fd.set('nameAr', draft.nameAr.trim()); fd.set('capacity', draft.capacity.trim()); fd.set('areaSqm', draft.areaSqm.trim());
    fd.set('sortOrder', draft.sortOrder.trim() || '0'); fd.set('isAvailable', String(draft.isAvailable)); fd.set('isActive', String(draft.isActive));
    for (const k of S_TEXT) fd.set(k, draft[k].trim());
    if (draft.id) fd.set('removeImage', String(draft.removeImage));
    if (image) fd.set('image', image);
    setBusy(true);
    try {
      await api(draft.id ? `/admin/get2trade/spaces/${draft.id}` : '/admin/get2trade/spaces', { method: draft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved')); setDraft(null); setKey((k) => k + 1);
    } catch (e2: any) { toast(e2.message, 'err'); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!del) return;
    try { await api(`/admin/get2trade/spaces/${del.row.id}`, { method: 'DELETE' }); toast(t('app.deleted')); del.reload(); setDel(null); } catch (e2: any) { toast(e2.message, 'err'); }
  };

  return (
    <>
      <DataTable<SpaceRow>
        endpoint="/admin/get2trade/spaces" columns={cols} refreshKey={key} exportable={false}
        bulkDelete={{ path: '/admin/get2trade/spaces/bulk-delete', can: can('get2trade.delete') }}
        toolbar={can('get2trade.create') && <Button onClick={() => open()}>＋ {t('gt.a.addSpace')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('get2trade.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('get2trade.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDel({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('gt.a.editSpace') : t('gt.a.addSpace')} wide>
        {draft && (
          <form onSubmit={save} noValidate className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('gt.a.type')}><select className={inputCls} value={draft.kind} onChange={(e) => up({ kind: e.target.value })}>{SPACE_KINDS.map((k) => <option key={k} value={k}>{t(`gt.kind.${k}`)}</option>)}</select></Field>
              <div className="flex flex-wrap items-end gap-5 pb-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isAvailable} onChange={(e) => up({ isAvailable: e.target.checked })} />{t('gt.a.availableChk')}</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isActive} onChange={(e) => up({ isActive: e.target.checked })} />{t('faq.active')}</label>
              </div>
              <Field label={t('gt.a.nameAr')} error={errors.nameAr}><input maxLength={150} dir="rtl" aria-invalid={!!errors.nameAr} className={cls(errors.nameAr)} value={draft.nameAr} onChange={(e) => up({ nameAr: e.target.value })} /></Field>
              <Field label={t('gt.a.nameEn')} hint={t('faq.hint')}><input maxLength={150} dir="ltr" className={inputCls} value={draft.nameEn} onChange={(e) => up({ nameEn: e.target.value })} /></Field>
              <Field label={t('gt.a.descAr')}><textarea rows={3} maxLength={3000} dir="rtl" className={inputCls} value={draft.descriptionAr} onChange={(e) => up({ descriptionAr: e.target.value })} /></Field>
              <Field label={t('gt.a.descEn')}><textarea rows={3} maxLength={3000} dir="ltr" className={inputCls} value={draft.descriptionEn} onChange={(e) => up({ descriptionEn: e.target.value })} /></Field>
              <Field label={t('gt.a.priceAr')} hint={t('gt.a.priceHint')}><input maxLength={150} dir="rtl" className={inputCls} value={draft.priceAr} onChange={(e) => up({ priceAr: e.target.value })} /></Field>
              <Field label={t('gt.a.priceEn')}><input maxLength={150} dir="ltr" className={inputCls} value={draft.priceEn} onChange={(e) => up({ priceEn: e.target.value })} /></Field>
              <Field label={t('gt.a.capacity')} error={errors.capacity}><input inputMode="numeric" dir="ltr" aria-invalid={!!errors.capacity} className={cls(errors.capacity)} value={draft.capacity} onChange={(e) => up({ capacity: e.target.value })} /></Field>
              <Field label={t('gt.a.area')} error={errors.areaSqm}><input inputMode="numeric" dir="ltr" aria-invalid={!!errors.areaSqm} className={cls(errors.areaSqm)} value={draft.areaSqm} onChange={(e) => up({ areaSqm: e.target.value })} /></Field>
              <Field label={t('gt.a.order')} error={errors.sortOrder}><input inputMode="numeric" dir="ltr" aria-invalid={!!errors.sortOrder} className={cls(errors.sortOrder)} value={draft.sortOrder} onChange={(e) => up({ sortOrder: e.target.value })} /></Field>
            </div>
            <Field label={t('gt.a.image')} error={errors.image}><input type="file" accept="image/jpeg,image/png,image/webp" className={inputCls} onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ''; }} /></Field>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {image && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{image.name}</span>}
              {!image && draft.imageUrl && !draft.removeImage && <img src={fileUrl(draft.imageUrl)} alt="" className="h-16 w-24 rounded object-cover" />}
              {!image && draft.imageUrl && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.removeImage} onChange={(e) => up({ removeImage: e.target.checked })} />{t('gt.a.removeImage')}</label>}
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDraft(null)}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
          </form>
        )}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDel(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{t('app.delete')}</Button></div>
      </Modal>
    </>
  );
}

// ------------------------------------------------------------------ packages
interface PackRow { id: number; nameAr: string; nameEn: string; featuresAr: string; featuresEn: string; priceAr: string; priceEn: string; sortOrder: number; isActive: boolean }
interface PackDraft { id?: number; nameAr: string; nameEn: string; featuresAr: string; featuresEn: string; priceAr: string; priceEn: string; sortOrder: string; isActive: boolean }
const P_EMPTY: PackDraft = { nameAr: '', nameEn: '', featuresAr: '', featuresEn: '', priceAr: '', priceEn: '', sortOrder: '0', isActive: true };

function Packages() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<PackDraft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<'nameAr' | 'sortOrder', string>>>({});
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<{ row: PackRow; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const open = (r?: PackRow) => { setErrors({}); setDraft(r ? { id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, featuresAr: r.featuresAr, featuresEn: r.featuresEn, priceAr: r.priceAr, priceEn: r.priceEn, sortOrder: String(r.sortOrder), isActive: r.isActive } : { ...P_EMPTY }); };
  const up = (p: Partial<PackDraft>) => draft && setDraft({ ...draft, ...p });
  const cols: Col<PackRow>[] = [
    { key: 'nameAr', label: t('gt.a.nameAr') },
    { key: 'nameEn', label: t('gt.a.nameEn') },
    { key: 'priceAr', label: t('gt.a.priceAr') },
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive, t), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const err: typeof errors = {};
    if (draft.nameAr.trim().length < 2) err.nameAr = t('tr.nameRequired');
    if (!intIn(draft.sortOrder.trim() || '0', 0, 100000)) err.sortOrder = t('gt.a.orderInvalid');
    setErrors(err);
    if (Object.keys(err).length) return;
    const { id, sortOrder, ...rest } = draft;
    const body = { ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])), sortOrder: Number(sortOrder.trim() || '0') };
    setBusy(true);
    try {
      await api(id ? `/admin/get2trade/packages/${id}` : '/admin/get2trade/packages', { method: id ? 'PATCH' : 'POST', body });
      toast(t('app.saved')); setDraft(null); setKey((k) => k + 1);
    } catch (e2: any) { toast(e2.message, 'err'); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!del) return;
    try { await api(`/admin/get2trade/packages/${del.row.id}`, { method: 'DELETE' }); toast(t('app.deleted')); del.reload(); setDel(null); } catch (e2: any) { toast(e2.message, 'err'); }
  };

  return (
    <>
      <DataTable<PackRow>
        endpoint="/admin/get2trade/packages" columns={cols} refreshKey={key} exportable={false}
        bulkDelete={{ path: '/admin/get2trade/packages/bulk-delete', can: can('get2trade.delete') }}
        toolbar={can('get2trade.create') && <Button onClick={() => open()}>＋ {t('gt.a.addPackage')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('get2trade.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('get2trade.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDel({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('gt.a.editPackage') : t('gt.a.addPackage')} wide>
        {draft && (
          <form onSubmit={save} noValidate className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('gt.a.nameAr')} error={errors.nameAr}><input maxLength={150} dir="rtl" aria-invalid={!!errors.nameAr} className={cls(errors.nameAr)} value={draft.nameAr} onChange={(e) => up({ nameAr: e.target.value })} /></Field>
              <Field label={t('gt.a.nameEn')} hint={t('faq.hint')}><input maxLength={150} dir="ltr" className={inputCls} value={draft.nameEn} onChange={(e) => up({ nameEn: e.target.value })} /></Field>
              <Field label={t('gt.a.featuresAr')} hint={t('gt.a.linesHint')}><textarea rows={5} maxLength={3000} dir="rtl" className={inputCls} value={draft.featuresAr} onChange={(e) => up({ featuresAr: e.target.value })} /></Field>
              <Field label={t('gt.a.featuresEn')} hint={t('gt.a.linesHint')}><textarea rows={5} maxLength={3000} dir="ltr" className={inputCls} value={draft.featuresEn} onChange={(e) => up({ featuresEn: e.target.value })} /></Field>
              <Field label={t('gt.a.priceAr')} hint={t('gt.a.priceHint')}><input maxLength={150} dir="rtl" className={inputCls} value={draft.priceAr} onChange={(e) => up({ priceAr: e.target.value })} /></Field>
              <Field label={t('gt.a.priceEn')}><input maxLength={150} dir="ltr" className={inputCls} value={draft.priceEn} onChange={(e) => up({ priceEn: e.target.value })} /></Field>
              <Field label={t('gt.a.order')} error={errors.sortOrder}><input inputMode="numeric" dir="ltr" aria-invalid={!!errors.sortOrder} className={cls(errors.sortOrder)} value={draft.sortOrder} onChange={(e) => up({ sortOrder: e.target.value })} /></Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => up({ isActive: e.target.checked })} />{t('faq.active')}</label>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDraft(null)}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
          </form>
        )}
      </Modal>
      <Modal open={!!del} onClose={() => setDel(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDel(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{t('app.delete')}</Button></div>
      </Modal>
    </>
  );
}

// ------------------------------------------------------------------ page content
const KEYS = ['aboutAr', 'aboutEn', 'servicesAr', 'servicesEn', 'newsTopicAr', 'newsTopicEn', 'notifyEmail'] as const;
type S = Record<(typeof KEYS)[number], string> & { isOpen: boolean };

function Content() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [s, setS] = useState<S | null>(null);
  const [emailErr, setEmailErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Record<string, any>>('/admin/get2trade/settings').then((r) => setS({ ...(Object.fromEntries(KEYS.map((k) => [k, r[k] ?? ''])) as Record<(typeof KEYS)[number], string>), isOpen: !!r.isOpen })).catch((e) => toast(e.message, 'err'));
  }, [toast]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s) return;
    if (s.notifyEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.notifyEmail.trim())) return setEmailErr(t('gt.emailInvalid'));
    setEmailErr('');
    setBusy(true);
    try { await api('/admin/get2trade/settings', { method: 'PATCH', body: { ...s, notifyEmail: s.notifyEmail.trim() } }); toast(t('app.saved')); } catch (err: any) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  if (!s) return <Center><Spinner /></Center>;
  const rich = (k: 'about' | 'services', label: string) => (
    <div className="grid gap-3 lg:grid-cols-2">
      <Field label={`${label} — ${t('gt.a.ar')}`}><RichEditor key={`${k}Ar`} value={s[`${k}Ar`]} onChange={(h) => setS((x) => (x ? { ...x, [`${k}Ar`]: h } : x))} dir="rtl" /></Field>
      <Field label={`${label} — ${t('gt.a.en')}`}><RichEditor key={`${k}En`} value={s[`${k}En`]} onChange={(h) => setS((x) => (x ? { ...x, [`${k}En`]: h } : x))} dir="ltr" /></Field>
    </div>
  );
  return (
    <form onSubmit={save} noValidate className="space-y-5">
      {rich('about', t('gt.a.aboutLbl'))}{rich('services', t('gt.a.servicesLbl'))}
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label={t('gt.a.topicAr')} hint={t('gt.a.topicHint')}><input maxLength={100} dir="rtl" className={inputCls} value={s.newsTopicAr} onChange={(e) => setS({ ...s, newsTopicAr: e.target.value })} /></Field>
        <Field label={t('gt.a.topicEn')} hint={t('gt.a.topicHint')}><input maxLength={100} dir="ltr" className={inputCls} value={s.newsTopicEn} onChange={(e) => setS({ ...s, newsTopicEn: e.target.value })} /></Field>
        <Field label={t('gt.a.notifyEmail')} hint={t('gt.a.notifyHint')} error={emailErr}><input type="email" maxLength={190} dir="ltr" aria-invalid={!!emailErr} className={cls(emailErr)} value={s.notifyEmail} onChange={(e) => { setS({ ...s, notifyEmail: e.target.value }); setEmailErr(''); }} /></Field>
        <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={s.isOpen} onChange={(e) => setS({ ...s, isOpen: e.target.checked })} />{t('gt.a.bookingOpen')}</label>
      </div>
      {can('get2trade.update') && <Button disabled={busy}>{t('app.save')}</Button>}
    </form>
  );
}

/** Get2Trade admin: the requests inbox (statuses, e-mails, export), the bookable spaces, the packages and the page texts. */
export function Get2TradeAdmin() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'bookings' | 'spaces' | 'packages' | 'content'>('bookings');
  const btn = (k: typeof tab, label: string) => <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === k ? 'bg-secondary text-white' : 'bg-primary/10 text-ink/80 hover:bg-primary/20'}`}>{label}</button>;
  return (
    <RequirePerm any={['get2trade.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.get2trade')}</h1>
      <div className="mb-4 flex flex-wrap gap-2">{btn('bookings', t('gt.a.bookings'))}{btn('spaces', t('gt.a.spaces'))}{btn('packages', t('gt.a.packages'))}{btn('content', t('gt.a.content'))}</div>
      {tab === 'bookings' ? <Bookings /> : tab === 'spaces' ? <Spaces /> : tab === 'packages' ? <Packages /> : <Content />}
    </RequirePerm>
  );
}
