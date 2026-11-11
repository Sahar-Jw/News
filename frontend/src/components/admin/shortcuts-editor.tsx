'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

interface Opt { url: string; titleAr: string; titleEn: string; group: { ar: string; en: string } | null }
interface Data { items: ({ url: string; titleAr: string; titleEn: string } | null)[]; options: Opt[] }
const SLOTS = 6;

/**
 * Quick links of the home page (Settings -> Home page). The admin only picks a page from a list: its Arabic and English titles
 * come with the page (the main menu's titles), nothing is typed. Needs settings.read; saving needs settings.update.
 */
export function ShortcutsEditor() {
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const ar = lang === 'ar';
  const [data, setData] = useState<Data | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const apply = useCallback((d: Data) => {
    const u = Array.from({ length: SLOTS }, (_, n) => d.items[n]?.url ?? '');
    setData(d); setUrls(u); setSaved(JSON.stringify(u));
  }, []);
  useEffect(() => { api<Data>('/admin/settings/shortcuts', { cache: 'no-store' }).then(apply).catch((e) => setErr(e.message)); }, [apply]);

  const byUrl = useMemo(() => new Map((data?.options ?? []).map((o) => [o.url, o])), [data]);
  const label = (o: Opt) => (ar ? o.titleAr : o.titleEn);
  const groups = useMemo(() => {
    const m = new Map<string, Opt[]>();
    for (const o of data?.options ?? []) {
      const g = o.group ? (ar ? o.group.ar : o.group.en) : ar ? 'صفحات أخرى' : 'Other pages';
      m.set(g, [...(m.get(g) ?? []), o]);
    }
    return [...m.entries()];
  }, [data, ar]);

  const dirty = JSON.stringify(urls) !== saved;
  const set = (n: number, v: string) => setUrls((u) => u.map((x, i) => (i === n ? v : x)));
  const swap = (a: number, b: number) => setUrls((u) => { const c = [...u]; [c[a], c[b]] = [c[b], c[a]]; return c; });
  const save = async () => {
    setBusy(true);
    try { apply(await api<Data>('/admin/settings/shortcuts', { method: 'PUT', body: { urls: urls.map((u) => u || null) } })); toast(ar ? 'تم حفظ الروابط السريعة' : 'Quick links saved'); }
    catch (e: any) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  if (err) return <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>;
  if (!data) return null;
  return (
    <section className="mb-6 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
      <h3 className="flex items-center gap-2 text-sm font-bold text-primary"><span className="h-4 w-1 rounded-full bg-accent" />{ar ? 'الروابط السريعة (تحت الشريط الرئيسي)' : 'Quick links (under the hero slider)'}</h3>
      <p className="mt-1 text-xs text-gray-500">{ar ? 'اختر الصفحة التي تريدها في كل خانة، ويظهر عنوانها بالعربية والإنجليزية تلقائياً. اترك الخانة فارغة لإخفائها.' : 'Pick the page for each slot; its Arabic and English titles are filled in automatically. Leave a slot empty to hide it.'}</p>
      <ol className="mt-3 space-y-2">
        {urls.map((u, n) => {
          const o = u ? byUrl.get(u) : undefined;
          return (
            <li key={n} className="grid items-center gap-2 rounded-xl border border-line p-2 md:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <span className="text-xs font-semibold text-gray-500">{ar ? `الرابط ${n + 1}` : `Link ${n + 1}`}</span>
              <select aria-label={ar ? `الصفحة للرابط ${n + 1}` : `Page for link ${n + 1}`} className={inputCls} value={u} disabled={!can('settings.update')} onChange={(e) => set(n, e.target.value)}>
                <option value="">{ar ? '— بدون —' : '— none —'}</option>
                {groups.map(([g, list]) => <optgroup key={g} label={g}>{list.map((x) => <option key={x.url} value={x.url} disabled={urls.some((v, i) => i !== n && v === x.url)}>{label(x)}</option>)}</optgroup>)}
              </select>
              <span className="min-w-0 text-xs text-gray-600">{o ? <><span dir="rtl" className="me-3">{o.titleAr}</span><span dir="ltr" className="text-gray-500">{o.titleEn}</span></> : <span className="text-gray-400">—</span>}</span>
              <span className="flex gap-1 justify-self-end">
                <button type="button" aria-label={ar ? 'تحريك للأعلى' : 'Move up'} disabled={n === 0 || !can('settings.update')} onClick={() => swap(n, n - 1)} className="h-8 w-8 rounded-lg text-gray-500 hover:bg-primary/10 hover:text-primary disabled:opacity-30">↑</button>
                <button type="button" aria-label={ar ? 'تحريك للأسفل' : 'Move down'} disabled={n === SLOTS - 1 || !can('settings.update')} onClick={() => swap(n, n + 1)} className="h-8 w-8 rounded-lg text-gray-500 hover:bg-primary/10 hover:text-primary disabled:opacity-30">↓</button>
              </span>
            </li>
          );
        })}
      </ol>
      {can('settings.update') && <div className="mt-3 flex justify-end"><Button type="button" disabled={!dirty || busy} onClick={save}>{ar ? 'حفظ' : 'Save'}</Button></div>}
    </section>
  );
}
