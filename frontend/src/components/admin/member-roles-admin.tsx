'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { BASE_ROLE, RoleOption, RoleScope } from '@/lib/member-roles';

interface Data { scope: RoleScope; options: RoleOption[]; usage: Record<string, number> }
interface Row { key: string; ar: string; en: string; uid: string }

const META: Record<RoleScope, { perm: string; titleAr: string; titleEn: string; hintAr: string; hintEn: string }> = {
  board: { perm: 'board.update', titleAr: 'الصفات في مجلس الإدارة', titleEn: 'Board positions', hintAr: 'تظهر هذه الصفات في قائمة «الصفة في المجلس» عند إضافة عضو، وبهذا الترتيب في صفحة المجلس (الأول في الأعلى).', hintEn: 'These fill the “Position” list when a board member is added, and set the order of the public page (first = top).' },
  committee: { perm: 'committees.update', titleAr: 'الصفات في اللجان والقطاعات', titleEn: 'Committee positions', hintAr: 'تظهر هذه الصفات عند إضافة عضو إلى أي لجنة أو قطاع، وبهذا الترتيب في صفحة اللجنة. لجنة سيدات الأعمال لها قائمتها الخاصة.', hintEn: 'These fill the position list when a member is added to any committee or sector, and set the order on the committee page. The Women Committee has its own list.' },
  women: { perm: 'committees.update', titleAr: 'الصفات في لجنة سيدات الأعمال', titleEn: 'Women committee positions', hintAr: 'تظهر هذه الصفات عند إضافة عضوة إلى اللجنة. الصفات غير «عضوة» تظهر في أعلى الهيكلية التنظيمية بهذا الترتيب.', hintEn: 'These fill the position list when a member is added. Every position except “Member” shows at the top of the organisational structure, in this order.' },
};
let uid = 0;
const toRows = (o: RoleOption[]): Row[] => o.map((x) => ({ ...x, uid: `u${uid++}` }));

/**
 * Add, rename, reorder and delete the positions of one page (board / committees / women). Lives in that page's own settings.
 * A position that people still hold cannot be deleted (the list says how many); "Member" is the base position and stays.
 */
export function MemberRolesAdmin({ scope }: { scope: RoleScope }) {
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const ar = lang === 'ar';
  const m = META[scope];
  const mayEdit = can(m.perm);
  const [data, setData] = useState<Data | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const apply = useCallback((d: Data) => { setData(d); setRows(toRows(d.options)); setSaved(JSON.stringify(d.options)); setErr(''); }, []);
  useEffect(() => { api<Data>(`/admin/member-roles/${scope}`, { cache: 'no-store' }).then(apply).catch((e) => setErr(e.message)); }, [scope, apply]);

  const clean = (r: Row[]) => r.map(({ key, ar: a, en }) => ({ key, ar: a.trim(), en: en.trim() }));
  const dirty = JSON.stringify(clean(rows)) !== saved;
  const set = (i: number, patch: Partial<Row>) => setRows((l) => l.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  const move = (a: number, b: number) => setRows((l) => { const c = [...l]; [c[a], c[b]] = [c[b], c[a]]; return c; });
  const add = () => setRows((l) => [...l, { key: '', ar: '', en: '', uid: `u${uid++}` }]);
  const used = (k: string) => (k && data ? data.usage[k] ?? 0 : 0);
  const save = async () => {
    if (rows.some((r) => !r.ar.trim())) { toast(ar ? 'اكتب اسم كل صفة بالعربية (أو احذف الصف الفارغ)' : 'Give every position an Arabic name (or delete the empty row)', 'err'); return; }
    setBusy(true);
    try {
      apply(await api<Data>(`/admin/member-roles/${scope}`, { method: 'PUT', body: { options: clean(rows).map((r) => ({ ...r, key: r.key || undefined })) } }));
      toast(ar ? 'تم حفظ الصفات' : 'Positions saved');
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  if (err) return <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>;
  if (!data) return null;
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-bold text-primary"><span className="h-4 w-1 rounded-full bg-accent" />{ar ? m.titleAr : m.titleEn}</h3>
      <p className="mt-1 text-xs text-gray-500">{ar ? m.hintAr : m.hintEn}</p>
      <ol className="mt-3 space-y-2">
        {rows.map((r, i) => {
          const n = used(r.key);
          const locked = r.key === BASE_ROLE;
          return (
            <li key={r.uid} className="grid items-center gap-2 rounded-xl border border-line p-2 md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <span className="text-center text-xs font-semibold text-gray-400">{i + 1}</span>
              <input dir="rtl" maxLength={60} className={inputCls} value={r.ar} disabled={!mayEdit} placeholder={ar ? 'الاسم بالعربية' : 'Arabic name'} aria-label={ar ? 'الاسم بالعربية' : 'Arabic name'} onChange={(e) => set(i, { ar: e.target.value })} />
              <input dir="ltr" maxLength={60} className={inputCls} value={r.en} disabled={!mayEdit} placeholder={ar ? 'الاسم بالإنجليزية (اختياري)' : 'English name (optional)'} aria-label={ar ? 'الاسم بالإنجليزية' : 'English name'} onChange={(e) => set(i, { en: e.target.value })} />
              <span className="text-xs text-gray-500 md:min-w-[5.5rem] md:text-center">{n > 0 ? (ar ? `${n} عضو` : `${n} member${n === 1 ? '' : 's'}`) : r.key ? (ar ? 'غير مستخدمة' : 'not used') : (ar ? 'جديدة' : 'new')}</span>
              {mayEdit && (
                <span className="flex gap-1 justify-self-end">
                  <button type="button" aria-label={ar ? 'تحريك للأعلى' : 'Move up'} disabled={i === 0} onClick={() => move(i, i - 1)} className="h-8 w-8 rounded-lg text-gray-500 hover:bg-primary/10 hover:text-primary disabled:opacity-30">↑</button>
                  <button type="button" aria-label={ar ? 'تحريك للأسفل' : 'Move down'} disabled={i === rows.length - 1} onClick={() => move(i, i + 1)} className="h-8 w-8 rounded-lg text-gray-500 hover:bg-primary/10 hover:text-primary disabled:opacity-30">↓</button>
                  <button type="button" aria-label={ar ? 'حذف' : 'Delete'} title={locked ? (ar ? 'الصفة الأساسية لا تُحذف' : 'The base position cannot be deleted') : n > 0 ? (ar ? 'غيّر صفة الأعضاء أولاً' : 'Change those members first') : undefined} disabled={locked || n > 0} onClick={() => setRows((l) => l.filter((_, k) => k !== i))} className="h-8 w-8 rounded-lg text-red-600 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent">✕</button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {mayEdit && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" disabled={rows.length >= 20} onClick={add}>＋ {ar ? 'إضافة صفة' : 'Add a position'}</Button>
          <Button type="button" disabled={!dirty || busy} onClick={save}>{busy ? '…' : ar ? 'حفظ' : 'Save'}</Button>
        </div>
      )}
    </section>
  );
}
