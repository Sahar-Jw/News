'use client';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useSite } from '@/components/site/site-context';

export interface NewsFilterValues { q: string; category: string; subcategory: string; dateFrom: string; dateTo: string; sort: string }
export const EMPTY_FILTERS: NewsFilterValues = { q: '', category: '', subcategory: '', dateFrom: '', dateTo: '', sort: '' };

/** Filter bar for the public news list. Values live in the URL (the page owns them); Apply pushes them, Reset clears them. */
export function NewsFilters({ value, onApply }: { value: NewsFilterValues; onApply: (v: NewsFilterValues) => void }) {
  const { t } = useI18n();
  const { categories } = useSite();
  const [f, setF] = useState<NewsFilterValues>(value);
  // collapsed by default so the card stays small
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof NewsFilterValues, string>>>({});

  // keep the form in sync when the URL changes (back/forward, reset, nav links)
  useEffect(() => { setF(value); setErrors({}); }, [value.q, value.category, value.subcategory, value.dateFrom, value.dateTo, value.sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof NewsFilterValues, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: undefined })); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = f.q.trim();
    const err: Partial<Record<keyof NewsFilterValues, string>> = {};
    if (q && q.length < 2) err.q = t('site.searchMin');
    if (f.dateFrom && f.dateTo && f.dateFrom > f.dateTo) err.dateTo = t('site.dateRangeInvalid');
    setErrors(err);
    if (Object.keys(err).length) return;
    onApply({ ...f, q });
  };

  const reset = () => { setF(EMPTY_FILTERS); setErrors({}); onApply(EMPTY_FILTERS); };
  const active = Object.values(value).some(Boolean);

  const activeCount = [value.category, value.subcategory, value.dateFrom, value.dateTo, value.sort].filter(Boolean).length;

  return (
    <form onSubmit={submit} noValidate className="mb-5 rounded-xl border border-line bg-white p-2.5 shadow-sm" aria-label={t('site.filters')}>
      {/* slim bar: search + the button that opens the other filters, so the card takes little room */}
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-[12rem] flex-1">
          <input className={`${inputCls} !py-1.5`} maxLength={100} value={f.q} onChange={(e) => set('q', e.target.value)} placeholder={t('site.searchPlaceholder')} aria-label={t('site.search')} aria-invalid={!!errors.q} />
          {errors.q && <span className="mt-1 block text-xs text-red-600">{errors.q}</span>}
        </div>
        <Button type="button" size="sm" variant="outline" className="!py-2" aria-expanded={open} aria-controls="news-filters-panel" onClick={() => setOpen((v) => !v)}>
          <span aria-hidden="true">⚙</span> {t('site.filters')}
          {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 text-white">{activeCount}</span>}
          <span aria-hidden="true" className={`text-[10px] transition ${open ? 'rotate-180' : ''}`}>▼</span>
        </Button>
        <Button type="submit" size="sm" className="!py-2">{t('site.search')}</Button>
        {active && <Button type="button" size="sm" variant="ghost" className="!py-2" onClick={reset}>{t('site.resetFilters')}</Button>}
      </div>
      {open && (
        <div id="news-filters-panel" className="mt-3 border-t border-line pt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label={t('site.category')}>
              <select className={`${inputCls} !py-1.5`} value={f.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">{t('site.allCategories')}</option>
                {categories.main.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label={t('site.subcategory')}>
              <select className={`${inputCls} !py-1.5`} value={f.subcategory} onChange={(e) => set('subcategory', e.target.value)}>
                <option value="">{t('site.allSubcategories')}</option>
                {categories.sub.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label={t('site.dateFrom')}>
              <input type="date" className={`${inputCls} !py-1.5`} value={f.dateFrom} max={f.dateTo || undefined} onChange={(e) => set('dateFrom', e.target.value)} />
            </Field>
            <Field label={t('site.dateTo')} error={errors.dateTo}>
              <input type="date" className={`${inputCls} !py-1.5`} value={f.dateTo} min={f.dateFrom || undefined} onChange={(e) => set('dateTo', e.target.value)} />
            </Field>
            <Field label={t('site.sortBy')}>
              <select className={`${inputCls} !py-1.5`} value={f.sort} onChange={(e) => set('sort', e.target.value)}>
                <option value="">{t('site.sortNewest')}</option>
                <option value="oldest">{t('site.sortOldest')}</option>
                <option value="views">{t('site.sortViews')}</option>
              </select>
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm">{t('site.applyFilters')}</Button>
          </div>
        </div>
      )}
    </form>
  );
}
