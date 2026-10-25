'use client';
import { useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { ImageSet, ImageSetField, appendImages, emptyImageSet, imageSetOf, imageTotal, releaseImages } from '@/components/admin/image-set-field';

type Placement = 'golden' | 'bronze' | 'silver';
type State = 'running' | 'scheduled' | 'expired' | 'off';
interface Row { id: number; ownerCompany: string; linkUrl: string; placement: Placement; isActive: boolean; startDate: string; endDate: string; state: State; images: string[]; imageUrls: string[]; imageCount: number }
interface Draft { id?: number; ownerCompany: string; linkUrl: string; placement: Placement; isActive: boolean; startDate: string; endDate: string; imgs: ImageSet }

const PLACEMENT_BADGE: Record<Placement, string> = { golden: 'bg-amber-100 text-amber-800', bronze: 'bg-orange-100 text-orange-800', silver: 'bg-slate-200 text-slate-700' };
const STATE_BADGE: Record<State, string> = { running: 'bg-emerald-100 text-emerald-700', scheduled: 'bg-sky-100 text-sky-700', expired: 'bg-gray-100 text-gray-600', off: 'bg-red-100 text-red-700' };
const PLACEMENTS: Placement[] = ['golden', 'bronze', 'silver'];

/** Ads: a picture (or several = carousel), the link it opens, the owner company, where it shows and for how long. */
export function AdsAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const close = () => { if (draft) releaseImages(draft.imgs); setDraft(null); };
  const open = (r?: Row) => setDraft(r
    ? { id: r.id, ownerCompany: r.ownerCompany, linkUrl: r.linkUrl, placement: r.placement, isActive: r.isActive, startDate: r.startDate.slice(0, 10), endDate: r.endDate.slice(0, 10), imgs: imageSetOf(r.images, r.imageUrls) }
    : { ownerCompany: '', linkUrl: '', placement: 'golden', isActive: true, startDate: '', endDate: '', imgs: emptyImageSet() });

  const cols: Col<Row>[] = [
    {
      key: 'imageCount', searchable: false, exportable: false, label: t('oc.images'),
      render: (r) => <div className="flex items-center gap-1">{r.imageUrls[0] && <img src={fileUrl(r.imageUrls[0])} alt="" className="h-8 w-12 rounded object-cover" />}<span className="text-xs text-gray-500">{r.imageCount}</span></div>,
    },
    { key: 'ownerCompany', exportable: false, label: t('ad.owner') },
    { key: 'linkUrl', exportable: false, label: t('ad.link'), render: (r) => <a href={r.linkUrl} target="_blank" rel="noopener noreferrer" className="block max-w-[14rem] truncate text-primary hover:underline" dir="ltr">{r.linkUrl}</a> },
    { key: 'placement', exportable: false, searchable: false, label: t('ad.placement'), render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${PLACEMENT_BADGE[r.placement]}`}>{t(`ad.${r.placement}`)}</span> },
    { key: 'startDate', exportable: false, type: 'date', label: t('ad.start'), render: (r) => fmtDay(lang, r.startDate) },
    { key: 'endDate', exportable: false, type: 'date', label: t('ad.end'), render: (r) => fmtDay(lang, r.endDate) },
    {
      key: 'isActive', exportable: false, searchable: false, label: t('ad.active'),
      text: (r) => t(r.isActive ? 'ad.active' : 'ad.off'),
      render: (r) => {
        const pill = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`;
        const dot = <span className={`h-2 w-2 rounded-full ${r.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />;
        const label = t(r.isActive ? 'ad.active' : 'ad.off');
        return can('ads.update')
          ? <button type="button" role="switch" aria-checked={r.isActive} title={t(r.isActive ? 'sub.deactivate' : 'sub.activate')} onClick={() => toggle(r)} className={`${pill} hover:brightness-95`}>{dot}{label}</button>
          : <span className={pill}>{dot}{label}</span>;
      },
    },
    { key: 'state', exportable: false, searchable: false, label: t('ad.status'), render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${STATE_BADGE[r.state]}`}>{t(`ad.${r.state}`)}</span> },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (draft.endDate < draft.startDate) return toast(t('ad.badDates'), 'err');
    if (imageTotal(draft.imgs) < 1) return toast(t('oc.imagesRequired'), 'err');
    const fd = new FormData();
    fd.append('ownerCompany', draft.ownerCompany.trim());
    fd.append('linkUrl', draft.linkUrl.trim());
    fd.append('placement', draft.placement);
    fd.append('isActive', String(draft.isActive));
    fd.append('startDate', draft.startDate);
    fd.append('endDate', draft.endDate);
    appendImages(fd, draft.imgs, !!draft.id);
    setBusy(true);
    try {
      await api(draft.id ? `/admin/ads/${draft.id}` : '/admin/ads', { method: draft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      close();
      setKey((k) => k + 1);
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  // one click on the pill in the table switches the ad on / off (needs ads.update; read-only users just see the state)
  const toggle = async (r: Row) => {
    try {
      await api(`/admin/ads/${r.id}`, { method: 'PATCH', body: { isActive: !r.isActive } });
      toast(t('app.saved'));
      setKey((k) => k + 1);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/ads/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <RequirePerm any={['ads.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.ads')}</h1>
      <DataTable<Row>
        endpoint="/admin/ads"
        columns={cols}
        dateFilter
        exportable={false}
        refreshKey={key}
        filters={[
          { key: 'placement', label: t('ad.placement'), options: PLACEMENTS.map((p) => ({ value: p, label: t(`ad.${p}`) })) },
          { key: 'isActive', label: t('ad.active'), options: [{ value: 'true', label: t('sub.yes') }, { value: 'false', label: t('sub.no') }] },
        ]}
        bulkDelete={{ path: '/admin/ads/bulk-delete', can: can('ads.delete') }}
        toolbar={can('ads.create') && <Button onClick={() => open()}>＋ {t('ad.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('ads.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('ads.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={close} title={draft?.id ? t('ad.edit') : t('ad.add')} wide>
        {draft && (
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('ad.owner')}><input required maxLength={255} className={inputCls} value={draft.ownerCompany} onChange={(e) => setDraft({ ...draft, ownerCompany: e.target.value })} /></Field>
              <Field label={t('ad.link')}><input required type="url" dir="ltr" maxLength={500} placeholder="https://" className={inputCls} value={draft.linkUrl} onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })} /></Field>
              <Field label={t('ad.placement')}>
                <select className={inputCls} value={draft.placement} onChange={(e) => setDraft({ ...draft, placement: e.target.value as Placement })}>
                  {PLACEMENTS.map((p) => <option key={p} value={p}>{t(`ad.${p}`)}</option>)}
                </select>
              </Field>
              <Field label={t('ad.active')}>
                <span className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />{t('ad.active')}</span>
              </Field>
              <Field label={t('ad.start')}><input required type="date" className={inputCls} value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /></Field>
              <Field label={t('ad.end')}><input required type="date" min={draft.startDate || undefined} className={inputCls} value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></Field>
            </div>
            <Field label={t('oc.images')} hint={t('ad.imagesHint')}><ImageSetField value={draft.imgs} onChange={(imgs) => setDraft({ ...draft, imgs })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
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
