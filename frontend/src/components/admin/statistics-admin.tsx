'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

interface Row {
  id: number; titleAr: string; titleEn: string; value: string; metric: string; prefix: string; suffixAr: string; suffixEn: string;
  sortOrder: number; isActive: boolean; source: 'manual' | 'metric' | 'none'; shownValue: string | null;
}
interface Metric { key: string; groupAr: string; groupEn: string; ar: string; en: string; value: number | null }
interface Draft { id?: number; titleAr: string; titleEn: string; mode: 'metric' | 'manual'; value: string; metric: string; prefix: string; suffixAr: string; suffixEn: string; sortOrder: string; isActive: boolean }

const EMPTY: Draft = { titleAr: '', titleEn: '', mode: 'metric', value: '', metric: '', prefix: '', suffixAr: '', suffixEn: '', sortOrder: '0', isActive: true };
const fromRow = (r: Row): Draft => ({
  id: r.id, titleAr: r.titleAr, titleEn: r.titleEn, mode: r.value ? 'manual' : 'metric', value: r.value, metric: r.metric, prefix: r.prefix, suffixAr: r.suffixAr, suffixEn: r.suffixEn,
  sortOrder: String(r.sortOrder), isActive: r.isActive,
});

/** The add / edit window of one statistic: titles in both languages, then either a value typed by hand or a real number counted from the database. */
export function StatisticDialog({ id, onClose, onSaved }: { id?: number; onClose: () => void; onSaved: () => void }) {
  const { lang } = useI18n();
  const toast = useToast();
  const ar = lang === 'ar';
  const tr = (a: string, e: string) => (ar ? a : e);
  const [draft, setDraft] = useState<Draft | null>(id ? null : EMPTY);
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Metric[]>('/admin/statistics/metrics', { cache: 'no-store' }).then(setMetrics).catch((e) => { toast(e.message, 'err'); setMetrics([]); });
    if (id) api<Row>(`/admin/statistics/${id}`, { cache: 'no-store' }).then((r) => setDraft(fromRow(r))).catch((e) => { toast(e.message, 'err'); onClose(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const out = new Map<string, Metric[]>();
    for (const m of metrics ?? []) { const g = ar ? m.groupAr : m.groupEn; out.set(g, [...(out.get(g) ?? []), m]); }
    return [...out.entries()];
  }, [metrics, ar]);

  const preview = (en: boolean) => {
    if (!draft) return '';
    const m = metrics?.find((x) => x.key === draft.metric);
    const raw = draft.mode === 'manual' ? draft.value.trim() : m?.value !== null && m?.value !== undefined ? m.value.toLocaleString('en-US') : '';
    if (!raw) return '—';
    const suffix = (en ? draft.suffixEn || draft.suffixAr : draft.suffixAr || draft.suffixEn).trim();
    return `${draft.prefix}${raw}${suffix ? ` ${suffix}` : ''}`;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    if (draft.mode === 'manual' && !draft.value.trim()) { toast(tr('اكتب القيمة أو اختر رقماً حقيقياً', 'Type a value or choose a real number'), 'err'); return; }
    if (draft.mode === 'metric' && !draft.metric) { toast(tr('اختر الرقم الحقيقي الذي سيظهر', 'Choose the real number to show'), 'err'); return; }
    const body = {
      titleAr: draft.titleAr.trim(), titleEn: draft.titleEn.trim(),
      value: draft.mode === 'manual' ? draft.value.trim() : '', metric: draft.mode === 'metric' ? draft.metric : '',
      prefix: draft.prefix.trim(), suffixAr: draft.suffixAr.trim(), suffixEn: draft.suffixEn.trim(), sortOrder: Number(draft.sortOrder) || 0, isActive: draft.isActive,
    };
    setBusy(true);
    try {
      await api(draft.id ? `/admin/statistics/${draft.id}` : '/admin/statistics', { method: draft.id ? 'PATCH' : 'POST', body });
      toast(tr('تم الحفظ', 'Saved'));
      onSaved();
      onClose();
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  const seg = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-bold transition ${on ? 'bg-secondary text-white' : 'text-secondary hover:bg-gray-100'}`;
  return (
    <Modal open onClose={onClose} title={draft?.id || id ? tr('تعديل الإحصائية', 'Edit statistic') : tr('إضافة إحصائية', 'Add statistic')} wide>
      {!draft || !metrics ? <div className="flex justify-center py-10"><Spinner /></div> : (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={tr('العنوان (عربي)', 'Title (Arabic)')}><input required maxLength={150} dir="rtl" className={inputCls} value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} /></Field>
            <Field label={tr('العنوان (إنجليزي)', 'Title (English)')} hint={tr('اختياري: يظهر العنوان العربي إذا تُرك فارغاً.', 'Optional: the Arabic title is shown when empty.')}><input maxLength={150} dir="ltr" className={inputCls} value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} /></Field>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold">{tr('مصدر الرقم', 'Where the number comes from')}</p>
            <div role="group" className="inline-flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-line">
              <button type="button" aria-pressed={draft.mode === 'metric'} className={seg(draft.mode === 'metric')} onClick={() => setDraft({ ...draft, mode: 'metric' })}>{tr('رقم حقيقي من قاعدة البيانات', 'Real number from the database')}</button>
              <button type="button" aria-pressed={draft.mode === 'manual'} className={seg(draft.mode === 'manual')} onClick={() => setDraft({ ...draft, mode: 'manual' })}>{tr('قيمة أكتبها بنفسي', 'A value I type myself')}</button>
            </div>
          </div>

          {draft.mode === 'metric' ? (
            <Field label={tr('الرقم الذي سيظهر', 'The number to show')} hint={tr('يُحسب من قاعدة البيانات عند كل زيارة (يتجدد خلال دقيقة تقريباً).', 'Counted from the database (refreshed about every minute).')}>
              <select required className={inputCls} value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })}>
                <option value="">—</option>
                {groups.map(([g, list]) => (
                  <optgroup key={g} label={g}>
                    {list.map((m) => <option key={m.key} value={m.key}>{ar ? m.ar : m.en} — {m.value === null ? tr('غير متاح', 'n/a') : m.value.toLocaleString('en-US')}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
          ) : (
            <Field label={tr('القيمة', 'Value')} hint={tr('مثال: 1,250 أو 25 أو 98.5 — يمكن أن تتضمن أي رمز.', 'Example: 1,250, 25 or 98.5 — it may contain any symbol.')}>
              <input required maxLength={60} dir="ltr" className={inputCls} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
            </Field>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <Field label={tr('قبل الرقم (مثل +)', 'Before the number (e.g. +)')}><input maxLength={20} dir="ltr" className={inputCls} value={draft.prefix} onChange={(e) => setDraft({ ...draft, prefix: e.target.value })} /></Field>
            <Field label={tr('بعد الرقم (عربي)', 'After the number (Arabic)')}><input maxLength={40} dir="rtl" className={inputCls} value={draft.suffixAr} onChange={(e) => setDraft({ ...draft, suffixAr: e.target.value })} placeholder={tr('مثل: عضو', 'e.g. عضو')} /></Field>
            <Field label={tr('بعد الرقم (إنجليزي)', 'After the number (English)')}><input maxLength={40} dir="ltr" className={inputCls} value={draft.suffixEn} onChange={(e) => setDraft({ ...draft, suffixEn: e.target.value })} placeholder="e.g. members" /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={tr('الترتيب', 'Order')} hint={tr('الأصغر أولاً. تظهر خمس إحصائيات كحد أقصى في الصفحة الرئيسية.', 'Smallest first. The home page shows at most five.')}><input type="number" min={0} max={100000} className={inputCls} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />{tr('ظاهرة في الموقع', 'Shown on the site')}</label>
          </div>

          <div className="rounded-xl bg-secondary/5 px-4 py-3 text-sm ring-1 ring-line">
            <p className="mb-1 text-xs font-bold text-gray-500">{tr('هكذا ستظهر', 'How it will look')}</p>
            <div className="flex flex-wrap gap-x-8 gap-y-1">
              <span><b dir="auto">{preview(false)}</b> <span className="text-gray-600">{draft.titleAr || '…'}</span></span>
              <span dir="ltr"><b>{preview(true)}</b> <span className="text-gray-600">{draft.titleEn || draft.titleAr || '…'}</span></span>
            </div>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>{tr('إلغاء', 'Cancel')}</Button><Button disabled={busy}>{tr('حفظ', 'Save')}</Button></div>
        </form>
      )}
    </Modal>
  );
}

/** Home page statistics: each one is typed by hand or tied to a real number of the database; titles in both languages; only the first five visible ones show. */
export function StatisticsAdmin() {
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const ar = lang === 'ar';
  const tr = (a: string, e: string) => (ar ? a : e);
  const [dialog, setDialog] = useState<{ id?: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);
  const SRC = { manual: tr('مكتوب يدوياً', 'Typed by hand'), metric: tr('من قاعدة البيانات', 'From the database'), none: '—' } as const;

  const cols: Col<Row>[] = [
    { key: 'titleAr', label: tr('العنوان (عربي)', 'Title (Arabic)') },
    { key: 'titleEn', label: tr('العنوان (إنجليزي)', 'Title (English)') },
    { key: 'shownValue', searchable: false, label: tr('القيمة الظاهرة', 'Value shown'), render: (r) => <bdi dir="ltr" className="font-bold">{r.shownValue ?? '—'}</bdi>, text: (r) => r.shownValue ?? '' },
    {
      key: 'source', searchable: false, label: tr('المصدر', 'Source'),
      render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${r.source === 'metric' ? 'bg-sky-100 text-sky-700' : r.source === 'manual' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{SRC[r.source]}</span>,
      text: (r) => SRC[r.source],
    },
    { key: 'sortOrder', searchable: false, label: tr('الترتيب', 'Order'), render: (r) => r.sortOrder, text: (r) => String(r.sortOrder) },
    {
      key: 'isActive', searchable: false, label: tr('ظاهرة', 'Shown'),
      render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{r.isActive ? tr('نعم', 'Yes') : tr('لا', 'No')}</span>,
      text: (r) => (r.isActive ? tr('نعم', 'Yes') : tr('لا', 'No')),
    },
  ];

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/statistics/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(tr('تم الحذف', 'Deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <RequirePerm any={['news.read.statistics']}>
      <h1 className="mb-1 text-2xl font-bold">{tr('إحصائيات الصفحة الرئيسية', 'Home page statistics')}</h1>
      <p className="mb-4 text-sm text-gray-600">{tr('اكتب القيمة بنفسك، أو اربط الإحصائية برقم حقيقي من قاعدة البيانات. تظهر خمس إحصائيات كحد أقصى بحسب الترتيب. إذا لم تضف أي إحصائية هنا تبقى الإحصائيات القديمة ظاهرة.', 'Type the value yourself, or tie the statistic to a real number from the database. At most five show, in order. While none are added here, the older statistics stay on the site.')}</p>
      <DataTable<Row>
        endpoint="/admin/statistics"
        columns={cols}
        refreshKey={key}
        exportable={false}
        bulkDelete={{ path: '/admin/statistics/bulk-delete', can: can('news.delete.statistics') }}
        toolbar={can('news.create.statistics') && <Button onClick={() => setDialog({})}>＋ {tr('إضافة إحصائية', 'Add statistic')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('news.update.statistics') && <Button size="sm" variant="outline" onClick={() => setDialog({ id: r.id })}>{tr('تعديل', 'Edit')}</Button>}
            {can('news.delete.statistics') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={tr('حذف', 'Delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      {dialog && <StatisticDialog key={dialog.id ?? 'new'} id={dialog.id} onClose={() => setDialog(null)} onSaved={() => setKey((k) => k + 1)} />}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={tr('تأكيد', 'Confirm')}>
        <p className="mb-5">{tr('هل تريد الحذف نهائياً؟', 'Delete for good?')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{tr('إلغاء', 'Cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{tr('حذف', 'Delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
