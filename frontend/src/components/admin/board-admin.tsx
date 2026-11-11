'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { RichEditor } from '@/components/admin/rich-editor';
import { LinkedNewsPanel } from '@/components/admin/linked-news-panel';

export interface BoardRow { id: number; position: string; nameAr: string; nameEn: string; jobTitleAr: string; jobTitleEn: string; bioAr: string; bioEn: string; dutiesAr: string; dutiesEn: string; termLabel: string; photoUrl: string | null; sortOrder: number; isActive: boolean }
interface Draft { id?: number; position: string; nameAr: string; nameEn: string; jobTitleAr: string; jobTitleEn: string; bioAr: string; bioEn: string; dutiesAr: string; dutiesEn: string; termLabel: string; sortOrder: string; isActive: boolean; photoUrl: string | null }
type Row = BoardRow;
const POSITIONS = ['president', 'vice_president', 'secretary', 'treasurer', 'member'];
const EMPTY: Draft = { position: 'member', nameAr: '', nameEn: '', jobTitleAr: '', jobTitleEn: '', bioAr: '', bioEn: '', dutiesAr: '', dutiesEn: '', termLabel: '', sortOrder: '0', isActive: true, photoUrl: null };

const toDraft = (r: Row): Draft => ({ ...r, sortOrder: String(r.sortOrder) });

/**
 * The add / edit window of one board member. Used by the Settings table and by the public Board page (so a manager does not
 * have to leave the page). Give `row` (already loaded) or `id` (loaded here); with neither it adds a new member.
 */
export function BoardMemberDialog({ row, id, onClose, onSaved }: { row?: Row | null; id?: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(row ? toDraft(row) : id ? null : { ...EMPTY });
  const [photo, setPhoto] = useState<File | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (draft || !id) return;
    api<Row>(`/admin/board/${id}`).then((r) => setDraft(toDraft(r))).catch((e) => { toast(e.message, 'err'); onClose(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast(t('board.imageOnly'), 'err');
    if (f.size > 5 * 1024 * 1024) return toast('≤ 5MB', 'err');
    setPhoto(f); setDropPhoto(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const fd = new FormData();
    const f = draft;
    fd.set('position', f.position); fd.set('nameAr', f.nameAr.trim()); fd.set('nameEn', f.nameEn.trim());
    fd.set('jobTitleAr', f.jobTitleAr.trim()); fd.set('jobTitleEn', f.jobTitleEn.trim());
    fd.set('bioAr', f.bioAr); fd.set('bioEn', f.bioEn); fd.set('dutiesAr', f.dutiesAr); fd.set('dutiesEn', f.dutiesEn);
    fd.set('termLabel', f.termLabel.trim()); fd.set('sortOrder', String(Number(f.sortOrder) || 0)); fd.set('isActive', String(f.isActive));
    if (photo) fd.set('photo', photo);
    else if (f.id && dropPhoto) fd.set('removePhoto', 'true');
    setBusy(true);
    try {
      await api(f.id ? `/admin/board/${f.id}` : '/admin/board', { method: f.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      onSaved();
      onClose();
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={draft?.id || id ? t('board.edit') : t('board.add')} wide>
      {!draft ? <div className="flex justify-center py-10"><Spinner /></div> : (
        <form onSubmit={save} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('board.position')}>
              <select className={inputCls} value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })}>{POSITIONS.map((p) => <option key={p} value={p}>{t(`board.pos.${p}`)}</option>)}</select>
            </Field>
            <Field label={t('board.term')} hint={t('board.termHint')}><input maxLength={100} dir="ltr" className={inputCls} value={draft.termLabel} onChange={(e) => setDraft({ ...draft, termLabel: e.target.value })} /></Field>
            <Field label={t('pg.titleAr')}><input required maxLength={255} dir="rtl" className={inputCls} value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} /></Field>
            <Field label={t('pg.titleEn')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} /></Field>
            <Field label={t('board.jobTitleAr')}><input maxLength={255} dir="rtl" className={inputCls} value={draft.jobTitleAr} onChange={(e) => setDraft({ ...draft, jobTitleAr: e.target.value })} /></Field>
            <Field label={t('board.jobTitleEn')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.jobTitleEn} onChange={(e) => setDraft({ ...draft, jobTitleEn: e.target.value })} /></Field>
            <Field label={t('faq.order')}><input type="number" min={0} max={100000} className={inputCls} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />{t('faq.active')}</label>
          </div>
          <Field label={t('board.photo')} hint={t('board.photoHint')}>
            <input type="file" accept="image/jpeg,image/png,image/webp" className={inputCls} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          </Field>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {photo && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{photo.name}</span>}
            {!photo && draft.photoUrl && !dropPhoto && (
              <>
                <img src={fileUrl(draft.photoUrl)} alt="" className="h-16 w-16 rounded-full object-cover" />
                <button type="button" className="text-red-600 underline" onClick={() => setDropPhoto(true)}>{t('board.removePhoto')}</button>
              </>
            )}
            {dropPhoto && <span className="text-gray-500">{t('board.photoRemoved')}</span>}
          </div>
          <Field label={t('board.bioAr')}><RichEditor key={`ba-${draft.id ?? 'new'}`} value={draft.bioAr} onChange={(h) => setDraft((d) => (d ? { ...d, bioAr: h } : d))} dir="rtl" /></Field>
          <Field label={t('board.bioEn')} hint={t('faq.hint')}><RichEditor key={`be-${draft.id ?? 'new'}`} value={draft.bioEn} onChange={(h) => setDraft((d) => (d ? { ...d, bioEn: h } : d))} dir="ltr" /></Field>
          <Field label={t('board.dutiesAr')}><RichEditor key={`da-${draft.id ?? 'new'}`} value={draft.dutiesAr} onChange={(h) => setDraft((d) => (d ? { ...d, dutiesAr: h } : d))} dir="rtl" /></Field>
          <Field label={t('board.dutiesEn')} hint={t('faq.hint')}><RichEditor key={`de-${draft.id ?? 'new'}`} value={draft.dutiesEn} onChange={(h) => setDraft((d) => (d ? { ...d, dutiesEn: h } : d))} dir="ltr" /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
        </form>
      )}
      {draft?.id && can('board.update') && <LinkedNewsPanel base={`/admin/board/${draft.id}`} />}
    </Modal>
  );
}

/** Board members: position, names, titles, bio and duties (rich text), term, picture. The public page orders by position, then by "order". */
export function BoardAdmin() {
  const { t, href } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ row?: Row } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const yn = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const cols: Col<Row>[] = [
    { key: 'nameAr', label: t('pg.titleAr'), render: (r) => <span className="flex items-center gap-2">{r.photoUrl && <img src={fileUrl(r.photoUrl)} alt="" className="h-8 w-8 rounded-full object-cover" />}{r.nameAr}</span>, text: (r) => r.nameAr },
    { key: 'nameEn', label: t('pg.titleEn') },
    { key: 'position', searchable: false, label: t('board.position'), render: (r) => t(`board.pos.${r.position}`), text: (r) => t(`board.pos.${r.position}`) },
    { key: 'jobTitleAr', label: t('board.jobTitle') },
    { key: 'termLabel', label: t('board.term') },
    { key: 'sortOrder', searchable: false, label: t('faq.order'), render: (r) => r.sortOrder, text: (r) => String(r.sortOrder) },
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
  ];

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/board/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <RequirePerm any={['board.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.board')}</h1>
      <DataTable<Row>
        endpoint="/admin/board"
        columns={cols}
        refreshKey={key}
        exportable={false}
        filters={[{ key: 'position', label: t('board.position'), options: ['president', 'vice_president', 'secretary', 'treasurer', 'member'].map((p) => ({ value: p, label: t(`board.pos.${p}`) })) }]}
        bulkDelete={{ path: '/admin/board/bulk-delete', can: can('board.delete') }}
        toolbar={can('board.create') && <Button onClick={() => setDialog({})}>＋ {t('board.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            <Link href={href(`/board/view?id=${r.id}`)} target="_blank" className="rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50">{t('pg.view')}</Link>
            {can('board.update') && <Button size="sm" variant="outline" onClick={() => setDialog({ row: r })}>{t('app.edit')}</Button>}
            {can('board.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      {dialog && <BoardMemberDialog key={dialog.row?.id ?? 'new'} row={dialog.row} onClose={() => setDialog(null)} onSaved={() => setKey((k) => k + 1)} />}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{t('app.delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
