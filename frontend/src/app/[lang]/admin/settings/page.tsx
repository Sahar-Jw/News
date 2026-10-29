'use client';
import { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { categoryLabel, keyLabel } from '@/lib/setting-labels';
import { Button, Field, FilePicker, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

interface Row { id: number; category: string; key: string; valueType: 'text' | 'number' | 'boolean' | 'url' | 'color' | 'file' | 'json'; value: any; fileUrl?: string }

const show = (r: Row) => {
  if (r.value === null || r.value === '') return '—';
  if (r.valueType === 'json') return JSON.stringify(r.value).slice(0, 60);
  return String(r.value).slice(0, 80);
};

const MAX_FILE_BYTES = 5 * 1024 * 1024; // same limit as the API
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ICON_TYPES = ['image/x-icon', 'image/vnd.microsoft.icon'];

export default function SettingsPage() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [cats, setCats] = useState<{ category: string }[]>([]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [val, setVal] = useState<any>('');
  const [key, setKey] = useState(0);
  // file settings are staged: choosing / deleting changes only this dialog, nothing is sent until Save
  const [newFile, setNewFile] = useState<{ file: File; url: string } | null>(null);
  const [removeSaved, setRemoveSaved] = useState(false);
  const [fileErr, setFileErr] = useState('');
  const [pickerKey, setPickerKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const newFileRef = useRef(newFile);
  newFileRef.current = newFile;
  useEffect(() => () => { if (newFileRef.current) URL.revokeObjectURL(newFileRef.current.url); }, []);

  useEffect(() => { api<{ category: string }[]>('/admin/settings/categories').then(setCats).catch(() => {}); }, []);
  const resetFile = () => {
    if (newFileRef.current) URL.revokeObjectURL(newFileRef.current.url);
    setNewFile(null); setRemoveSaved(false); setFileErr(''); setPickerKey((k) => k + 1);
  };
  const closeEdit = () => { resetFile(); setEdit(null); };
  const open = (r: Row) => { resetFile(); setEdit(r); setVal(r.valueType === 'json' ? (r.value ? JSON.stringify(r.value, null, 2) : '') : r.value ?? (r.valueType === 'boolean' ? false : '')); };

  const cols: Col<Row>[] = [
    // Arabic labels are display-only; the per-column search box matches the stored English names, so it is off in Arabic
    { key: 'category', label: t('s.category'), exportable: false, searchable: lang !== 'ar', render: (r) => <span>{categoryLabel(r.category, lang)}</span> },
    { key: 'key', label: t('s.key'), exportable: false, searchable: lang !== 'ar', render: (r) => lang === 'ar' ? <span>{keyLabel(r.category, r.key, lang)}</span> : <span dir="ltr" className="font-mono text-xs">{r.key}</span> },
    { key: 'value', label: t('s.value'), exportable: false, render: (r) => r.valueType === 'boolean' ? <input type="checkbox" checked={r.value === true || r.value === 'true'} disabled={!can('settings.update')} onChange={(e) => toggle(r, e.target.checked)} aria-label={keyLabel(r.category, r.key, lang)} className="h-5 w-5 cursor-pointer accent-primary disabled:cursor-default" /> : r.valueType === 'color' && r.value ? <span className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border" style={{ background: r.value }} />{r.value}</span> : r.valueType === 'file' && r.fileUrl ? <img src={fileUrl(r.fileUrl)} alt="" className="h-8 w-auto" /> : <span className="line-clamp-1">{show(r)}</span> },
  ];

  const toggle = async (r: Row, checked: boolean) => {
    try { await api(`/admin/settings/${r.id}`, { method: 'PATCH', body: { value: checked } }); toast(t('app.saved')); setKey((k) => k + 1); } catch (err: any) { toast(err.message, 'err'); }
  };

  /** Checks the chosen file on the spot (type, size) so the reason is shown right here instead of a failed upload. */
  const chooseFile = (file?: File | null) => {
    if (!file || !edit) return;
    const isIcon = edit.key === 'favicon';
    const okType = IMAGE_TYPES.includes(file.type) || (isIcon && (ICON_TYPES.includes(file.type) || /\.ico$/i.test(file.name)));
    const problem = !okType ? t(isIcon ? 's.fileTypeIco' : 's.fileType') : file.size === 0 ? t('s.fileEmpty') : file.size > MAX_FILE_BYTES ? t('s.fileTooBig') : '';
    if (problem) { setFileErr(`${file.name}: ${problem}`); setPickerKey((k) => k + 1); return; }
    if (newFileRef.current) URL.revokeObjectURL(newFileRef.current.url);
    setNewFile({ file, url: URL.createObjectURL(file) });
    setRemoveSaved(false); setFileErr('');
  };

  /** Delete next to the file: drops the new (unsaved) file first, otherwise marks the saved file for deletion. */
  const deleteFile = () => {
    setFileErr('');
    if (newFile) { URL.revokeObjectURL(newFile.url); setNewFile(null); setPickerKey((k) => k + 1); }
    else setRemoveSaved(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit || busy) return;
    setBusy(true);
    try {
      if (edit.valueType === 'file') {
        if (newFile) {
          const fd = new FormData(); fd.set('file', newFile.file);
          await api<Row>(`/admin/settings/${edit.id}/file`, { method: 'POST', form: fd });
        } else if (removeSaved) {
          await api(`/admin/settings/${edit.id}`, { method: 'PATCH', body: { value: null } });
        }
      } else {
        let value: any = val;
        if (edit.valueType === 'json') value = val.trim() ? JSON.parse(val) : null; // the server re-validates by type
        await api(`/admin/settings/${edit.id}`, { method: 'PATCH', body: { value } });
      }
      toast(t('app.saved')); closeEdit(); setKey((k) => k + 1);
    } catch (err: any) {
      const msg = err instanceof SyntaxError ? 'JSON' : err.message;
      if (edit.valueType === 'file') setFileErr(msg); // stays visible inside the dialog, next to the file
      toast(msg, 'err');
    } finally { setBusy(false); }
  };

  return (
    <RequirePerm any={['settings.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.settings')}</h1>
      <DataTable<Row>
        endpoint="/admin/settings" columns={cols} refreshKey={key} exportable={false}
        filters={[{ key: 'category', label: t('s.category'), options: cats.map((c) => ({ value: c.category, label: categoryLabel(c.category, lang) })) }]}
        rowActions={(r) => can('settings.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
      />
      <Modal open={!!edit} onClose={closeEdit} title={edit ? (lang === 'ar' ? `${categoryLabel(edit.category, lang)} — ${keyLabel(edit.category, edit.key, lang)}` : `${edit.category}.${edit.key}`) : ''}>
        {edit && (
          <form onSubmit={save} className="space-y-3">
            {edit.valueType === 'boolean' ? (
              <label className="flex items-center gap-2"><input type="checkbox" checked={val === true || val === 'true'} onChange={(e) => setVal(e.target.checked)} />{keyLabel(edit.category, edit.key, lang)}</label>
            ) : edit.valueType === 'color' ? (
              <div className="flex gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(val) ? val : '#000000'} onChange={(e) => setVal(e.target.value)} className="h-10 w-14" /><input dir="ltr" className={inputCls} value={val ?? ''} onChange={(e) => setVal(e.target.value)} placeholder="#0b5ed7" /></div>
            ) : edit.valueType === 'file' ? (
              <div className="space-y-3">
                {/* the file, with Delete right next to it */}
                <div className="flex items-center gap-3 rounded-xl border border-line bg-gray-50 p-3">
                  <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-1">
                    {newFile ? <img src={newFile.url} alt="" className="max-h-full max-w-full object-contain" />
                      : edit.fileUrl && !removeSaved ? <img src={fileUrl(edit.fileUrl)} alt={t('s.currentFile')} className="max-h-full max-w-full object-contain" />
                      : <span className="text-xs text-gray-400">{t('s.noFile')}</span>}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="truncate text-sm font-medium text-gray-800" dir="auto">{newFile ? newFile.file.name : t('s.currentFile')}</div>
                    {newFile && <div className="text-xs text-primary">{t('s.newFile')}</div>}
                    {removeSaved && <div className="text-xs text-red-600">{t('s.removedNote')}</div>}
                  </div>
                  {(newFile || (edit.value && !removeSaved)) && <Button type="button" size="sm" variant="danger" disabled={busy} onClick={deleteFile}>{t('app.delete')}</Button>}
                </div>
                <FilePicker key={pickerKey} label={t('s.upload')} hint={t('s.imageHint')} accept={edit.key === 'favicon' ? 'image/png,image/jpeg,image/webp,image/gif,.ico' : 'image/png,image/jpeg,image/webp,image/gif'} onChange={(files) => chooseFile(files?.[0])} />
                {fileErr && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fileErr}</p>}
              </div>
            ) : edit.valueType === 'json' || edit.valueType === 'text' ? (
              <textarea rows={edit.valueType === 'json' ? 10 : 4} dir={edit.valueType === 'json' ? 'ltr' : undefined} className={`${inputCls} ${edit.valueType === 'json' ? 'font-mono text-xs' : ''}`} value={val ?? ''} onChange={(e) => setVal(e.target.value)} />
            ) : (
              <input type={edit.valueType === 'number' ? 'number' : 'url'} step="any" dir="ltr" className={inputCls} value={val ?? ''} onChange={(e) => setVal(e.target.value)} />
            )}
            {edit.valueType === 'json' && edit.category === 'pages' && <p className="text-xs text-gray-500">{`{"title": "...", "body": "..."}`}</p>}
            <p className="text-xs text-gray-500">{t('s.hidden')}</p>
            {/* Save + Cancel at the bottom, for every kind of setting */}
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button type="button" variant="outline" disabled={busy} onClick={closeEdit}>{t('app.cancel')}</Button>
              <Button disabled={busy}>{busy ? t('app.loading') : t('app.save')}</Button>
            </div>
          </form>
        )}
      </Modal>
    </RequirePerm>
  );
}
