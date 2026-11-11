'use client';
import { useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

export interface DocRow { id: number; kind: string; subtype: string | null; docNumber: string; titleAr: string; titleEn: string; summaryAr: string; summaryEn: string; issuerAr: string; issuerEn: string; docDate: string | null; fileUrl: string | null; isActive: boolean }
export interface Draft { id?: number; kind: string; subtype: string; docNumber: string; titleAr: string; titleEn: string; summaryAr: string; summaryEn: string; issuerAr: string; issuerEn: string; docDate: string; isActive: boolean; fileUrl: string | null }
export const KINDS = ['circular', 'decision', 'law', 'guide', 'study', 'report', 'bulletin', 'form', 'historical', 'press', 'mediakit', 'library'];
export const SUBTYPES: Record<string, string[]> = { decision: ['government', 'economic', 'members'], law: ['law', 'instruction', 'regulation'] };
export const EMPTY_DRAFT: Draft = { kind: 'circular', subtype: '', docNumber: '', titleAr: '', titleEn: '', summaryAr: '', summaryEn: '', issuerAr: '', issuerEn: '', docDate: '', isActive: true, fileUrl: null };


/** Add / edit one document (decision, circular, library file ...). Used by the Settings table and by the public pages' manage bars.
 *  Each record needs one PDF (up to 25 MB); on edit the PDF is replaced only when a new one is chosen. `lockKind` hides the kind choice. */
export function DocumentDialog({ draft, lockKind, onClose, onSaved }: { draft: Draft; lockKind?: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [d, setD] = useState<Draft>(draft);
  const [pdf, setPdf] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) return toast(t('doc.pdfOnly'), 'err');
    if (f.size > 25 * 1024 * 1024) return toast('PDF ≤ 25MB', 'err');
    setPdf(f);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d) return;
    if (!d.id && !pdf) return toast(t('doc.pdfRequired'), 'err');
    const fd = new FormData();
    fd.set('kind', d.kind); fd.set('subtype', SUBTYPES[d.kind] ? d.subtype : ''); fd.set('docNumber', d.docNumber.trim()); fd.set('titleAr', d.titleAr.trim()); fd.set('titleEn', d.titleEn.trim());
    fd.set('summaryAr', d.summaryAr.trim()); fd.set('summaryEn', d.summaryEn.trim()); fd.set('issuerAr', d.issuerAr.trim()); fd.set('issuerEn', d.issuerEn.trim()); fd.set('docDate', d.docDate); fd.set('isActive', String(d.isActive));
    if (pdf) fd.set('file', pdf);
    setBusy(true);
    try {
      await api(d.id ? `/admin/documents/${d.id}` : '/admin/documents', { method: d.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      onClose();
      onSaved();
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={d.id ? t('doc.edit') : t('doc.add')} wide>
        {(
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {!lockKind && <Field label={t('doc.kind')}>
                <select className={inputCls} value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value, subtype: '' })}>{KINDS.map((k) => <option key={k} value={k}>{t(`doc.kind.${k}`)}</option>)}</select>
              </Field>}
              {SUBTYPES[d.kind] && <Field label={t('doc.subtype')}>
                <select className={inputCls} value={d.subtype} onChange={(e) => setD({ ...d, subtype: e.target.value })}>
                  <option value="">{d.kind === 'law' ? t('doc.sub.law') : '—'}</option>
                  {SUBTYPES[d.kind].filter((x) => !(d.kind === 'law' && x === 'law')).map((x) => <option key={x} value={x}>{t(`doc.sub.${x}`)}</option>)}
                </select>
              </Field>}
              <Field label={t('doc.number')}><input maxLength={50} dir="ltr" className={inputCls} value={d.docNumber} onChange={(e) => setD({ ...d, docNumber: e.target.value })} /></Field>
              <Field label={t('pg.titleAr')}><input required maxLength={255} dir="rtl" className={inputCls} value={d.titleAr} onChange={(e) => setD({ ...d, titleAr: e.target.value })} /></Field>
              <Field label={t('pg.titleEn')}><input maxLength={255} dir="ltr" className={inputCls} value={d.titleEn} onChange={(e) => setD({ ...d, titleEn: e.target.value })} /></Field>
              <Field label={t('doc.issuerAr')}><input maxLength={150} dir="rtl" className={inputCls} value={d.issuerAr} onChange={(e) => setD({ ...d, issuerAr: e.target.value })} /></Field>
              <Field label={t('doc.issuerEn')}><input maxLength={150} dir="ltr" className={inputCls} value={d.issuerEn} onChange={(e) => setD({ ...d, issuerEn: e.target.value })} /></Field>
              <Field label={t('doc.date')}><input type="date" className={inputCls} value={d.docDate} onChange={(e) => setD({ ...d, docDate: e.target.value })} /></Field>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={d.isActive} onChange={(e) => setD({ ...d, isActive: e.target.checked })} />{t('faq.active')}</label>
              <Field label={t('doc.summaryAr')}><textarea rows={3} maxLength={5000} dir="rtl" className={inputCls} value={d.summaryAr} onChange={(e) => setD({ ...d, summaryAr: e.target.value })} /></Field>
              <Field label={t('doc.summaryEn')} hint={t('faq.hint')}><textarea rows={3} maxLength={5000} dir="ltr" className={inputCls} value={d.summaryEn} onChange={(e) => setD({ ...d, summaryEn: e.target.value })} /></Field>
            </div>
            <Field label={t('doc.file')} hint={d.id ? t('doc.fileKeep') : t('doc.fileHint')}>
              <input type="file" accept="application/pdf,.pdf" className={inputCls} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
            </Field>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {pdf && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{pdf.name}</span>}
              {!pdf && d.fileUrl && <a href={fileUrl(d.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-primary underline">{t('doc.current')}</a>}
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onClose()}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
          </form>
        )}
    </Modal>
  );
}

export const toDraft = (r: DocRow): Draft => ({ id: r.id, kind: r.kind, subtype: r.subtype ?? '', docNumber: r.docNumber, titleAr: r.titleAr, titleEn: r.titleEn, summaryAr: r.summaryAr, summaryEn: r.summaryEn, issuerAr: r.issuerAr, issuerEn: r.issuerEn, docDate: r.docDate ?? '', isActive: r.isActive, fileUrl: r.fileUrl });
