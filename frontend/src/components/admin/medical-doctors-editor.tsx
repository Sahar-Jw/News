'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

interface Entry {
  id: string; active: boolean;
  specialtyAr: string; specialtyEn: string; nameAr: string; nameEn: string;
  scheduleAr: string; scheduleEn: string; notesAr: string; notesEn: string;
}
interface Row { id: number; value: unknown }

const blank = (): Entry => ({ id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, active: true, specialtyAr: '', specialtyEn: '', nameAr: '', nameEn: '', scheduleAr: '', scheduleEn: '', notesAr: '', notesEn: '' });
const norm = (v: unknown): Entry[] => (Array.isArray(v) ? v : []).map((d: Partial<Entry>) => ({ ...blank(), ...d, id: d.id || blank().id }));

/**
 * Doctors / departments of the home medical-center slider (Settings -> Home page). Add, edit, hide, reorder and delete entries;
 * the other values of the slider (logo, hours, phones, Facebook, options) are ordinary rows of the table below (category medical).
 * Needs settings.read; saving needs settings.update.
 */
export function MedicalDoctorsEditor() {
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const ar = lang === 'ar';
  const [rowId, setRowId] = useState<number | null>(null);
  const [list, setList] = useState<Entry[]>([]);
  const [saved, setSaved] = useState('[]');
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const editable = can('settings.update');

  const load = useCallback(() => {
    api<{ data: Row[] }>('/admin/settings', { params: { category: 'medical', q: 'doctors', limit: 'all' }, cache: 'no-store' })
      .then((r) => {
        const row = (r.data as (Row & { key: string; category: string })[]).find((x) => x.category === 'medical' && x.key === 'doctors');
        if (!row) { setErr(ar ? 'إعداد الأطباء غير موجود. شغّل الـ migration أولاً.' : 'The doctors setting is missing. Run the migration first.'); return; }
        const e = norm(row.value);
        setRowId(row.id); setList(e); setSaved(JSON.stringify(e)); setErr('');
      })
      .catch((e) => setErr(e.message));
  }, [ar]);
  useEffect(() => { load(); }, [load]);

  const dirty = JSON.stringify(list) !== saved;
  const patch = (id: string, p: Partial<Entry>) => setList((l) => l.map((d) => (d.id === id ? { ...d, ...p } : d)));
  const move = (n: number, to: number) => setList((l) => { if (to < 0 || to >= l.length) return l; const c = [...l]; [c[n], c[to]] = [c[to], c[n]]; return c; });
  const add = () => { const d = blank(); setList((l) => [...l, d]); setOpen(d.id); setQ(''); };
  const remove = (id: string) => { if (window.confirm(ar ? 'حذف هذا الطبيب / القسم؟' : 'Delete this entry?')) setList((l) => l.filter((d) => d.id !== id)); };
  const save = async () => {
    if (rowId === null) return;
    const bad = list.find((d) => !d.specialtyAr.trim() && !d.nameAr.trim() && !d.specialtyEn.trim() && !d.nameEn.trim());
    if (bad) { setOpen(bad.id); toast(ar ? 'أدخل الاسم أو الاختصاص على الأقل' : 'Enter a name or a specialty', 'err'); return; }
    setBusy(true);
    try {
      await api(`/admin/settings/${rowId}`, { method: 'PATCH', body: { value: list } });
      setSaved(JSON.stringify(list));
      toast(ar ? 'تم حفظ الأطباء' : 'Doctors saved');
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  if (err) return <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>;
  if (rowId === null) return null;
  const needle = q.trim().toLowerCase();
  const shown = list.filter((d) => !needle || [d.nameAr, d.nameEn, d.specialtyAr, d.specialtyEn].some((x) => x.toLowerCase().includes(needle)));
  const txt = (d: Entry, k: keyof Entry, label: string, rows = 0, dir?: 'ltr' | 'rtl') => (
    <label className="block text-xs font-semibold text-gray-600">{label}
      {rows ? <textarea rows={rows} dir={dir} disabled={!editable} className={`${inputCls} mt-1 font-normal`} value={String(d[k] ?? '')} onChange={(e) => patch(d.id, { [k]: e.target.value })} />
        : <input dir={dir} disabled={!editable} className={`${inputCls} mt-1 font-normal`} value={String(d[k] ?? '')} onChange={(e) => patch(d.id, { [k]: e.target.value })} />}
    </label>
  );
  return (
    <section className="mb-6 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
      <h3 className="flex items-center gap-2 text-sm font-bold text-primary"><span className="h-4 w-1 rounded-full bg-accent" />{ar ? 'المركز الطبي: الأطباء والأقسام وأوقات الدوام' : 'Medical center: doctors, departments and schedules'}</h3>
      <p className="mt-1 text-xs text-gray-500">{ar ? 'يظهر في سلايدر المركز الطبي بالصفحة الرئيسية. اكتب كل وقت في سطر بالشكل: الأيام | الوقت (مثال: الأحد - الثلاثاء | صباحاً 9:00 - 11:00). الشعار والدوام والأرقام والفيسبوك وخيارات السلايدر في جدول الإعدادات (المركز الطبي).' : 'Shown in the medical-center slider on the home page. Write one time slot per line as: days | time (e.g. Sun - Tue | 9:00 - 11:00). Logo, hours, phones, Facebook and slider options are in the settings table (Medical center).'}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={ar ? 'بحث بالاسم أو الاختصاص' : 'Search name or specialty'} aria-label={ar ? 'بحث' : 'Search'} className={`${inputCls} max-w-xs`} />
        <span className="text-xs text-gray-500">{list.length}</span>
        {editable && <Button type="button" variant="outline" onClick={add}>{ar ? '+ إضافة طبيب / قسم' : '+ Add doctor / department'}</Button>}
      </div>
      <ol className="mt-3 space-y-2">
        {shown.map((d) => {
          const n = list.indexOf(d);
          const isOpen = open === d.id;
          return (
            <li key={d.id} className={`rounded-xl border border-line ${d.active ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-center gap-2 p-2">
                <button type="button" onClick={() => setOpen(isOpen ? null : d.id)} aria-expanded={isOpen} className="min-w-0 flex-1 text-start">
                  <span className="block truncate text-sm font-bold">{d.nameAr || d.nameEn || d.specialtyAr || d.specialtyEn || (ar ? '(بدون اسم)' : '(unnamed)')}</span>
                  <span className="block truncate text-xs text-gray-500">{d.nameAr || d.nameEn ? (d.specialtyAr || d.specialtyEn) : ''}</span>
                </button>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="h-4 w-4" checked={d.active} disabled={!editable} onChange={(e) => patch(d.id, { active: e.target.checked })} />{ar ? 'ظاهر' : 'Shown'}</label>
                {editable && !needle && <>
                  <button type="button" aria-label={ar ? 'تحريك للأعلى' : 'Move up'} disabled={n === 0} onClick={() => move(n, n - 1)} className="h-8 w-8 rounded-lg text-gray-500 hover:bg-primary/10 hover:text-primary disabled:opacity-30">↑</button>
                  <button type="button" aria-label={ar ? 'تحريك للأسفل' : 'Move down'} disabled={n === list.length - 1} onClick={() => move(n, n + 1)} className="h-8 w-8 rounded-lg text-gray-500 hover:bg-primary/10 hover:text-primary disabled:opacity-30">↓</button>
                </>}
                {editable && <button type="button" onClick={() => remove(d.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">{ar ? 'حذف' : 'Delete'}</button>}
              </div>
              {isOpen && (
                <div className="grid gap-3 border-t border-line p-3 md:grid-cols-2">
                  {txt(d, 'nameAr', ar ? 'الاسم (عربي)' : 'Name (Arabic)')}
                  {txt(d, 'nameEn', ar ? 'الاسم (إنجليزي) — اتركه فارغاً لاستعمال العربي' : 'Name (English) — empty uses Arabic', 0, 'ltr')}
                  {txt(d, 'specialtyAr', ar ? 'الاختصاص (عربي)' : 'Specialty (Arabic)')}
                  {txt(d, 'specialtyEn', ar ? 'الاختصاص (إنجليزي)' : 'Specialty (English)', 0, 'ltr')}
                  {txt(d, 'scheduleAr', ar ? 'الأيام والأوقات (عربي) — سطر لكل وقت: الأيام | الوقت' : 'Days & times (Arabic) — one line each: days | time', 3)}
                  {txt(d, 'scheduleEn', ar ? 'الأيام والأوقات (إنجليزي) — اتركه فارغاً لاستعمال العربي' : 'Days & times (English) — empty uses Arabic', 3, 'ltr')}
                  {txt(d, 'notesAr', ar ? 'ملاحظات (عربي)' : 'Notes (Arabic)', 2)}
                  {txt(d, 'notesEn', ar ? 'ملاحظات (إنجليزي)' : 'Notes (English)', 2, 'ltr')}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {editable && <div className="mt-3 flex justify-end gap-2">{dirty && <Button type="button" variant="outline" disabled={busy} onClick={() => setList(JSON.parse(saved))}>{ar ? 'تراجع' : 'Discard'}</Button>}<Button type="button" disabled={!dirty || busy} onClick={save}>{ar ? 'حفظ' : 'Save'}</Button></div>}
    </section>
  );
}
