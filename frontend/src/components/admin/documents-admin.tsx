'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

interface Row { id: number; kind: string; docNumber: string; titleAr: string; titleEn: string; summaryAr: string; summaryEn: string; issuerAr: string; issuerEn: string; docDate: string | null; fileUrl: string | null; isActive: boolean }
interface Draft { id?: number; kind: string; docNumber: string; titleAr: string; titleEn: string; summaryAr: string; summaryEn: string; issuerAr: string; issuerEn: string; docDate: string; isActive: boolean; fileUrl: string | null }
const KINDS = ['circular', 'decision', 'law', 'guide', 'study', 'report', 'bulletin', 'form', 'historical', 'press', 'mediakit', 'library'];
const EMPTY: Draft = { kind: 'circular', docNumber: '', titleAr: '', titleEn: '', summaryAr: '', summaryEn: '', issuerAr: '', issuerEn: '', docDate: '', isActive: true, fileUrl: null };

/** Decisions, circulars and library files. Each record needs one PDF (up to 25 MB); on edit the PDF is replaced only when a new one is chosen. */
export function DocumentsAdmin({ kind }: { kind?: 'library' } = {}) {
  const { t, href } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const open = (r?: Row) => {
    setPdf(null);
    setDraft(r
      ? { id: r.id, kind: r.kind, docNumber: r.docNumber, titleAr: r.titleAr, titleEn: r.titleEn, summaryAr: r.summaryAr, summaryEn: r.summaryEn, issuerAr: r.issuerAr, issuerEn: r.issuerEn, docDate: r.docDate ?? '', isActive: r.isActive, fileUrl: r.fileUrl }
      : { ...EMPTY, ...(kind ? { kind } : {}) });
  };

  const yn = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const cols: Col<Row>[] = [
    { key: 'titleAr', label: t('pg.titleAr') },
    { key: 'titleEn', label: t('pg.titleEn') },
    { key: 'docNumber', label: t('doc.number'), render: (r) => <bdi dir="ltr">{r.docNumber}</bdi> },
    { key: 'kind', searchable: false, label: t('doc.kind'), render: (r) => t(`doc.kind.${r.kind}`), text: (r) => t(`doc.kind.${r.kind}`) },
    { key: 'issuerAr', searchable: false, label: t('doc.issuer'), render: (r) => r.issuerAr, text: (r) => r.issuerAr },
    { key: 'docDate', searchable: false, label: t('doc.date'), render: (r) => r.docDate ?? '', text: (r) => r.docDate ?? '' },
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
  ];

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) return toast(t('doc.pdfOnly'), 'err');
    if (f.size > 25 * 1024 * 1024) return toast('PDF ≤ 25MB', 'err');
    setPdf(f);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (!draft.id && !pdf) return toast(t('doc.pdfRequired'), 'err');
    const fd = new FormData();
    fd.set('kind', draft.kind); fd.set('docNumber', draft.docNumber.trim()); fd.set('titleAr', draft.titleAr.trim()); fd.set('titleEn', draft.titleEn.trim());
    fd.set('summaryAr', draft.summaryAr.trim()); fd.set('summaryEn', draft.summaryEn.trim()); fd.set('issuerAr', draft.issuerAr.trim()); fd.set('issuerEn', draft.issuerEn.trim()); fd.set('docDate', draft.docDate); fd.set('isActive', String(draft.isActive));
    if (pdf) fd.set('file', pdf);
    setBusy(true);
    try {
      await api(draft.id ? `/admin/documents/${draft.id}` : '/admin/documents', { method: draft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      setDraft(null);
      setKey((k) => k + 1);
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/documents/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <RequirePerm any={['documents.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t(kind ? 'adm.library' : 'adm.documents')}</h1>
      <DataTable<Row>
        endpoint="/admin/documents"
        baseParams={kind ? { kind } : undefined}
        columns={cols}
        refreshKey={key}
        exportable={false}
        bulkDelete={{ path: '/admin/documents/bulk-delete', can: can('documents.delete') }}
        toolbar={can('documents.create') && <Button onClick={() => open()}>＋ {t('doc.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            <Link href={href(`/documents/view?id=${r.id}`)} target="_blank" className="rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50">{t('pg.view')}</Link>
            {can('documents.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('documents.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('doc.edit') : t('doc.add')} wide>
        {draft && (
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {!kind && <Field label={t('doc.kind')}>
                <select className={inputCls} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{t(`doc.kind.${k}`)}</option>)}</select>
              </Field>}
              <Field label={t('doc.number')}><input maxLength={50} dir="ltr" className={inputCls} value={draft.docNumber} onChange={(e) => setDraft({ ...draft, docNumber: e.target.value })} /></Field>
              <Field label={t('pg.titleAr')}><input required maxLength={255} dir="rtl" className={inputCls} value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} /></Field>
              <Field label={t('pg.titleEn')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} /></Field>
              <Field label={t('doc.issuerAr')}><input maxLength={150} dir="rtl" className={inputCls} value={draft.issuerAr} onChange={(e) => setDraft({ ...draft, issuerAr: e.target.value })} /></Field>
              <Field label={t('doc.issuerEn')}><input maxLength={150} dir="ltr" className={inputCls} value={draft.issuerEn} onChange={(e) => setDraft({ ...draft, issuerEn: e.target.value })} /></Field>
              <Field label={t('doc.date')}><input type="date" className={inputCls} value={draft.docDate} onChange={(e) => setDraft({ ...draft, docDate: e.target.value })} /></Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />{t('faq.active')}</label>
              <Field label={t('doc.summaryAr')}><textarea rows={3} maxLength={5000} dir="rtl" className={inputCls} value={draft.summaryAr} onChange={(e) => setDraft({ ...draft, summaryAr: e.target.value })} /></Field>
              <Field label={t('doc.summaryEn')} hint={t('faq.hint')}><textarea rows={3} maxLength={5000} dir="ltr" className={inputCls} value={draft.summaryEn} onChange={(e) => setDraft({ ...draft, summaryEn: e.target.value })} /></Field>
            </div>
            <Field label={t('doc.file')} hint={draft.id ? t('doc.fileKeep') : t('doc.fileHint')}>
              <input type="file" accept="application/pdf,.pdf" className={inputCls} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            </Field>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {pdf && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{pdf.name}</span>}
              {!pdf && draft.fileUrl && <a href={fileUrl(draft.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-primary underline">{t('doc.current')}</a>}
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
