'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { RequirePerm } from '@/components/admin/guard';

interface Role { id: number; code: string; nameAr: string; nameEn: string; usersCount: number; permissionsCount: number }
interface Perm { id: number; code: string; module: string; nameAr: string; nameEn: string }

export default function RolesPage() {
  const { t, lang } = useI18n();
  const { me, can, refresh } = useAuth();
  const toast = useToast();
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [sel, setSel] = useState<Role | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [orig, setOrig] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<null | Partial<Role>>(null);

  const loadRoles = useCallback(() => api<Role[]>('/admin/roles').then(setRoles).catch((e) => toast(e.message, 'err')), [toast]);
  useEffect(() => { loadRoles(); api<Perm[]>('/admin/permissions').then(setPerms).catch(() => {}); }, [loadRoles]);

  const pick = async (r: Role) => {
    setSel(r);
    try {
      const res = await api<{ permissionCodes: string[] }>(`/admin/roles/${r.id}/permissions`);
      setChecked(new Set(res.permissionCodes)); setOrig(new Set(res.permissionCodes));
    } catch (e: any) { toast(e.message, 'err'); }
  };
  const saveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    try {
      if (edit.id) await api(`/admin/roles/${edit.id}`, { method: 'PATCH', body: { nameAr: edit.nameAr, nameEn: edit.nameEn } });
      else await api('/admin/roles', { method: 'POST', body: { code: edit.code, nameAr: edit.nameAr, nameEn: edit.nameEn } });
      toast(t('app.saved')); setEdit(null); loadRoles();
    } catch (err: any) { toast(err.message, 'err'); }
  };
  const delRole = async (r: Role) => {
    if (!confirm(t('tbl.confirmDelete'))) return;
    try { await api(`/admin/roles/${r.id}`, { method: 'DELETE' }); toast(t('app.deleted')); if (sel?.id === r.id) setSel(null); loadRoles(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const savePerms = async () => {
    if (!sel) return;
    try {
      await api(`/admin/roles/${sel.id}/permissions`, { method: 'PUT', body: { permissionCodes: [...checked] } });
      toast(t('app.saved')); setOrig(new Set(checked)); loadRoles();
      if (sel.id === me?.role?.id) refresh();
    } catch (e: any) { toast(e.message, 'err'); }
  };

  const modules = [...new Set(perms.map((p) => p.module))];
  const canAssign = can('permissions.assign');
  const dirty = checked.size !== orig.size || [...checked].some((c) => !orig.has(c));
  const name = (x: { nameAr: string; nameEn: string }) => (lang === 'ar' ? x.nameAr : x.nameEn);

  return (
    <RequirePerm any={['roles.manage', 'permissions.read', 'permissions.assign']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.roles')} / {t('adm.permissions')}</h1>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{t('adm.roles')}</h2>{can('roles.manage') && <Button size="sm" onClick={() => setEdit({})}>＋ {t('app.add')}</Button>}</div>
          {!roles ? <Center><Spinner /></Center> : (
            <ul className="space-y-1">
              {roles.map((r) => (
                <li key={r.id} className={`flex items-center justify-between rounded-lg border p-2 ${sel?.id === r.id ? 'border-primary bg-primary/5' : ''}`}>
                  <button className="flex-1 text-start" onClick={() => pick(r)}>
                    <div className="text-sm font-medium">{name(r)}</div>
                    <div className="text-xs text-gray-500" dir="ltr">{r.code} · {r.usersCount} {t('r.users')} · {r.permissionsCount}</div>
                  </button>
                  {can('roles.manage') && <div className="flex"><Button size="sm" variant="ghost" onClick={() => setEdit(r)}>✎</Button><Button size="sm" variant="ghost" className="text-red-600" onClick={() => delRole(r)}>✕</Button></div>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4 lg:col-span-2">
          {!sel ? <Center>{t('r.pickRole')}</Center> : (
            <>
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">{name(sel)}</h2>{canAssign && <Button disabled={!dirty} onClick={savePerms}>{t('r.savePerms')}</Button>}</div>
              <div className="space-y-4">
                {modules.map((m) => (
                  <div key={m}>
                    <div className="mb-1 text-xs font-bold uppercase text-gray-500">{m}</div>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {perms.filter((p) => p.module === m).map((p) => {
                        // UI hint only: the server rejects granting permissions you don't hold
                        const mine = me?.permissions.includes(p.code);
                        return (
                          <label key={p.code} className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${!canAssign || (!mine && !checked.has(p.code)) ? 'opacity-50' : 'hover:bg-gray-50'}`}>
                            <input type="checkbox" disabled={!canAssign || (!mine && !checked.has(p.code))} checked={checked.has(p.code)} onChange={(e) => { const n = new Set(checked); e.target.checked ? n.add(p.code) : n.delete(p.code); setChecked(n); }} />
                            <span>{name(p)} <span className="text-xs text-gray-400" dir="ltr">{p.code}</span></span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? t('app.edit') : t('app.add')}>
        {edit && (
          <form onSubmit={saveRole} className="space-y-3">
            {!edit.id && <Field label={t('r.code')} hint="a-z 0-9 _ . -"><input required dir="ltr" pattern="[a-z0-9][a-z0-9_.\-]{1,49}" className={inputCls} value={edit.code ?? ''} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>}
            <Field label={t('r.nameAr')}><input required className={inputCls} value={edit.nameAr ?? ''} onChange={(e) => setEdit({ ...edit, nameAr: e.target.value })} /></Field>
            <Field label={t('r.nameEn')}><input required dir="ltr" className={inputCls} value={edit.nameEn ?? ''} onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEdit(null)}>{t('app.cancel')}</Button><Button>{t('app.save')}</Button></div>
          </form>
        )}
      </Modal>
    </RequirePerm>
  );
}
