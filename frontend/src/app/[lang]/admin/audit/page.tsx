'use client';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

interface Row { id: number; category: string; action: string; description: string; createdAt: string; actor: { fullName: string } | null }
const CATS = ['auth', 'news', 'users', 'permissions', 'settings', 'cities', 'messages', 'security'];

/** Read-only: no add / edit / delete controls exist for audit logs. */
export default function AuditPage() {
  const { t, lang } = useI18n();
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
      <DataTable<Row> endpoint="/admin/audit-logs" columns={cols} dateFilter exportName="audit-logs" filters={[{ key: 'category', label: t('a.category'), options: CATS.map((c) => ({ value: c, label: c })) }]} />
    </RequirePerm>
  );
}
