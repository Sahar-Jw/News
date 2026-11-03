'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Modal } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

interface Row { id: number; courseId: number; courseName: string; name: string; email: string; phone: string; organization: string; createdAt: string }

/** Participants registered through the public "Register now" form. Filter by course; export to XLSX/CSV. */
export function CourseRegistrationsAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [courses, setCourses] = useState<{ id: number; name: string }[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);

  useEffect(() => { api<{ id: number; name: string }[]>('/admin/course-registrations/courses').then(setCourses).catch(() => setCourses([])); }, []);

  const cols: Col<Row>[] = [
    { key: 'courseName', label: t('tr.course') },
    { key: 'name', label: t('tr.fullName') },
    { key: 'email', label: t('contact.email') },
    { key: 'phone', label: t('site.phone') },
    { key: 'organization', label: t('tr.org') },
    { key: 'createdAt', label: t('tr.regDate'), render: (r) => fmtDate(lang, r.createdAt, true), text: (r) => fmtDate(lang, r.createdAt, true) },
  ];

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/course-registrations/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (e: any) { toast(e.message, 'err'); }
  };

  return (
    <RequirePerm any={['registrations.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.courseRegs')}</h1>
      <DataTable<Row>
        endpoint="/admin/course-registrations"
        columns={cols}
        dateFilter
        exportable={can('registrations.export')}
        exportName="course-registrations"
        filters={[{ key: 'courseId', label: t('tr.course'), options: courses.map((c) => ({ value: String(c.id), label: c.name })) }]}
        bulkDelete={{ path: '/admin/course-registrations/bulk-delete', can: can('registrations.delete') }}
        rowActions={(r, reload) => can('registrations.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
      />
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{t('app.delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
