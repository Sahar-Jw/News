'use client';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { SESSION_TYPES, SPONSOR_TIERS, sessionTypeLabel } from '@/components/site/expo-shared';

export type ExpoKind = 'exhibitor' | 'sponsor' | 'session';
type Text = 'nameEn' | 'descriptionAr' | 'descriptionEn' | 'sectorAr' | 'sectorEn' | 'category' | 'personAr' | 'personEn' | 'placeAr' | 'placeEn' | 'website';
const TEXT: Text[] = ['nameEn', 'descriptionAr', 'descriptionEn', 'sectorAr', 'sectorEn', 'category', 'personAr', 'personEn', 'placeAr', 'placeEn', 'website'];
type Fields = Record<Text, string>;
interface Row extends Fields { id: number; mapX: number | ''; mapY: number | ''; nameAr: string; startsAt: string; endsAt: string; sortOrder: number; isActive: boolean; logoUrl: string | null }
interface Draft extends Fields { id?: number; mapX: string; mapY: string; nameAr: string; startsAt: string; endsAt: string; sortOrder: string; isActive: boolean; logoUrl: string | null; removeLogo: boolean }
type Errors = Partial<Record<'nameAr' | 'website' | 'endsAt' | 'sortOrder' | 'logo', string>>;

const blank = (): Fields => Object.fromEntries(TEXT.map((k) => [k, ''])) as Fields;
const EMPTY: Draft = { ...blank(), mapX: '', mapY: '', nameAr: '', startsAt: '', endsAt: '', sortOrder: '0', isActive: true, logoUrl: null, removeLogo: false };
/** ISO → value of <input type="datetime-local"> (the admin's own time zone) and back */
const toLocal = (iso: string) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const toIso = (v: string) => (v ? new Date(v).toISOString() : '');

const TITLE: Record<ExpoKind, string> = { exhibitor: 'adm.expoExhibitors', sponsor: 'adm.expoSponsors', session: 'adm.expoSessions' };

/** One screen for the three kinds of EXPO content: exhibitors, sponsors and programme sessions. */
export function ExpoAdmin({ kind }: { kind: ExpoKind }) {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const open = (r?: Row) => {
    setLogo(null);
    setErrors({});
    setDraft(r
      ? { ...(Object.fromEntries(TEXT.map((k) => [k, r[k] ?? ''])) as Fields), id: r.id, mapX: String(r.mapX ?? ''), mapY: String(r.mapY ?? ''), nameAr: r.nameAr, startsAt: toLocal(r.startsAt), endsAt: toLocal(r.endsAt), sortOrder: String(r.sortOrder), isActive: r.isActive, logoUrl: r.logoUrl, removeLogo: false }
      : { ...EMPTY, category: kind === 'sponsor' ? 'partner' : kind === 'session' ? 'seminar' : '' });
  };
  // the "＋ add" buttons on the public EXPO pages link here with ?add=1: the new-item window opens straight away
  useEffect(() => { if (can('expo.create') && new URLSearchParams(window.location.search).get('add') === '1') open(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const up = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });
  const yn = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const catLabel = (c: string) => (c ? (kind === 'session' ? sessionTypeLabel(c, lang === 'ar') : undefined) ?? t(`ex.${kind === 'sponsor' ? 'tier' : 'type'}.${c}`) : '');
  // the floor plan image the exhibitor can be placed on (Settings → DCC EXPO → Information & registration)
  const [plan, setPlan] = useState('');
  useEffect(() => {
    if (!draft || kind !== 'exhibitor' || plan) return;
    api<Record<string, Record<string, any>>>('/public/settings', { cache: 'no-store' }).then((r) => setPlan(String(r.expo?.floor_plan_image_url ?? ''))).catch(() => undefined);
  }, [!!draft, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const pct = (v: number) => String(Math.round(Math.min(100, Math.max(0, v)) * 10) / 10);
    up({ mapX: pct(((e.clientX - box.left) / box.width) * 100), mapY: pct(((e.clientY - box.top) / box.height) * 100) });
  };

  const cols: Col<Row>[] = [
    { key: 'nameAr', label: t(kind === 'session' ? 'ex.a.titleAr' : 'ex.a.nameAr') },
    { key: 'nameEn', label: t(kind === 'session' ? 'ex.a.titleEn' : 'ex.a.nameEn') },
    ...(kind === 'exhibitor' ? [{ key: 'sectorAr', label: t('ex.a.sectorAr') }, { key: 'placeAr', label: t('ex.booth') }] as Col<Row>[] : []),
    ...(kind !== 'exhibitor' ? [{ key: 'category', searchable: false, label: t(kind === 'sponsor' ? 'ex.a.tier' : 'ex.a.type'), render: (r: Row) => catLabel(r.category), text: (r: Row) => catLabel(r.category) }] as Col<Row>[] : []),
    ...(kind === 'session' ? [{ key: 'startsAt', searchable: false, label: t('ex.a.startsAt'), render: (r: Row) => fmtDate(lang, r.startsAt, true), text: (r: Row) => fmtDate(lang, r.startsAt, true) }, { key: 'placeAr', label: t('ex.a.hall') }] as Col<Row>[] : []),
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
  ];

  const pickLogo = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return setErrors((e) => ({ ...e, logo: t('tr.imageType') }));
    if (f.size > 5 * 1024 * 1024) return setErrors((e) => ({ ...e, logo: 'Image ≤ 5MB' }));
    setErrors((e) => ({ ...e, logo: undefined }));
    setLogo(f);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const err: Errors = {};
    if (draft.nameAr.trim().length < 2) err.nameAr = t('tr.nameRequired');
    if (draft.website.trim() && !/^https?:\/\/\S+$/i.test(draft.website.trim())) err.website = t('ex.a.websiteInvalid');
    if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt) err.endsAt = t('ex.a.endBeforeStart');
    if (draft.sortOrder.trim() && !/^\d{1,6}$/.test(draft.sortOrder.trim())) err.sortOrder = t('svc.orderInvalid');
    setErrors(err);
    if (Object.keys(err).length) return;
    const fd = new FormData();
    if (!draft.id) fd.set('kind', kind);
    fd.set('nameAr', draft.nameAr.trim()); fd.set('startsAt', toIso(draft.startsAt)); fd.set('endsAt', toIso(draft.endsAt));
    fd.set('sortOrder', draft.sortOrder.trim()); fd.set('isActive', String(draft.isActive));
    for (const k of TEXT) fd.set(k, draft[k].trim());
    if (kind === 'exhibitor') { fd.set('mapX', draft.mapX.trim()); fd.set('mapY', draft.mapY.trim()); }
    if (draft.id) fd.set('removeLogo', String(draft.removeLogo));
    if (logo) fd.set('logo', logo);
    setBusy(true);
    try {
      await api(draft.id ? `/admin/expo-items/${draft.id}` : '/admin/expo-items', { method: draft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      setDraft(null);
      setKey((k) => k + 1);
    } catch (e2: any) { toast(e2.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/expo-items/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (e2: any) { toast(e2.message, 'err'); }
  };

  const txt = (label: string, k: Text, dir: 'rtl' | 'ltr', o: { area?: boolean; max: number }) => draft && (
    <Field label={t(label)}>
      {o.area ? <textarea rows={3} maxLength={o.max} dir={dir} className={inputCls} value={draft[k]} onChange={(e) => up({ [k]: e.target.value })} /> : <input maxLength={o.max} dir={dir} className={inputCls} value={draft[k]} onChange={(e) => up({ [k]: e.target.value })} />}
    </Field>
  );

  return (
    <RequirePerm any={['expo.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t(TITLE[kind])}</h1>
      <DataTable<Row>
        endpoint="/admin/expo-items"
        baseParams={{ kind }}
        columns={cols}
        refreshKey={key}
        exportable={false}
        bulkDelete={{ path: '/admin/expo-items/bulk-delete', can: can('expo.delete') }}
        toolbar={can('expo.create') && <Button onClick={() => open()}>＋ {t(`ex.a.add.${kind}`)}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('expo.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('expo.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={t(draft?.id ? `ex.a.edit.${kind}` : `ex.a.add.${kind}`)}>
        {draft && (
          <form onSubmit={save} noValidate className="space-y-3">
            <Field label={t(kind === 'session' ? 'ex.a.titleAr' : 'ex.a.nameAr')} error={errors.nameAr}><input maxLength={255} dir="rtl" aria-invalid={!!errors.nameAr} className={`${inputCls} ${errors.nameAr ? 'border-red-500' : ''}`} value={draft.nameAr} onChange={(e) => up({ nameAr: e.target.value })} /></Field>
            {txt(kind === 'session' ? 'ex.a.titleEn' : 'ex.a.nameEn', 'nameEn', 'ltr', { max: 255 })}
            {txt('ex.a.descAr', 'descriptionAr', 'rtl', { area: true, max: 3000 })}
            {txt('ex.a.descEn', 'descriptionEn', 'ltr', { area: true, max: 3000 })}
            {kind === 'exhibitor' && <>{txt('ex.a.sectorAr', 'sectorAr', 'rtl', { max: 150 })}{txt('ex.a.sectorEn', 'sectorEn', 'ltr', { max: 150 })}</>}
            {kind === 'exhibitor' && plan && (
              <Field label={lang === 'ar' ? 'موقع العارض على مخطط المعرض (اضغط على المخطط لتحديد الموقع)' : 'Position on the floor plan (click the plan)'}>
                <div>
                  <div onClick={place} className="relative cursor-crosshair overflow-hidden rounded-lg ring-1 ring-line">
                    <img src={fileUrl(plan)} alt="" className="block w-full select-none" draggable={false} />
                    {draft.mapX !== '' && draft.mapY !== '' && <span style={{ left: `${draft.mapX}%`, top: `${draft.mapY}%` }} className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600 shadow" />}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500"><span dir="ltr">X {draft.mapX || '—'}% · Y {draft.mapY || '—'}%</span>{draft.mapX !== '' && <button type="button" className="text-red-600" onClick={() => up({ mapX: '', mapY: '' })}>{lang === 'ar' ? 'إزالة الموقع' : 'Clear'}</button>}</div>
                </div>
              </Field>
            )}
            {kind === 'sponsor' && (
              <Field label={t('ex.a.tier')}><select className={inputCls} value={draft.category} onChange={(e) => up({ category: e.target.value })}>{SPONSOR_TIERS.map((x) => <option key={x} value={x}>{t(`ex.tier.${x}`)}</option>)}</select></Field>
            )}
            {kind === 'session' && (
              <>
                <Field label={t('ex.a.type')}><select className={inputCls} value={draft.category} onChange={(e) => up({ category: e.target.value })}>{SESSION_TYPES.map((x) => <option key={x} value={x}>{sessionTypeLabel(x, lang === 'ar') ?? t(`ex.type.${x}`)}</option>)}</select></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('ex.a.startsAt')}><input type="datetime-local" dir="ltr" className={inputCls} value={draft.startsAt} onChange={(e) => up({ startsAt: e.target.value })} /></Field>
                  <Field label={t('ex.a.endsAt')} error={errors.endsAt}><input type="datetime-local" dir="ltr" className={inputCls} value={draft.endsAt} onChange={(e) => up({ endsAt: e.target.value })} /></Field>
                </div>
                {txt('ex.a.speakerAr', 'personAr', 'rtl', { max: 150 })}
                {txt('ex.a.speakerEn', 'personEn', 'ltr', { max: 150 })}
              </>
            )}
            {kind !== 'sponsor' && <>{txt(kind === 'session' ? 'ex.a.hallAr' : 'ex.a.boothAr', 'placeAr', 'rtl', { max: 150 })}{txt(kind === 'session' ? 'ex.a.hallEn' : 'ex.a.boothEn', 'placeEn', 'ltr', { max: 150 })}</>}
            {kind !== 'session' && <Field label={t('ex.a.website')} error={errors.website}><input type="url" dir="ltr" maxLength={500} placeholder="https://" className={inputCls} value={draft.website} onChange={(e) => up({ website: e.target.value })} /></Field>}
            {kind !== 'session' && (
              <>
                <Field label={t('ex.a.logo')} error={errors.logo}><input type="file" accept="image/jpeg,image/png,image/webp" className={inputCls} onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ''; }} /></Field>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {logo && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{logo.name}</span>}
                  {!logo && draft.logoUrl && !draft.removeLogo && <img src={fileUrl(draft.logoUrl)} alt="" className="h-16 w-24 rounded object-contain" />}
                  {!logo && draft.logoUrl && <label className="flex items-center gap-2"><input type="checkbox" checked={draft.removeLogo} onChange={(e) => up({ removeLogo: e.target.checked })} />{t('tr.removeImage')}</label>}
                </div>
              </>
            )}
            {kind !== 'session' && <Field label={t('ex.a.order')} error={errors.sortOrder}><input inputMode="numeric" dir="ltr" maxLength={6} className={inputCls} value={draft.sortOrder} onChange={(e) => up({ sortOrder: e.target.value })} /></Field>}
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
