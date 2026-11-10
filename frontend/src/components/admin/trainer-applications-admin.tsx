'use client';
import { useState } from 'react';
import { api, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

const STATUSES = ['new', 'in_review', 'accepted', 'rejected'];
const COLOR: Record<string, string> = { new: 'bg-blue-100 text-blue-700', in_review: 'bg-amber-100 text-amber-700', accepted: 'bg-emerald-100 text-emerald-700', rejected: 'bg-red-100 text-red-700' };

interface FileRow { name: string; size?: number; url: string }
interface App {
  id: number; reference: string; fullName: string; phone: string; email: string; specializations: string; trainingFields: string; qualification: string; experience: string; programs: string; bio: string;
  status: string; staffNotes: string; certificateCount: number; createdAt: string; cv?: FileRow; certificates?: FileRow[];
}
const kb = (n?: number) => (n == null ? '' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Requests to become a trainer, sent through the public form: read the answers, download the CV and certificates, set the status, export. */
export function TrainerApplicationsAdmin() {
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
    { key: 'fullName', label: t('tr.fullName') },
    { key: 'phone', label: t('site.phone') },
    { key: 'email', label: t('contact.email') },
    { key: 'specializations', label: t('tr.ta.specializations'), render: (r) => <span className="line-clamp-2 max-w-xs whitespace-pre-line">{r.specializations}</span>, text: (r) => r.specializations },
    { key: 'status', searchable: false, label: t('tr.ta.adm.status'), render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${COLOR[r.status] ?? ''}`}>{t(`tr.ta.status.${r.status}`)}</span>, text: (r) => t(`tr.ta.status.${r.status}`) },
    { key: 'createdAt', type: 'date', label: t('tr.ta.adm.date'), render: (r) => fmtDate('ar', r.createdAt), text: (r) => r.createdAt },
  ];

  const open = async (r: App) => {
    try { const full = await api<App>(`/admin/trainer-applications/${r.id}`); setSel(full); setStatus(full.status); setNotes(full.staffNotes ?? ''); } catch (e: any) { toast(e.message, 'err'); }
  };
  const save = async () => {
    if (!sel) return;
    setBusy(true);
    try { await api(`/admin/trainer-applications/${sel.id}`, { method: 'PATCH', body: { status, staffNotes: notes } }); toast(t('app.saved')); setSel(null); setKey((k) => k + 1); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  // the file URL is /api/files/...; download() prefixes the API URL itself
  const getFile = async (f: FileRow) => { try { await download(f.url.replace(/^\/api/, ''), {}, f.name); } catch (e: any) { toast(e.message, 'err'); } };

  const text = (label: string, v: string) => <div key={label} className="rounded-xl bg-canvas p-3 text-sm"><p className="mb-1 text-xs text-gray-500">{label}</p><p className="whitespace-pre-wrap">{v || '—'}</p></div>;

  return (
    <RequirePerm any={['registrations.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.trainerApps')}</h1>
      <DataTable<App>
        endpoint="/admin/trainer-applications" columns={cols} dateFilter refreshKey={key} exportable={can('registrations.export')} exportName="trainer-applications"
        filters={[{ key: 'status', label: t('tr.ta.adm.status'), options: STATUSES.map((s) => ({ value: s, label: t(`tr.ta.status.${s}`) })) }]}
        bulkDelete={{ path: '/admin/trainer-applications/bulk-delete', can: can('registrations.delete') }}
        rowActions={(r) => <Button size="sm" variant="outline" onClick={() => open(r)}>{t('tr.ta.adm.open')}</Button>}
      />
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.reference} — ${sel.fullName}` : ''} wide>
        {sel && (
          <div className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              {([[t('site.phone'), sel.phone], [t('contact.email'), sel.email], [t('tr.reg.qualification'), sel.qualification]] as [string, string][]).map(([k, val]) => <div key={k}><dt className="text-xs text-gray-500">{k}</dt><dd className="font-semibold" dir={k === t('tr.reg.qualification') ? undefined : 'ltr'}>{val || '—'}</dd></div>)}
            </dl>
            {text(t('tr.ta.specializations'), sel.specializations)}
            {text(t('tr.ta.fields'), sel.trainingFields)}
            {text(t('tr.ta.experience'), sel.experience)}
            {text(t('tr.ta.programs'), sel.programs)}
            {text(t('tr.ta.bio'), sel.bio)}
            <div>
              <h3 className="mb-2 text-sm font-bold">{t('tr.ta.adm.files')}</h3>
              {!sel.cv && (sel.certificates ?? []).length === 0 ? <p className="text-sm text-gray-500">{t('tr.ta.adm.noFiles')}</p> : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {sel.cv && <li className="flex items-center gap-3 p-2.5 text-sm"><span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{t('tr.ta.cv')}</span><span className="min-w-0 flex-1 truncate">{sel.cv.name}</span><Button size="sm" variant="outline" onClick={() => getFile(sel.cv!)}>{t('tr.ta.adm.download')}</Button></li>}
                  {(sel.certificates ?? []).map((f, i) => <li key={i} className="flex items-center gap-3 p-2.5 text-sm"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">{t('tr.ta.adm.certs')}</span><span className="min-w-0 flex-1 truncate">{f.name}</span><span className="text-xs text-gray-500">{kb(f.size)}</span><Button size="sm" variant="outline" onClick={() => getFile(f)}>{t('tr.ta.adm.download')}</Button></li>)}
                </ul>
              )}
            </div>
            {can('courses.update') && (
              <>
                <Field label={t('tr.ta.adm.status')}><select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{t(`tr.ta.status.${s}`)}</option>)}</select></Field>
                <Field label={t('tr.ta.adm.notes')} hint={t('tr.ta.adm.notesHint')}><textarea rows={3} maxLength={3000} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSel(null)}>{t('app.cancel')}</Button><Button disabled={busy} onClick={save}>{t('app.save')}</Button></div>
              </>
            )}
          </div>
        )}
      </Modal>
    </RequirePerm>
  );
}
