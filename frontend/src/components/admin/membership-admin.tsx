'use client';
import { useEffect, useState } from 'react';
import { api, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Center, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { RichEditor } from '@/components/admin/rich-editor';

const STATUSES = ['new', 'in_review', 'accepted', 'rejected'];
const COLOR: Record<string, string> = { new: 'bg-blue-100 text-blue-700', in_review: 'bg-amber-100 text-amber-700', accepted: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700' };

interface FileRow { id: number; name: string; size: number; path: string }
interface App { id: number; reference: string; companyName: string; activity: string; managerName: string; phone: string; email: string; address: string | null; message: string | null; status: string; staffNotes: string | null; createdAt: string; files?: FileRow[] }
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Applications() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [sel, setSel] = useState<App | null>(null);
  const [status, setStatus] = useState('new');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);

  const cols: Col<App>[] = [
    { key: 'reference', searchable: false, label: '#', render: (r) => <span dir="ltr">{r.reference}</span>, text: (r) => r.reference },
    { key: 'companyName', label: t('mb.company') },
    { key: 'activity', label: t('mb.activity') },
    { key: 'managerName', label: t('mb.manager') },
    { key: 'phone', label: t('mb.phone') },
    { key: 'status', searchable: false, label: t('mb.adm.status'), render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${COLOR[r.status] ?? ''}`}>{t(`mb.status.${r.status}`)}</span>, text: (r) => t(`mb.status.${r.status}`) },
    { key: 'createdAt', type: 'date', label: t('mb.adm.date'), render: (r) => fmtDate('ar', r.createdAt), text: (r) => r.createdAt },
  ];

  const open = async (r: App) => {
    try { const full = await api<App>(`/admin/membership/applications/${r.id}`); setSel(full); setStatus(full.status); setNotes(full.staffNotes ?? ''); } catch (e: any) { toast(e.message, 'err'); }
  };
  const save = async () => {
    if (!sel) return;
    setBusy(true);
    try { await api(`/admin/membership/applications/${sel.id}`, { method: 'PATCH', body: { status, staffNotes: notes } }); toast(t('app.saved')); setSel(null); setKey((k) => k + 1); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const getFile = async (f: FileRow) => { try { await download(`/files/${f.path}`, {}, f.name); } catch (e: any) { toast(e.message, 'err'); } };

  return (
    <>
      <DataTable<App>
        endpoint="/admin/membership/applications" columns={cols} dateFilter refreshKey={key} exportable={can('membership.export')} exportName="membership-applications"
        filters={[{ key: 'status', label: t('mb.adm.status'), options: STATUSES.map((s) => ({ value: s, label: t(`mb.status.${s}`) })) }]}
        bulkDelete={{ path: '/admin/membership/applications/bulk-delete', can: can('membership.delete') }}
        rowActions={(r) => <Button size="sm" variant="outline" onClick={() => open(r)}>{t('mb.adm.open')}</Button>}
      />
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.reference} — ${sel.companyName}` : ''} wide>
        {sel && (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {([[t('mb.company'), sel.companyName], [t('mb.activity'), sel.activity], [t('mb.manager'), sel.managerName], [t('mb.phone'), sel.phone], [t('contact.email'), sel.email], [t('mb.address'), sel.address]] as [string, string | null][]).map(([k, val]) => <div key={k}><dt className="text-xs text-gray-500">{k}</dt><dd className="font-semibold">{val || '—'}</dd></div>)}
            </dl>
            {sel.message && <div className="rounded-xl bg-canvas p-3 text-sm"><p className="mb-1 text-xs text-gray-500">{t('mb.message')}</p><p className="whitespace-pre-wrap">{sel.message}</p></div>}
            <div>
              <h3 className="mb-2 text-sm font-bold">{t('mb.adm.files')}</h3>
              {(sel.files ?? []).length === 0 ? <p className="text-sm text-gray-500">{t('mb.adm.noFiles')}</p> : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {sel.files!.map((f) => <li key={f.id} className="flex items-center gap-3 p-2.5 text-sm"><span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-gray-500">{kb(f.size)}</span><Button size="sm" variant="outline" onClick={() => getFile(f)}>{t('mb.adm.download')}</Button></li>)}
                </ul>
              )}
            </div>
            {can('membership.update') && (
              <>
                <Field label={t('mb.adm.status')} hint={t('mb.adm.statusHint')}><select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{t(`mb.status.${s}`)}</option>)}</select></Field>
                <Field label={t('mb.adm.notes')} hint={t('mb.adm.notesHint')}><textarea rows={3} maxLength={5000} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSel(null)}>{t('app.cancel')}</Button><Button disabled={busy} onClick={save}>{t('app.save')}</Button></div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

type S = Record<'conditionsAr' | 'conditionsEn' | 'documentsAr' | 'documentsEn' | 'feesAr' | 'feesEn' | 'stepsAr' | 'stepsEn' | 'notifyEmail', string> & { isOpen: boolean };
const KEYS = ['conditionsAr', 'conditionsEn', 'documentsAr', 'documentsEn', 'feesAr', 'feesEn', 'stepsAr', 'stepsEn', 'notifyEmail'] as const;

function Content() {
  const { t } = useI18n();
  const toast = useToast();
  const { can } = useAuth();
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Record<string, any>>('/admin/membership/settings').then((r) => setS({ ...(Object.fromEntries(KEYS.map((k) => [k, r[k] ?? ''])) as Record<(typeof KEYS)[number], string>), isOpen: !!r.isOpen })).catch((e) => toast(e.message, 'err'));
  }, [toast]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    try { await api('/admin/membership/settings', { method: 'PATCH', body: s }); toast(t('app.saved')); } catch (err: any) { toast(err.message, 'err'); } finally { setBusy(false); }
  };
  if (!s) return <Center><Spinner /></Center>;
  const rich = (k: 'conditions' | 'documents' | 'fees', label: string) => (
    <div className="grid gap-3 lg:grid-cols-2">
      <Field label={`${label} — ${t('mb.adm.ar')}`}><RichEditor key={`${k}Ar`} value={s[`${k}Ar`]} onChange={(h) => setS((x) => (x ? { ...x, [`${k}Ar`]: h } : x))} dir="rtl" /></Field>
      <Field label={`${label} — ${t('mb.adm.en')}`}><RichEditor key={`${k}En`} value={s[`${k}En`]} onChange={(h) => setS((x) => (x ? { ...x, [`${k}En`]: h } : x))} dir="ltr" /></Field>
    </div>
  );
  return (
    <form onSubmit={save} className="space-y-5">
      {rich('conditions', t('mb.conditions'))}{rich('documents', t('mb.documents'))}{rich('fees', t('mb.fees'))}
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label={`${t('mb.steps')} — ${t('mb.adm.ar')}`} hint={t('mb.adm.stepsHint')}><textarea rows={6} maxLength={3000} dir="rtl" className={inputCls} value={s.stepsAr} onChange={(e) => setS({ ...s, stepsAr: e.target.value })} /></Field>
        <Field label={`${t('mb.steps')} — ${t('mb.adm.en')}`} hint={t('mb.adm.stepsHint')}><textarea rows={6} maxLength={3000} dir="ltr" className={inputCls} value={s.stepsEn} onChange={(e) => setS({ ...s, stepsEn: e.target.value })} /></Field>
        <Field label={t('mb.adm.notifyEmail')} hint={t('mb.adm.notifyHint')}><input type="email" maxLength={190} dir="ltr" className={inputCls} value={s.notifyEmail} onChange={(e) => setS({ ...s, notifyEmail: e.target.value })} /></Field>
        <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={s.isOpen} onChange={(e) => setS({ ...s, isOpen: e.target.checked })} />{t('mb.adm.open2')}</label>
      </div>
      {can('membership.update') && <Button disabled={busy}>{t('app.save')}</Button>}
    </form>
  );
}

/** Membership admin: the applications inbox (statuses, documents, e-mails, export) and the texts of the public page. */
export function MembershipAdmin() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'apps' | 'content'>('apps');
  const btn = (k: typeof tab, label: string) => <button key={k} onClick={() => setTab(k)} className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === k ? 'bg-secondary text-white' : 'bg-primary/10 text-ink/80 hover:bg-primary/20'}`}>{label}</button>;
  return (
    <RequirePerm any={['membership.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.membership')}</h1>
      <div className="mb-4 flex flex-wrap gap-2">{btn('apps', t('mb.adm.apps'))}{btn('content', t('mb.adm.content'))}</div>
      {tab === 'apps' ? <Applications /> : <Content />}
    </RequirePerm>
  );
}
