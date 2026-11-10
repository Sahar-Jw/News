'use client';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { LinkedNewsPanel } from '@/components/admin/linked-news-panel';
import { ImageSet, ImageSetField, appendImages, emptyImageSet, imageSetOf, releaseImages } from '@/components/admin/image-set-field';

interface Coverage { title: string; url: string; source: string }
interface Details {
  descriptionAr: string; descriptionEn: string; locationAr: string; locationEn: string; sectorAr: string; sectorEn: string; organizerAr: string; organizerEn: string;
  participation: '' | 'organized' | 'participating'; parentId: number | null; videos: string[]; coverage: Coverage[];
  startTime: string; endTime: string; audienceAr: string; audienceEn: string; registrationUrl: string; registrationNoteAr: string; registrationNoteEn: string;
}
interface Row extends Details { id: number; titleAr: string; titleEn: string; eventDate: string; finishDate: string; type: 'occasion' | 'exhibition'; isUpcoming: boolean; images: string[]; imageUrls: string[]; imageCount: number }
interface Draft extends Omit<Details, 'videos'> { id?: number; titleAr: string; titleEn: string; eventDate: string; finishDate: string; type: 'occasion' | 'exhibition'; imgs: ImageSet; videosText: string }

const NO_DETAILS = { descriptionAr: '', descriptionEn: '', locationAr: '', locationEn: '', sectorAr: '', sectorEn: '', organizerAr: '', organizerEn: '', participation: '' as const, parentId: null, coverage: [] as Coverage[], startTime: '', endTime: '', audienceAr: '', audienceEn: '', registrationUrl: '', registrationNoteAr: '', registrationNoteEn: '' };
const NEWS_KINDS_AR: [string, string][] = [['news', 'خبر'], ['visit', 'زيارة'], ['meeting', 'لقاء'], ['participation', 'مشاركة'], ['activity', 'فعالية'], ['coverage', 'تغطية إعلامية']];
const NEWS_KINDS_EN: [string, string][] = [['news', 'News'], ['visit', 'Visit'], ['meeting', 'Meeting'], ['participation', 'Participation'], ['activity', 'Activity'], ['coverage', 'Media coverage']];

/** All occasions; the status filter shows only the upcoming ones (date today or later) or only the previous ones. */
export function OccasionsAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);
  const [exhibitions, setExhibitions] = useState<{ id: number; titleAr: string }[]>([]);
  const ar = lang === 'ar';
  const tr = (a: string, e: string) => (ar ? a : e);
  useEffect(() => {
    if (!draft) return;
    api<{ data: { id: number; titleAr: string }[] }>('/admin/occasions', { params: { type: 'exhibition', limit: 'all' } }).then((r) => setExhibitions(r.data)).catch(() => setExhibitions([]));
  }, [!!draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => { if (draft) releaseImages(draft.imgs); setDraft(null); };
  const open = (r?: Row) => setDraft(r
    ? { id: r.id, titleAr: r.titleAr, titleEn: r.titleEn, eventDate: r.eventDate.slice(0, 10), finishDate: r.finishDate.slice(0, 10), type: r.type, imgs: imageSetOf(r.images, r.imageUrls),
      descriptionAr: r.descriptionAr, descriptionEn: r.descriptionEn, locationAr: r.locationAr, locationEn: r.locationEn, sectorAr: r.sectorAr, sectorEn: r.sectorEn, organizerAr: r.organizerAr, organizerEn: r.organizerEn,
      participation: r.participation, parentId: r.parentId, coverage: r.coverage ?? [], startTime: r.startTime ?? '', endTime: r.endTime ?? '', audienceAr: r.audienceAr ?? '', audienceEn: r.audienceEn ?? '', registrationUrl: r.registrationUrl ?? '', registrationNoteAr: r.registrationNoteAr ?? '', registrationNoteEn: r.registrationNoteEn ?? '', videosText: (r.videos ?? []).join('\n') }
    : { titleAr: '', titleEn: '', eventDate: '', finishDate: '', type: 'occasion', imgs: emptyImageSet(), ...NO_DETAILS, videosText: '' });

  const cols: Col<Row>[] = [
    { key: 'titleAr', label: t('oc.titleAr') },
    { key: 'titleEn', label: t('oc.titleEn') },
    { key: 'eventDate', type: 'date', label: t('oc.date'), render: (r) => fmtDay(lang, r.eventDate), text: (r) => r.eventDate.slice(0, 10) },
    { key: 'sector', label: tr('القطاع', 'Sector'), render: (r) => (ar ? r.sectorAr : r.sectorEn || r.sectorAr) || '—', text: (r) => r.sectorAr },
    { key: 'organizer', label: tr('الجهة المنظمة', 'Organizer'), render: (r) => (ar ? r.organizerAr : r.organizerEn || r.organizerAr) || '—', text: (r) => r.organizerAr },
    { key: 'finishDate', type: 'date', label: t('oc.finishDate'), render: (r) => fmtDay(lang, r.finishDate), text: (r) => r.finishDate.slice(0, 10) },
    { key: 'type', searchable: false, label: t('oc.type'), render: (r) => t(`oc.${r.type}`), text: (r) => t(`oc.${r.type}`) },
    {
      key: 'status', searchable: false, exportable: false, label: t('oc.status'),
      render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${r.isUpcoming ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(r.isUpcoming ? 'oc.upcoming' : 'oc.previous')}</span>,
      text: (r) => t(r.isUpcoming ? 'oc.upcoming' : 'oc.previous'),
    },
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
    fd.append('finishDate', draft.finishDate);
    fd.append('type', draft.type);
    for (const k of ['descriptionAr', 'descriptionEn', 'locationAr', 'locationEn', 'sectorAr', 'sectorEn', 'organizerAr', 'organizerEn', 'participation', 'startTime', 'endTime', 'audienceAr', 'audienceEn', 'registrationUrl', 'registrationNoteAr', 'registrationNoteEn'] as const) fd.append(k, draft[k].trim());
    fd.append('parentId', String(draft.type === 'occasion' && draft.parentId ? draft.parentId : 0));
    fd.append('videos', JSON.stringify(draft.videosText.split('\n').map((v) => v.trim()).filter(Boolean)));
    fd.append('coverage', JSON.stringify(draft.coverage.filter((c) => c.url.trim())));
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
    <RequirePerm any={['occasions.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.occasions')}</h1>
      <DataTable<Row>
        endpoint="/admin/occasions"
        columns={cols}
        dateFilter
        refreshKey={key}
        exportable={can('occasions.export')}
        exportName="occasions"
        filters={[
          { key: 'status', label: t('oc.status'), options: [{ value: 'upcoming', label: t('oc.upcoming') }, { value: 'current', label: t('oc.current') }, { value: 'previous', label: t('oc.previous') }, { value: 'exhibitions', label: t('oc.exhibitions') }] },
          { key: 'type', label: t('oc.type'), options: [{ value: 'occasion', label: t('oc.occasion') }, { value: 'exhibition', label: t('oc.exhibition') }] },
          { key: 'participation', label: tr('نوع المشاركة', 'Participation'), options: [{ value: 'organized', label: tr('تنظمها الغرفة', 'Organized by the Chamber') }, { value: 'participating', label: tr('تشارك فيها الغرفة', 'Chamber participates') }] },
        ]}
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
              <Field label={t('oc.type')}><select className={inputCls} value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft['type'] })}><option value="occasion">{t('oc.occasion')}</option><option value="exhibition">{t('oc.exhibition')}</option></select></Field>
              <Field label={t('oc.date')}><input required type="date" className={inputCls} value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} /></Field>
              <Field label={t('oc.finishDate')}><input required type="date" min={draft.eventDate || undefined} className={inputCls} value={draft.finishDate} onChange={(e) => setDraft({ ...draft, finishDate: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={tr('القطاع (عربي)', 'Sector (Arabic)')}><input maxLength={150} dir="rtl" className={inputCls} value={draft.sectorAr} onChange={(e) => setDraft({ ...draft, sectorAr: e.target.value })} /></Field>
              <Field label={tr('القطاع (إنجليزي)', 'Sector (English)')}><input maxLength={150} dir="ltr" className={inputCls} value={draft.sectorEn} onChange={(e) => setDraft({ ...draft, sectorEn: e.target.value })} /></Field>
              <Field label={tr('الجهة المنظمة (عربي)', 'Organizer (Arabic)')}><input maxLength={200} dir="rtl" className={inputCls} value={draft.organizerAr} onChange={(e) => setDraft({ ...draft, organizerAr: e.target.value })} /></Field>
              <Field label={tr('الجهة المنظمة (إنجليزي)', 'Organizer (English)')}><input maxLength={200} dir="ltr" className={inputCls} value={draft.organizerEn} onChange={(e) => setDraft({ ...draft, organizerEn: e.target.value })} /></Field>
              <Field label={tr('وقت البداية', 'Start time')}><input type="time" className={inputCls} value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} /></Field>
              <Field label={tr('وقت النهاية', 'End time')}><input type="time" className={inputCls} value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} /></Field>
              <Field label={tr('الفئة المستهدفة (عربي)', 'Target audience (Arabic)')}><input maxLength={255} dir="rtl" className={inputCls} value={draft.audienceAr} onChange={(e) => setDraft({ ...draft, audienceAr: e.target.value })} /></Field>
              <Field label={tr('الفئة المستهدفة (إنجليزي)', 'Target audience (English)')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.audienceEn} onChange={(e) => setDraft({ ...draft, audienceEn: e.target.value })} /></Field>
              <Field label={tr('رابط التسجيل (اختياري)', 'Registration link (optional)')}><input type="url" maxLength={500} dir="ltr" placeholder="https://" className={inputCls} value={draft.registrationUrl} onChange={(e) => setDraft({ ...draft, registrationUrl: e.target.value })} /></Field>
              <div />
              <Field label={tr('ملاحظة التسجيل (عربي)', 'Registration note (Arabic)')}><input maxLength={255} dir="rtl" className={inputCls} value={draft.registrationNoteAr} onChange={(e) => setDraft({ ...draft, registrationNoteAr: e.target.value })} /></Field>
              <Field label={tr('ملاحظة التسجيل (إنجليزي)', 'Registration note (English)')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.registrationNoteEn} onChange={(e) => setDraft({ ...draft, registrationNoteEn: e.target.value })} /></Field>
              <Field label={tr('المكان (عربي)', 'Place (Arabic)')}><input maxLength={255} dir="rtl" className={inputCls} value={draft.locationAr} onChange={(e) => setDraft({ ...draft, locationAr: e.target.value })} /></Field>
              <Field label={tr('المكان (إنجليزي)', 'Place (English)')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.locationEn} onChange={(e) => setDraft({ ...draft, locationEn: e.target.value })} /></Field>
              {draft.type === 'exhibition' && (
                <Field label={tr('نوع المشاركة', 'Participation type')}>
                  <select className={inputCls} value={draft.participation} onChange={(e) => setDraft({ ...draft, participation: e.target.value as Draft['participation'] })}>
                    <option value="">—</option><option value="organized">{tr('تنظمها الغرفة', 'Organized by the Chamber')}</option><option value="participating">{tr('تشارك فيها الغرفة', 'Chamber participates')}</option>
                  </select>
                </Field>
              )}
              {draft.type === 'occasion' && (
                <Field label={tr('معرض مرتبط (اختياري)', 'Related exhibition (optional)')}>
                  <select className={inputCls} value={draft.parentId ?? 0} onChange={(e) => setDraft({ ...draft, parentId: Number(e.target.value) || null })}>
                    <option value={0}>—</option>{exhibitions.filter((x) => x.id !== draft.id).map((x) => <option key={x.id} value={x.id}>{x.titleAr}</option>)}
                  </select>
                </Field>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={tr('الوصف (عربي)', 'Description (Arabic)')}><textarea rows={4} maxLength={6000} dir="rtl" className={inputCls} value={draft.descriptionAr} onChange={(e) => setDraft({ ...draft, descriptionAr: e.target.value })} /></Field>
              <Field label={tr('الوصف (إنجليزي)', 'Description (English)')}><textarea rows={4} maxLength={6000} dir="ltr" className={inputCls} value={draft.descriptionEn} onChange={(e) => setDraft({ ...draft, descriptionEn: e.target.value })} /></Field>
            </div>
            <Field label={tr('فيديوهات يوتيوب (رابط في كل سطر)', 'YouTube videos (one link per line)')}><textarea rows={3} dir="ltr" className={inputCls} value={draft.videosText} onChange={(e) => setDraft({ ...draft, videosText: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." /></Field>
            <Field label={tr('روابط التغطية الإعلامية', 'Media coverage links')}>
              <div className="space-y-2">
                {draft.coverage.map((c, i) => (
                  <div key={i} className="grid gap-2 md:grid-cols-[1fr_1.4fr_10rem_auto]">
                    <input className={inputCls} placeholder={tr('العنوان', 'Title')} value={c.title} onChange={(e) => setDraft({ ...draft, coverage: draft.coverage.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} />
                    <input className={inputCls} dir="ltr" placeholder="https://" value={c.url} onChange={(e) => setDraft({ ...draft, coverage: draft.coverage.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
                    <input className={inputCls} placeholder={tr('الجهة', 'Outlet')} value={c.source} onChange={(e) => setDraft({ ...draft, coverage: draft.coverage.map((x, j) => j === i ? { ...x, source: e.target.value } : x) })} />
                    <Button type="button" size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDraft({ ...draft, coverage: draft.coverage.filter((_, j) => j !== i) })}>✕</Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, coverage: [...draft.coverage, { title: '', url: '', source: '' }] })}>＋ {tr('إضافة رابط', 'Add link')}</Button>
              </div>
            </Field>
            <Field label={t('oc.images')}><ImageSetField value={draft.imgs} onChange={(imgs) => setDraft({ ...draft, imgs })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
          </form>
        )}
        {draft?.id && can('occasions.update') && <LinkedNewsPanel base={`/admin/occasions/${draft.id}`} kinds={ar ? NEWS_KINDS_AR : NEWS_KINDS_EN} />}
      </Modal>
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{t('app.delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
