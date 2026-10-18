'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls, PasswordInput } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { fmtDate } from '@/lib/utils';

interface Role { id: number; code: string; nameAr: string; nameEn: string }
interface Row { id: number; fullName: string; email: string; phone: string | null; isActive: boolean; role: Role; createdAt: string }

export default function UsersPage() {
  const { t, lang } = useI18n();
  const { me, can } = useAuth();
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [edit, setEdit] = useState<null | Partial<Row> & { password?: string; roleId?: number }>(null);
  const [key, setKey] = useState(0);

  useEffect(() => { api<Role[]>('/admin/roles').then(setRoles).catch(() => {}); }, []);
  const roleName = (r: Role) => (lang === 'ar' ? r.nameAr : r.nameEn);

  const cols: Col<Row>[] = [
    { key: 'fullName', label: t('u.name') },
    { key: 'email', label: t('u.email'), render: (r) => <span dir="ltr">{r.email}</span> },
    { key: 'role', label: t('u.role'), render: (r) => roleName(r.role), text: (r) => roleName(r.role) },
    { key: 'phone', label: t('u.phone'), render: (r) => <span dir="ltr">{r.phone ?? ''}</span> },
    { key: 'isActive', searchable: false, label: t('u.active'), render: (r) => r.isActive ? <span className="text-emerald-600">●</span> : <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-700">{t('u.pending')}</span>, text: (r) => (r.isActive ? t('app.yes') : t('app.no')) },
    { key: 'createdAt', type: 'date', label: t('f.date'), render: (r) => fmtDate(lang, r.createdAt), text: (r) => fmtDate(lang, r.createdAt) },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    try {
      if (!edit.id) return; // users are never created from here (public registration only)
      await api(`/admin/users/${edit.id}`, { method: 'PATCH', body: { fullName: edit.fullName, email: edit.email, phone: edit.phone ?? '', ...(can('users.role.change') ? { roleId: edit.roleId } : {}), ...(edit.password ? { password: edit.password } : {}) } });
      toast(t('app.saved')); setEdit(null); setKey((k) => k + 1);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <RequirePerm any={['users.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.users')}</h1>
      <DataTable<Row>
        endpoint="/admin/users"
        columns={cols}
        dateFilter
        refreshKey={key}
        exportName="users"
        filters={[
          { key: 'roleId', label: t('u.role'), options: roles.map((r) => ({ value: String(r.id), label: roleName(r) })) },
          { key: 'isActive', label: t('u.active'), options: [{ value: 'true', label: t('app.yes') }, { value: 'false', label: t('u.pending') }] },
        ]}
        exportable={can('users.export')}
        bulkDelete={{ path: '/admin/users/bulk-delete', can: can('users.delete') }}
        rowActions={(r, reload) => {
          const self = r.id === me?.id; // own account is edited from "Profile", never from this table
          return (
            <div className="flex gap-1">
              {can('users.update') && !self && <Button size="sm" variant="outline" onClick={() => setEdit({ ...r, roleId: r.role.id })}>{t('app.edit')}</Button>}
              {can('users.activate') && !self && (
                <Button size="sm" variant="ghost" onClick={async () => { try { await api(`/admin/users/${r.id}/activate`, { method: 'POST', body: { active: !r.isActive } }); reload(); } catch (e: any) { toast(e.message, 'err'); } }}>
                  {r.isActive ? t('u.deactivate') : t('u.activate')}
                </Button>
              )}
            </div>
          );
        }}
      />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={t('app.edit')}>
        {edit && (
          <form onSubmit={save} className="space-y-3">
            <Field label={t('u.name')}><input required minLength={2} className={inputCls} value={edit.fullName ?? ''} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} /></Field>
            <Field label={t('u.email')}><input required type="email" dir="ltr" className={inputCls} value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label={t('u.phone')}><input dir="ltr" className={inputCls} value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label={t('u.role')}>
              <select disabled={!can('users.role.change')} className={inputCls} value={edit.roleId} onChange={(e) => setEdit({ ...edit, roleId: Number(e.target.value) })}>{roles.map((r) => <option key={r.id} value={r.id}>{roleName(r)}</option>)}</select>
            </Field>
            <Field label={t('u.password')} hint="—"><PasswordInput dir="ltr" minLength={8} maxLength={72} className={inputCls} value={edit.password ?? ''} onChange={(e) => setEdit({ ...edit, password: e.target.value })} autoComplete="new-password" /></Field>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setEdit(null)}>{t('app.cancel')}</Button><Button>{t('app.save')}</Button></div>
          </form>
        )}
      </Modal>
    </RequirePerm>
  );
}
