'use client';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { parseYoutubeId } from '@/lib/youtube';
import { Button, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { ImageSet, ImageSetField, appendImages, emptyImageSet, imageSetOf, imageTotal, releaseImages } from '@/components/admin/image-set-field';

const PHOTO_CATEGORIES = ['meeting', 'event', 'exhibition', 'conference', 'visit', 'committee', 'course', 'expo'];
const VIDEO_CATEGORIES = ['activity', 'coverage', 'encounter', 'expo'];
interface Row { id: number; titleAr: string; titleEn: string; kind: 'photos' | 'video'; youtubeUrl: string; category: string; images: string[]; imageUrls: string[]; imageCount: number; committeeId: number | null; createdAt: string }
interface Draft { id?: number; titleAr: string; titleEn: string; kind: 'photos' | 'video'; youtubeUrl: string; category: string; committeeId: string; imgs: ImageSet }
interface CommitteeOpt { id: number; name: string }

/**
 * The add / edit window of one album or video. Used by the Settings table and by the public Gallery page (so a manager does not
 * have to leave the page). Give `id` to edit (loaded here); without it a new album is added.
 */
export function GalleryDialog({ id, onClose, onSaved }: { id?: number; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(id ? null : { titleAr: '', titleEn: '', kind: 'photos', youtubeUrl: '', category: '', committeeId: '', imgs: emptyImageSet() });
  const [busy, setBusy] = useState(false);
  const [committees, setCommittees] = useState<CommitteeOpt[]>([]);

  // committees an album can be attached to (public list: no extra permission needed)
  useEffect(() => { api<CommitteeOpt[]>('/public/committees', { params: { lang } }).then(setCommittees).catch(() => setCommittees([])); }, [lang]);
  useEffect(() => {
    if (!id) return;
    api<Row>(`/admin/gallery/${id}`)
      .then((r) => setDraft({ id: r.id, titleAr: r.titleAr, titleEn: r.titleEn, kind: r.kind, youtubeUrl: r.youtubeUrl, category: r.category, committeeId: r.committeeId ? String(r.committeeId) : '', imgs: imageSetOf(r.images, r.imageUrls) }))
      .catch((e) => { toast(e.message, 'err'); onClose(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { if (draft) releaseImages(draft.imgs); onClose(); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (draft.kind === 'photos' && imageTotal(draft.imgs) < 1) return toast(t('oc.imagesRequired'), 'err');
    if (draft.kind === 'video' && !parseYoutubeId(draft.youtubeUrl)) return toast(t('gl.youtubeInvalid'), 'err');
    const fd = new FormData();
    fd.append('titleAr', draft.titleAr.trim());
    fd.append('titleEn', draft.titleEn.trim());
    fd.append('kind', draft.kind);
    fd.append('youtubeUrl', draft.kind === 'video' ? draft.youtubeUrl.trim() : '');
    fd.append('category', draft.category);
    fd.append('committeeId', draft.committeeId);
    appendImages(fd, draft.imgs, !!draft.id);
    setBusy(true);
    try {
      await api(draft.id ? `/admin/gallery/${draft.id}` : '/admin/gallery', { method: draft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      onSaved();
      close();
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={close} title={draft?.id || id ? t('gl.edit') : t('gl.add')} wide>
      {!draft ? <div className="flex justify-center py-10"><Spinner /></div> : (
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('oc.titleAr')}><input required maxLength={255} dir="rtl" className={inputCls} value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} /></Field>
              <Field label={t('oc.titleEn')}><input required maxLength={255} dir="ltr" className={inputCls} value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} /></Field>
              <Field label={t('gl.type')}>
                <select className={inputCls} value={draft.kind} onChange={(e) => { const kind = e.target.value as Draft['kind']; const ok = kind === 'video' ? VIDEO_CATEGORIES : PHOTO_CATEGORIES; setDraft({ ...draft, kind, category: ok.includes(draft.category) ? draft.category : '' }); }}>
                  <option value="photos">{t('gl.kind.photos')}</option><option value="video">{t('gl.kind.video')}</option>
                </select>
              </Field>
              <Field label={t('gl.category')}>
                <select className={inputCls} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  <option value="">{t('gl.noCategory')}</option>
                  {(draft.kind === 'video' ? VIDEO_CATEGORIES : PHOTO_CATEGORIES).map((c) => <option key={c} value={c}>{t(`gl.cat.${c}`)}</option>)}
                </select>
              </Field>
              {draft.kind === 'video' && (
                <div className="md:col-span-2">
                  <Field label={t('gl.youtubeUrl')} hint={t('gl.youtubeHint')}>
                    <input required dir="ltr" maxLength={255} placeholder="https://www.youtube.com/watch?v=..." className={inputCls} value={draft.youtubeUrl} onChange={(e) => setDraft({ ...draft, youtubeUrl: e.target.value })} />
                  </Field>
                  {draft.youtubeUrl.trim() && (parseYoutubeId(draft.youtubeUrl)
                    ? <img src={`https://i.ytimg.com/vi/${parseYoutubeId(draft.youtubeUrl)}/mqdefault.jpg`} alt="" className="mt-2 h-24 rounded-lg object-cover ring-1 ring-line" />
                    : <p className="mt-1 text-xs text-red-600">{t('gl.youtubeInvalid')}</p>)}
                </div>
              )}
              {committees.length > 0 && (
                <Field label={t('gl.committee')} hint={t('gl.committeeHint')}>
                  <select className={inputCls} value={draft.committeeId} onChange={(e) => setDraft({ ...draft, committeeId: e.target.value })}>
                    <option value="">{t('gl.noCommittee')}</option>
                    {committees.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}
            </div>
            <Field label={draft.kind === 'video' ? t('gl.cover') : t('oc.images')}><ImageSetField value={draft.imgs} onChange={(imgs) => setDraft({ ...draft, imgs })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
          </form>
      )}
    </Modal>
  );
}

/** Image and video gallery: a titled photo album or a YouTube video, optionally classified (meetings, events, exhibitions ...) and attached to a committee. */
export function GalleryAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ id?: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const cols: Col<Row>[] = [
    { key: 'titleAr', label: t('oc.titleAr') },
    { key: 'titleEn', label: t('oc.titleEn') },
    { key: 'kind', searchable: false, label: t('gl.type'), render: (r) => t(`gl.kind.${r.kind}`), text: (r) => t(`gl.kind.${r.kind}`) },
    { key: 'category', searchable: false, label: t('gl.category'), render: (r) => (r.category ? t(`gl.cat.${r.category}`) : '—'), text: (r) => (r.category ? t(`gl.cat.${r.category}`) : '') },
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
        toolbar={can('gallery.create') && <Button onClick={() => setDialog({})}>＋ {t('gl.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            <a href={`/${lang}/gallery/view/?id=${r.id}`} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost">{t('app.view')}</Button></a>
            {can('gallery.update') && <Button size="sm" variant="outline" onClick={() => setDialog({ id: r.id })}>{t('app.edit')}</Button>}
            {can('gallery.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      {dialog && <GalleryDialog key={dialog.id ?? 'new'} id={dialog.id} onClose={() => setDialog(null)} onSaved={() => setKey((k) => k + 1)} />}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{t('app.delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
