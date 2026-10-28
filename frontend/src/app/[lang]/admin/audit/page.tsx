'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { Button, Modal } from '@/components/ui/ui';

interface Change { table: string; id: number | string | null; op: 'insert' | 'update' | 'remove'; before?: Record<string, unknown>; after?: Record<string, unknown> }
interface Row {
  id: number; category: string; action: string; description: string; createdAt: string;
  actor: { fullName: string; email?: string } | null;
  entityType: string | null; entityId: number | null;
  details: Record<string, unknown> | null; changes: Change[] | null;
  ip: string | null; userAgent: string | null; method: string | null; route: string | null;
}
// every category the backend writes (keep in sync with AuditService callers); "system" = the safety net, should stay empty
const CATS = ['auth', 'security', 'news', 'users', 'permissions', 'settings', 'cities', 'messages', 'subscribers', 'ads', 'gallery', 'occasions', 'customers', 'appointments', 'files', 'audit', 'system'];

function Val({ v }: { v: unknown }) {
  if (v === undefined) return <span className="text-gray-300">—</span>;
  if (v === null || v === '') return <span className="text-gray-400">∅</span>;
  const text = typeof v === 'object' ? JSON.stringify(v, null, 1) : String(v);
  return <span className="whitespace-pre-wrap break-words" dir="auto">{text}</span>;
}

function ChangeTable({ c }: { c: Change }) {
  const { t } = useI18n();
  const fields = Object.keys(c.op === 'remove' ? c.before ?? {} : c.after ?? {});
  const color = c.op === 'insert' ? 'bg-green-50 text-green-800' : c.op === 'remove' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800';
  return (
    <div className="mb-3 overflow-hidden rounded-lg border">
      <div className={`flex items-center justify-between px-3 py-1.5 text-xs font-semibold ${color}`}>
        <span>{t(`a.op.${c.op}`)}</span>
        <span dir="ltr">{c.table}{c.id != null ? ` #${c.id}` : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr><th className="px-3 py-1.5 text-start">{t('a.field')}</th><th className="px-3 py-1.5 text-start">{t('a.before')}</th><th className="px-3 py-1.5 text-start">{t('a.after')}</th></tr>
          </thead>
          <tbody>
            {fields.map((k) => (
              <tr key={k} className="border-t align-top">
                <td className="px-3 py-1.5 font-mono text-xs text-gray-600" dir="ltr">{k}</td>
                <td className="max-w-[16rem] px-3 py-1.5">{c.op === 'insert' ? <Val v={undefined} /> : <Val v={c.before?.[k]} />}</td>
                <td className="max-w-[16rem] px-3 py-1.5">{c.op === 'remove' ? <Val v={undefined} /> : <Val v={c.after?.[k]} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="break-words text-sm">{children}</div>
    </div>
  );
}

function Details({ row }: { row: Row }) {
  const { t, lang } = useI18n();
  const extra = row.details && Object.keys(row.details).length ? row.details : null;
  return (
    <div>
      <p className="mb-3 font-medium">{row.description}</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Meta label={t('f.date')}>{fmtDate(lang, row.createdAt, true)}</Meta>
        <Meta label={t('a.actor')}>{row.actor ? <>{row.actor.fullName}{row.actor.email && <span className="text-gray-500" dir="ltr"> · {row.actor.email}</span>}</> : '—'}</Meta>
        <Meta label={t('a.category')}><span dir="ltr">{row.category} / {row.action}</span></Meta>
        <Meta label={t('a.entity')}><span dir="ltr">{row.entityType ? `${row.entityType}${row.entityId ? ` #${row.entityId}` : ''}` : '—'}</span></Meta>
        <div className="sm:col-span-2"><Meta label={t('a.agent')}><span dir="ltr" className="text-xs text-gray-600">{row.userAgent ?? '—'}</span></Meta></div>
      </div>
      <h3 className="mb-2 text-sm font-bold">{t('a.changes')}</h3>
      {row.changes?.length ? row.changes.map((c, i) => <ChangeTable key={i} c={c} />) : <p className="mb-3 text-sm text-gray-500">{t('a.noChanges')}</p>}
      {extra && (
        <>
          <h3 className="mb-2 mt-4 text-sm font-bold">{t('a.extra')}</h3>
          <pre dir="ltr" className="max-h-60 overflow-auto rounded-lg bg-gray-50 p-3 text-xs">{JSON.stringify(extra, null, 2)}</pre>
        </>
      )}
    </div>
  );
}

/** Read-only: no add / edit / delete controls exist for audit logs. */
export default function AuditPage() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const [open, setOpen] = useState<Row | null>(null);
  const cols: Col<Row>[] = [
    { key: 'createdAt', type: 'date', label: t('f.date'), render: (r) => fmtDate(lang, r.createdAt, true), text: (r) => fmtDate(lang, r.createdAt, true) },
    { key: 'category', label: t('a.category') },
    { key: 'action', label: t('a.action'), render: (r) => <span dir="ltr">{r.action}</span> },
    { key: 'description', label: t('a.desc') },
    { key: 'actor', label: t('a.actor'), render: (r) => r.actor?.fullName ?? '—', text: (r) => r.actor?.fullName ?? '' },
  ];
  return (
    <RequirePerm any={['audit.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.audit')}</h1>
      <DataTable<Row>
        endpoint="/admin/audit-logs"
        columns={cols}
        dateFilter
        exportable={can('audit.export')}
        exportName="audit-logs"
        rowActions={(r) => <Button size="sm" variant="outline" onClick={() => setOpen(r)}>{t('app.view')}{r.changes?.length ? ` · ${r.changes.length}` : ''}</Button>}
        filters={[{ key: 'category', label: t('a.category'), options: CATS.map((c) => ({ value: c, label: c })) }]}
      />
      <Modal open={!!open} onClose={() => setOpen(null)} title={t('adm.audit')} wide>
        {open && <Details row={open} />}
      </Modal>
    </RequirePerm>
  );
}
