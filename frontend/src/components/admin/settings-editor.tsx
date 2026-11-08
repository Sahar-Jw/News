'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { categoryLabel, keyLabel } from '@/lib/setting-labels';
import { SETTING_GROUPS, groupOf, type GroupId } from '@/lib/setting-groups';
import { Button, Field, FilePicker, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

interface Row { id: number; category: string; key: string; valueType: 'text' | 'number' | 'boolean' | 'url' | 'color' | 'file' | 'json'; value: any; fileUrl?: string }

const show = (r: Row) => {
  if (r.value === null || r.value === '') return '—';
  if (r.valueType === 'json') return JSON.stringify(r.value).slice(0, 60);
  return String(r.value).slice(0, 80);
};

const MAX_FILE_BYTES = 5 * 1024 * 1024; // same limit as the API
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ICON_TYPES = ['image/x-icon', 'image/vnd.microsoft.icon'];

/**
 * The site-settings editor. Without `groups` it is the full dashboard (tiles, search, one accordion per group); with `groups` it shows
 * only the settings of those groups as plain lists (the "Settings" tab of one page in the Settings hub). Needs settings.read; editing needs settings.update.
 */
export function SettingsEditor({ groups: only }: { groups?: GroupId[] }) {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<GroupId[]>(['home']);
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

  const load = useCallback(() => {
    api<{ data: Row[] }>('/admin/settings', { params: { limit: 'all' }, cache: 'no-store' }).then((r) => { setRows(r.data); setLoadErr(''); }).catch((e) => setLoadErr(e.message));
  }, []);
  useEffect(() => { load(); }, [load, key]);
  // remember which groups the admin left open (per browser; the page works without it)
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem('settings-open') || 'null'); if (Array.isArray(v)) setOpenIds(v); } catch { /* ignore */ } }, []);
  const setOpen = (ids: GroupId[]) => { setOpenIds(ids); try { localStorage.setItem('settings-open', JSON.stringify(ids)); } catch { /* ignore */ } };
  const resetFile = () => {
    if (newFileRef.current) URL.revokeObjectURL(newFileRef.current.url);
    setNewFile(null); setRemoveSaved(false); setFileErr(''); setPickerKey((k) => k + 1);
  };
  const closeEdit = () => { resetFile(); setEdit(null); };
  const open = (r: Row) => { resetFile(); setEdit(r); setVal(r.valueType === 'json' ? (r.value ? JSON.stringify(r.value, null, 2) : '') : r.value ?? (r.valueType === 'boolean' ? false : '')); };

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

  const ar = lang === 'ar';
  const T = ar
    ? { search: 'ابحث في كل الإعدادات…', all: 'فتح الكل', none: 'طي الكل', settings: 'إعداد', filled: 'معبأ', empty: 'فارغ', noMatch: 'لا توجد إعدادات مطابقة', open: 'فتح', hint: 'اضغط على أي قسم لعرض كل إعداداته وتعديلها.', matches: 'نتيجة' }
    : { search: 'Search all settings…', all: 'Expand all', none: 'Collapse all', settings: 'settings', filled: 'filled', empty: 'empty', noMatch: 'No matching settings', open: 'Open', hint: 'Click any section to see and edit all of its settings.', matches: 'matches' };

  const needle = query.trim().toLowerCase();
  const labelOf = (r: Row) => keyLabel(r.category, r.key, lang);
  const matchRow = (r: Row) => !needle || [labelOf(r), r.key, categoryLabel(r.category, lang), typeof r.value === 'string' ? r.value : ''].some((x) => String(x).toLowerCase().includes(needle));
  const isFilled = (r: Row) => !(r.value === null || r.value === '' || r.value === undefined);

  const groups = useMemo(() => {
    const m = new Map<GroupId, Map<string, Row[]>>();
    for (const r of rows ?? []) {
      const g = groupOf(r.category);
      if (only && only.length && !only.includes(g)) continue;
      if (!m.has(g)) m.set(g, new Map());
      const cm = m.get(g)!;
      if (!cm.has(r.category)) cm.set(r.category, []);
      cm.get(r.category)!.push(r);
    }
    return SETTING_GROUPS.filter((g) => m.has(g.id)).map((g) => ({ ...g, cats: [...m.get(g.id)!.entries()].map(([category, list]) => ({ category, list })) }));
  }, [rows, only]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalMatches = needle ? (rows ?? []).filter(matchRow).length : 0;
  const toggleGroup = (id: GroupId) => setOpen(openIds.includes(id) ? openIds.filter((x) => x !== id) : [...openIds, id]);

  const valueCell = (r: Row) => {
    if (r.valueType === 'boolean') return <input type="checkbox" className="h-4 w-4" checked={r.value === true || r.value === 'true'} disabled={!can('settings.update')} onChange={(e) => toggle(r, e.target.checked)} aria-label={labelOf(r)} />;
    if (r.valueType === 'color') return r.value ? <span className="inline-flex items-center gap-2" dir="ltr"><span className="h-5 w-5 rounded border border-line" style={{ backgroundColor: String(r.value) }} /><span className="font-mono text-xs">{String(r.value)}</span></span> : <span className="text-gray-400">—</span>;
    if (r.valueType === 'file') return r.fileUrl && r.value ? <img src={fileUrl(r.fileUrl)} alt="" className="h-9 max-w-[90px] rounded border border-line bg-white object-contain p-0.5" /> : <span className="text-gray-400">—</span>;
    return <span className={`line-clamp-2 break-words ${isFilled(r) ? 'text-gray-800' : 'text-gray-400'}`} dir="auto">{show(r)}</span>;
  };

  const catBlock = (c: { category: string; list: Row[] }) => (
    <div key={c.category}>
                          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-primary"><span className="h-4 w-1 rounded-full bg-accent" />{categoryLabel(c.category, lang)}<span className="text-xs font-normal text-gray-400">({c.list.length})</span></h3>
                          <ul className="divide-y divide-line overflow-hidden rounded-xl ring-1 ring-line">
                            {c.list.map((r) => (
                              <li key={r.id} className="grid grid-cols-1 items-center gap-2 bg-white px-3 py-2 text-sm hover:bg-gray-50 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
                                <span className="min-w-0 font-medium text-gray-700">{labelOf(r)}{ar && <span dir="ltr" className="ms-2 font-mono text-[10px] text-gray-400">{r.key}</span>}</span>
                                <span className="min-w-0">{valueCell(r)}</span>
                                <span className="justify-self-end">{can('settings.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
  );

  return (
    <>
      {loadErr && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadErr}</p>}
      {!rows && !loadErr && <p className="py-10 text-center text-gray-500">{t('app.loading')}</p>}

      {rows && only && (
        <div className="space-y-6">
          {groups.flatMap((g) => g.cats).map(catBlock)}
          {groups.length === 0 && <p className="py-8 text-center text-gray-500">{T.noMatch}</p>}
        </div>
      )}

      {rows && !only && (
        <>
          {/* dashboard tiles: one per site section; click opens it */}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {groups.map((g) => {
              const all = g.cats.flatMap((c) => c.list);
              const filled = all.filter(isFilled).length;
              const on = openIds.includes(g.id);
              return (
                <button key={g.id} type="button" onClick={() => { if (!on) setOpen([...openIds, g.id]); document.getElementById(`set-${g.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className={`rounded-2xl bg-white p-3 text-start shadow-card ring-1 transition hover:-translate-y-0.5 ${on ? 'ring-primary' : 'ring-line'}`}>
                  <span className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ backgroundColor: `${g.color}22`, color: g.color }} aria-hidden="true">{g.icon}</span>
                    <span className="min-w-0 truncate text-sm font-bold text-secondary">{ar ? g.ar : g.en}</span>
                  </span>
                  <span className="mt-2 block text-xs text-gray-500">{all.length} {T.settings} · {filled} {T.filled}</span>
                  <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-gray-100"><span className="block h-full rounded-full" style={{ width: `${all.length ? Math.round((filled / all.length) * 100) : 0}%`, backgroundColor: g.color }} /></span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={T.search} className={`${inputCls} max-w-md flex-1`} aria-label={T.search} />
            {needle && <span className="text-sm text-gray-500">{totalMatches} {T.matches}</span>}
            <span className="flex-1" />
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(groups.map((g) => g.id))}>{T.all}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen([])}>{T.none}</Button>
          </div>

          <div className="space-y-3">
            {groups.map((g) => {
              const cats = g.cats.map((c) => ({ ...c, list: c.list.filter(matchRow) })).filter((c) => c.list.length);
              if (needle && !cats.length) return null;
              const isOpen = needle ? true : openIds.includes(g.id);
              const count = g.cats.reduce((n, c) => n + c.list.length, 0);
              return (
                <section key={g.id} id={`set-${g.id}`} className="scroll-mt-4 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
                  <button type="button" onClick={() => toggleGroup(g.id)} aria-expanded={isOpen} className="flex w-full items-center gap-3 p-4 text-start hover:bg-gray-50">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: `${g.color}22`, color: g.color }} aria-hidden="true">{g.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-secondary">{ar ? g.ar : g.en}</span>
                      <span className="block text-xs text-gray-500">{ar ? g.hintAr : g.hintEn}</span>
                    </span>
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">{count}</span>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  {isOpen && (
                    <div className="space-y-5 border-t border-line p-4">
                      {cats.map(catBlock)}
                    </div>
                  )}
                </section>
              );
            })}
            {needle && totalMatches === 0 && <p className="py-8 text-center text-gray-500">{T.noMatch}</p>}
          </div>
        </>
      )}
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
    </>
  );
}
