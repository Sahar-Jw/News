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

  return (
    <form onSubmit={submit} noValidate className="mb-6 rounded-2xl border border-line bg-white p-4 shadow-sm" aria-label={t('site.filters')}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <Field label={t('site.search')} error={errors.q}>
            <input className={inputCls} maxLength={100} value={f.q} onChange={(e) => set('q', e.target.value)} placeholder={t('site.searchPlaceholder')} />
          </Field>
        </div>
        <Field label={t('site.category')}>
          <select className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">{t('site.allCategories')}</option>
            {categories.main.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={t('site.subcategory')}>
          <select className={inputCls} value={f.subcategory} onChange={(e) => set('subcategory', e.target.value)}>
            <option value="">{t('site.allSubcategories')}</option>
            {categories.sub.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label={t('site.dateFrom')} error={undefined}>
          <input type="date" className={inputCls} value={f.dateFrom} max={f.dateTo || undefined} onChange={(e) => set('dateFrom', e.target.value)} />
        </Field>
        <Field label={t('site.dateTo')} error={errors.dateTo}>
          <input type="date" className={inputCls} value={f.dateTo} min={f.dateFrom || undefined} onChange={(e) => set('dateTo', e.target.value)} />
        </Field>
        <Field label={t('site.sortBy')}>
          <select className={inputCls} value={f.sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="">{t('site.sortNewest')}</option>
            <option value="oldest">{t('site.sortOldest')}</option>
            <option value="views">{t('site.sortViews')}</option>
          </select>
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit">{t('site.applyFilters')}</Button>
        {active && <Button type="button" variant="outline" onClick={reset}>{t('site.resetFilters')}</Button>}
      </div>
    </form>
  );
}
