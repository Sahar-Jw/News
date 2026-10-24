'use client';
import { useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { ImageSet, ImageSetField, appendImages, emptyImageSet, imageSetOf, imageTotal, releaseImages } from '@/components/admin/image-set-field';

interface Row { id: number; titleAr: string; titleEn: string; images: string[]; imageUrls: string[]; imageCount: number; createdAt: string }
interface Draft { id?: number; titleAr: string; titleEn: string; imgs: ImageSet }

/** Image galleries: a titled set of pictures, shown on the site with the same slider as news. */
export function GalleryAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const close = () => { if (draft) releaseImages(draft.imgs); setDraft(null); };
  const open = (r?: Row) => setDraft(r
    ? { id: r.id, titleAr: r.titleAr, titleEn: r.titleEn, imgs: imageSetOf(r.images, r.imageUrls) }
    : { titleAr: '', titleEn: '', imgs: emptyImageSet() });

  const cols: Col<Row>[] = [
    { key: 'titleAr', label: t('oc.titleAr') },
    { key: 'titleEn', label: t('oc.titleEn') },
    {
      key: 'imageCount', searchable: false, label: t('oc.imageCount'),
      render: (r) => (
        <div className="flex items-center gap-1">
          {r.imageUrls[0] && <img src={fileUrl(r.imageUrls[0])} alt="" className="h-8 w-10 rounded object-cover" />}
          <span className="text-xs text-gray-500">{r.imageCount}</span>
        </div>
      ),
    },
    { key: 'createdAt', searchable: false, exportable: false, label: t('oc.created'), render: (r) => fmtDate(lang, r.createdAt) },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (imageTotal(draft.imgs) < 1) return toast(t('oc.imagesRequired'), 'err');
    const fd = new FormData();
    fd.append('titleAr', draft.titleAr.trim());
    fd.append('titleEn', draft.titleEn.trim());
    appendImages(fd, draft.imgs, !!draft.id);
    setBusy(true);
    try {
      await api(draft.id ? `/admin/gallery/${draft.id}` : '/admin/gallery', { method: draft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      close();
      setKey((k) => k + 1);
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/gallery/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <RequirePerm any={['gallery.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.gallery')}</h1>
      <DataTable<Row>
        endpoint="/admin/gallery"
        columns={cols}
        exportable={false}
        refreshKey={key}
        bulkDelete={{ path: '/admin/gallery/bulk-delete', can: can('gallery.delete') }}
        toolbar={can('gallery.create') && <Button onClick={() => open()}>＋ {t('oc.addGallery')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            <a href={`/${lang}/gallery/view/?id=${r.id}`} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost">{t('app.view')}</Button></a>
            {can('gallery.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('gallery.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={close} title={draft?.id ? t('oc.editGallery') : t('oc.addGallery')} wide>
        {draft && (
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('oc.titleAr')}><input required maxLength={255} dir="rtl" className={inputCls} value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} /></Field>
              <Field label={t('oc.titleEn')}><input required maxLength={255} dir="ltr" className={inputCls} value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} /></Field>
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
