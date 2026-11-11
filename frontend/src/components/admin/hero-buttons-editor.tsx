'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

interface Opt { url: string; titleAr: string; titleEn: string; group: { ar: string; en: string } | null }
interface Item { url: string; textAr: string; textEn: string }
interface Data { items: Item[]; options: Opt[] }

/**
 * The button of each home slide (Settings -> Home page). The admin picks the page from the list of the site's pages
 * (the same list as the quick links) and writes the button's text in Arabic and English; leaving the page empty = no button on that slide.
 */
export function HeroButtonsEditor() {
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const ar = lang === 'ar';
  const [data, setData] = useState<Data | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const apply = useCallback((d: Data) => { setData(d); setItems(d.items); setSaved(JSON.stringify(d.items)); }, []);
  useEffect(() => { api<Data>('/admin/settings/hero-buttons', { cache: 'no-store' }).then(apply).catch((e) => setErr(e.message)); }, [apply]);

  const groups = useMemo(() => {
    const m = new Map<string, Opt[]>();
    for (const o of data?.options ?? []) {
      const g = o.group ? (ar ? o.group.ar : o.group.en) : ar ? 'صفحات أخرى' : 'Other pages';
      m.set(g, [...(m.get(g) ?? []), o]);
    }
    return [...m.entries()];
  }, [data, ar]);

  const dirty = JSON.stringify(items) !== saved;
  const edit = (n: number, p: Partial<Item>) => setItems((list) => list.map((x, i) => (i === n ? { ...x, ...p } : x)));
  const save = async () => {
    setBusy(true);
    try { apply(await api<Data>('/admin/settings/hero-buttons', { method: 'PUT', body: { items } })); toast(ar ? 'تم حفظ أزرار الشريط الرئيسي' : 'Hero buttons saved'); }
    catch (e: any) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  if (err) return <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>;
  if (!data) return null;
  const canEdit = can('settings.update');
  return (
    <section className="mb-6 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
      <h3 className="flex items-center gap-2 text-sm font-bold text-primary"><span className="h-4 w-1 rounded-full bg-accent" />{ar ? 'أزرار شرائح الشريط الرئيسي' : 'Hero slide buttons'}</h3>
      <p className="mt-1 text-xs text-gray-500">{ar ? 'اختر الصفحة التي يفتحها زر كل شريحة واكتب نص الزر. اترك الصفحة فارغة لإخفاء الزر. إن تركت النص فارغاً يظهر النص الافتراضي.' : 'Pick the page each slide’s button opens and write its text. Leave the page empty for no button; an empty text shows the default wording.'}</p>
      <ol className="mt-3 space-y-2">
        {items.map((it, n) => (
          <li key={n} className="grid items-center gap-2 rounded-xl border border-line p-2 md:grid-cols-[5rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <span className="text-xs font-semibold text-gray-500">{ar ? `الشريحة ${n + 1}` : `Slide ${n + 1}`}</span>
            <select aria-label={ar ? `صفحة زر الشريحة ${n + 1}` : `Page of slide ${n + 1} button`} className={inputCls} value={it.url} disabled={!canEdit} onChange={(e) => edit(n, { url: e.target.value })}>
              <option value="">{ar ? '— بدون زر —' : '— no button —'}</option>
              {groups.map(([g, list]) => <optgroup key={g} label={g}>{list.map((x) => <option key={x.url} value={x.url}>{ar ? x.titleAr : x.titleEn}</option>)}</optgroup>)}
            </select>
            <input className={inputCls} dir="rtl" maxLength={40} disabled={!canEdit || !it.url} value={it.textAr} placeholder={ar ? 'نص الزر (عربي)' : 'Button text (Arabic)'} onChange={(e) => edit(n, { textAr: e.target.value })} />
            <input className={inputCls} dir="ltr" maxLength={40} disabled={!canEdit || !it.url} value={it.textEn} placeholder={ar ? 'نص الزر (إنجليزي)' : 'Button text (English)'} onChange={(e) => edit(n, { textEn: e.target.value })} />
          </li>
        ))}
      </ol>
      {canEdit && <div className="mt-3 flex justify-end"><Button type="button" disabled={!dirty || busy} onClick={save}>{ar ? 'حفظ' : 'Save'}</Button></div>}
    </section>
  );
}
