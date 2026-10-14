'use client';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

interface Row { id: number; category: string; key: string; valueType: 'text' | 'number' | 'boolean' | 'url' | 'color' | 'file' | 'json'; value: any; fileUrl?: string }

const show = (r: Row) => {
  if (r.value === null || r.value === '') return '—';
  if (r.valueType === 'json') return JSON.stringify(r.value).slice(0, 60);
  return String(r.value).slice(0, 80);
};

export default function SettingsPage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [cats, setCats] = useState<{ category: string }[]>([]);
  const [edit, setEdit] = useState<Row | null>(null);
  const [val, setVal] = useState<any>('');
  const [key, setKey] = useState(0);

  useEffect(() => { api<{ category: string }[]>('/admin/settings/categories').then(setCats).catch(() => {}); }, []);
  const open = (r: Row) => { setEdit(r); setVal(r.valueType === 'json' ? (r.value ? JSON.stringify(r.value, null, 2) : '') : r.value ?? (r.valueType === 'boolean' ? false : '')); };

  const cols: Col<Row>[] = [
    { key: 'category', label: t('s.category'), exportable: false },
    { key: 'key', label: t('s.key'), exportable: false, render: (r) => <span dir="ltr" className="font-mono text-xs">{r.key}</span> },
    { key: 'valueType', label: t('s.type'), exportable: false },
    { key: 'value', label: t('s.value'), exportable: false, render: (r) => r.valueType === 'color' && r.value ? <span className="flex items-center gap-2"><span className="inline-block h-4 w-4 rounded border" style={{ background: r.value }} />{r.value}</span> : r.valueType === 'file' && r.fileUrl ? <img src={fileUrl(r.fileUrl)} alt="" className="h-8 w-auto" /> : <span className="line-clamp-1">{show(r)}</span> },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    try {
      let value: any = val;
      if (edit.valueType === 'json') value = val.trim() ? JSON.parse(val) : null; // the server re-validates by type
      await api(`/admin/settings/${edit.id}`, { method: 'PATCH', body: { value } });
      toast(t('app.saved')); setEdit(null); setKey((k) => k + 1);
    } catch (err: any) { toast(err instanceof SyntaxError ? 'JSON' : err.message, 'err'); }
  };
  const upload = async (file?: File | null) => {
    if (!file || !edit) return;
    const fd = new FormData(); fd.set('file', file);
    try { const r = await api<Row>(`/admin/settings/${edit.id}/file`, { method: 'POST', form: fd }); setEdit(r); setKey((k) => k + 1); toast(t('app.saved')); } catch (e: any) { toast(e.message, 'err'); }
  };

  return (
    <RequirePerm any={['settings.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.settings')}</h1>
      <DataTable<Row>
        endpoint="/admin/settings" columns={cols} refreshKey={key} exportable={false}
        filters={[{ key: 'category', label: t('s.category'), options: cats.map((c) => ({ value: c.category, label: c.category })) }]}
        rowActions={(r) => can('settings.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit ? `${edit.category}.${edit.key}` : ''}>
        {edit && (
          <form onSubmit={save} className="space-y-3">
            {edit.valueType === 'boolean' ? (
              <label className="flex items-center gap-2"><input type="checkbox" checked={val === true || val === 'true'} onChange={(e) => setVal(e.target.checked)} />{edit.key}</label>
            ) : edit.valueType === 'color' ? (
              <div className="flex gap-2"><input type="color" value={/^#[0-9a-f]{6}$/i.test(val) ? val : '#000000'} onChange={(e) => setVal(e.target.value)} className="h-10 w-14" /><input dir="ltr" className={inputCls} value={val ?? ''} onChange={(e) => setVal(e.target.value)} placeholder="#0b5ed7" /></div>
            ) : edit.valueType === 'file' ? (
              <div className="space-y-2">
                {edit.fileUrl && <img src={fileUrl(edit.fileUrl)} alt="" className="max-h-32 rounded border" />}
                <Field label={t('s.upload')}><input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} /></Field>
              </div>
            ) : edit.valueType === 'json' || edit.valueType === 'text' ? (
              <textarea rows={edit.valueType === 'json' ? 10 : 4} dir={edit.valueType === 'json' ? 'ltr' : undefined} className={`${inputCls} ${edit.valueType === 'json' ? 'font-mono text-xs' : ''}`} value={val ?? ''} onChange={(e) => setVal(e.target.value)} />
            ) : (
              <input type={edit.valueType === 'number' ? 'number' : 'url'} step="any" dir="ltr" className={inputCls} value={val ?? ''} onChange={(e) => setVal(e.target.value)} />
            )}
            {edit.valueType === 'json' && edit.category === 'pages' && <p className="text-xs text-gray-500">{`{"title": "...", "body": "..."}`}</p>}
            <p className="text-xs text-gray-500">{t('s.hidden')}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEdit(null)}>{t('app.close')}</Button>
              {edit.valueType !== 'file' && <Button>{t('app.save')}</Button>}
              {edit.valueType === 'file' && edit.value && <Button type="button" variant="danger" onClick={async () => { try { await api(`/admin/settings/${edit.id}`, { method: 'PATCH', body: { value: null } }); setEdit(null); setKey((k) => k + 1); } catch (e: any) { toast(e.message, 'err'); } }}>{t('app.delete')}</Button>}
            </div>
          </form>
        )}
      </Modal>
    </RequirePerm>
  );
}
