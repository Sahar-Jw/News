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
import { ImageSet, ImageSetField, appendImages, emptyImageSet, imageSetOf, releaseImages } from '@/components/admin/image-set-field';

type Scope = 'all' | 'upcoming' | 'previous';
interface Row { id: number; titleAr: string; titleEn: string; eventDate: string; isUpcoming: boolean; images: string[]; imageUrls: string[]; imageCount: number }
interface Draft { id?: number; titleAr: string; titleEn: string; eventDate: string; imgs: ImageSet }

const READ: Record<Scope, string[]> = {
  all: ['occasions.read'],
  upcoming: ['occasions.upcoming.read', 'occasions.read'],
  previous: ['occasions.previous.read', 'occasions.read'],
};

/** One table for all occasions, the upcoming ones (date today or later) or the previous ones (date passed). */
export function OccasionsAdmin({ scope }: { scope: Scope }) {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);
  const endpoint = scope === 'all' ? '/admin/occasions' : `/admin/occasions/${scope}`;
  const title = t(scope === 'all' ? 'adm.occasions' : scope === 'upcoming' ? 'adm.occasionsUpcoming' : 'adm.occasionsPrevious');

  const close = () => { if (draft) releaseImages(draft.imgs); setDraft(null); };
  const open = (r?: Row) => setDraft(r
    ? { id: r.id, titleAr: r.titleAr, titleEn: r.titleEn, eventDate: r.eventDate.slice(0, 10), imgs: imageSetOf(r.images, r.imageUrls) }
    : { titleAr: '', titleEn: '', eventDate: '', imgs: emptyImageSet() });

  const cols: Col<Row>[] = [
    { key: 'titleAr', label: t('oc.titleAr') },
    { key: 'titleEn', label: t('oc.titleEn') },
    { key: 'eventDate', type: 'date', label: t('oc.date'), render: (r) => fmtDay(lang, r.eventDate), text: (r) => r.eventDate.slice(0, 10) },
    ...(scope === 'all' ? [{
      key: 'status', searchable: false, exportable: false, label: t('oc.status'),
      render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${r.isUpcoming ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(r.isUpcoming ? 'oc.upcoming' : 'oc.previous')}</span>,
      text: (r) => t(r.isUpcoming ? 'oc.upcoming' : 'oc.previous'),
    } as Col<Row>] : []),
    {
      key: 'imageCount', searchable: false, label: t('oc.imageCount'),
      render: (r) => r.imageUrls.length ? (
        <div className="flex items-center gap-1">
          <img src={fileUrl(r.imageUrls[0])} alt="" className="h-8 w-10 rounded object-cover" />
          <span className="text-xs text-gray-500">{r.imageCount}</span>
        </div>
      ) : <span className="text-xs text-gray-400">{t('oc.noImages')}</span>,
    },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const fd = new FormData();
    fd.append('titleAr', draft.titleAr.trim());
    fd.append('titleEn', draft.titleEn.trim());
    fd.append('eventDate', draft.eventDate);
    appendImages(fd, draft.imgs, !!draft.id);
    setBusy(true);
    try {
      await api(draft.id ? `/admin/occasions/${draft.id}` : '/admin/occasions', { method: draft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      close();
      setKey((k) => k + 1);
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/occasions/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <RequirePerm any={READ[scope]}>
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      <DataTable<Row>
        endpoint={endpoint}
        columns={cols}
        dateFilter
        refreshKey={key}
        exportable={scope === 'all' && can('occasions.read')}
        exportName="occasions"
        filters={scope === 'all' ? [{ key: 'status', label: t('oc.status'), options: [{ value: 'upcoming', label: t('oc.upcoming') }, { value: 'previous', label: t('oc.previous') }] }] : []}
        bulkDelete={{ path: '/admin/occasions/bulk-delete', can: can('occasions.delete') }}
        toolbar={can('occasions.create') && <Button onClick={() => open()}>＋ {t('oc.addOccasion')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('occasions.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('occasions.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={close} title={draft?.id ? t('oc.editOccasion') : t('oc.addOccasion')} wide>
        {draft && (
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('oc.titleAr')}><input required maxLength={255} dir="rtl" className={inputCls} value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} /></Field>
              <Field label={t('oc.titleEn')}><input required maxLength={255} dir="ltr" className={inputCls} value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} /></Field>
              <Field label={t('oc.date')}><input required type="date" className={inputCls} value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} /></Field>
            </div>
            <Field label={t('oc.images')}><ImageSetField value={draft.imgs} onChange={(imgs) => setDraft({ ...draft, imgs })} /></Field>
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
