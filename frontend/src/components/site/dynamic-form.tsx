'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, FilePicker, inputCls } from '@/components/ui/ui';

export interface FieldOption { value: string; ar: string; en?: string }
export interface FieldDef {
  key: string; type: string; labelAr: string; labelEn?: string; helpAr?: string; helpEn?: string; required?: boolean; options?: FieldOption[];
  min?: number; max?: number; minLength?: number; maxLength?: number; sensitive?: boolean; role?: string;
  fileKinds?: string[]; maxFiles?: number; maxSizeMb?: number; showIf?: { key: string; equals: string };
}
export interface PublicForm { slug: string; titleAr: string; titleEn?: string | null; descriptionAr?: string | null; descriptionEn?: string | null; isOpen: boolean; requireConsent: boolean; fields: FieldDef[] }

const ACCEPT: Record<string, string> = { image: '.jpg,.jpeg,.png,.webp', pdf: '.pdf', doc: '.doc,.docx,.pdf' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isShown = (f: FieldDef, v: Record<string, any>) => {
  if (!f.showIf) return true;
  const x = v[f.showIf.key];
  return Array.isArray(x) ? x.includes(f.showIf.equals) : String(x ?? '') === f.showIf.equals;
};

/** Draws any form built in the dashboard. Everything it shows comes from the field list: no field is hard-coded here. */
export function DynamicForm({ form }: { form: PublicForm }) {
  const { lang, href } = useI18n();
  const L = (ar: string, en?: string | null) => (lang === 'en' && en ? en : ar);
  const [v, setV] = useState<Record<string, any>>({});
  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ reference: string; message: string } | null>(null);
  const set = (k: string, x: any) => { setV((o) => ({ ...o, [k]: x })); setErrs((e) => ({ ...e, [k]: '' })); };
  const req = L('هذا الحقل مطلوب', 'This field is required');

  const validate = () => {
    const e: Record<string, string> = {};
    for (const f of form.fields) {
      if (f.type === 'heading' || f.type === 'note' || !isShown(f, v)) continue;
      const x = v[f.key];
      const empty = x === undefined || x === '' || (Array.isArray(x) && !x.length);
      if (f.type === 'file') { if (f.required && !(files[f.key]?.length)) e[f.key] = req; continue; }
      if (f.type === 'checkbox') { if (f.required && !x) e[f.key] = req; continue; }
      if (empty) { if (f.required) e[f.key] = req; continue; }
      if (f.type === 'email' && !EMAIL_RE.test(String(x).trim())) e[f.key] = L('بريد غير صالح', 'Invalid email');
      if (f.type === 'number') {
        const n = Number(x);
        if (!Number.isFinite(n)) e[f.key] = L('رقم غير صالح', 'Invalid number');
        else if (f.min !== undefined && n < f.min) e[f.key] = `${L('الحد الأدنى', 'Minimum')} ${f.min}`;
        else if (f.max !== undefined && n > f.max) e[f.key] = `${L('الحد الأعلى', 'Maximum')} ${f.max}`;
      }
      if ((f.type === 'text' || f.type === 'textarea') && f.minLength && String(x).trim().length < f.minLength) e[f.key] = `${L('الحد الأدنى للأحرف', 'Minimum characters')}: ${f.minLength}`;
    }
    if (form.requireConsent && !consent) e._consent = req;
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const addFiles = (f: FieldDef, list: FileList | null) => {
    if (!list) return;
    const max = (f.maxSizeMb ?? 5) * 1024 * 1024;
    const picked = [...list];
    if (picked.some((x) => x.size > max)) { setErrs((e) => ({ ...e, [f.key]: `${L('الحد الأقصى للملف', 'Max file size')} ${f.maxSizeMb ?? 5} MB` })); return; }
    const next = [...(files[f.key] ?? []), ...picked].slice(0, f.maxFiles ?? 1);
    setFiles((o) => ({ ...o, [f.key]: next }));
    setErrs((e) => ({ ...e, [f.key]: '' }));
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError('');
    if (!validate()) return;
    setBusy(true);
    try {
      const data: Record<string, any> = {};
      for (const f of form.fields) if (f.type !== 'file' && isShown(f, v) && v[f.key] !== undefined) data[f.key] = v[f.key];
      const fd = new FormData();
      fd.set('data', JSON.stringify(data));
      fd.set('consent', String(consent));
      fd.set('lang', lang);
      fd.set('website', website);
      for (const f of form.fields) if (f.type === 'file' && isShown(f, v)) for (const file of files[f.key] ?? []) fd.append(`f_${f.key}`, file);
      setDone(await api(`/public/forms/${encodeURIComponent(form.slug)}/submit`, { method: 'POST', form: fd }));
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const visible = useMemo(() => form.fields.filter((f) => isShown(f, v)), [form.fields, v]);

  if (done) {
    return (
      <div className="rounded-2xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200" role="status">
        <p className="text-lg font-bold text-emerald-800">{done.message}</p>
        {done.reference && <p className="mt-2 text-sm text-emerald-700">{L('رقم الطلب', 'Reference')}: <b dir="ltr">{done.reference}</b></p>}
      </div>
    );
  }
  if (!form.isOpen) return <p className="rounded-2xl bg-amber-50 p-5 text-center text-sm text-amber-800 ring-1 ring-amber-200">{L('باب التقديم على هذا النموذج مغلق حالياً', 'This form is currently closed')}</p>;

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
      {visible.map((f) => {
        const label = L(f.labelAr, f.labelEn) + (f.required && f.type !== 'heading' && f.type !== 'note' ? ' *' : '');
        const help = L(f.helpAr ?? '', f.helpEn) || undefined;
        const err = errs[f.key];
        const optLabel = (o: FieldOption) => L(o.ar, o.en);
        if (f.type === 'heading') return <h3 key={f.key} className="border-s-4 border-accent ps-3 pt-2 text-base font-bold text-secondary">{L(f.labelAr, f.labelEn)}</h3>;
        if (f.type === 'note') return <p key={f.key} className="rounded-xl bg-canvas p-3 text-sm text-gray-700">{L(f.labelAr, f.labelEn)}</p>;
        if (f.type === 'checkbox') return (
          <div key={f.key}>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!v[f.key]} onChange={(e) => set(f.key, e.target.checked)} /><span>{label}</span></label>
            {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}{err && <p className="mt-1 text-xs text-red-600">{err}</p>}
          </div>
        );
        if (f.type === 'radio' || f.type === 'multiselect') {
          const cur: string[] = f.type === 'radio' ? [v[f.key]].filter(Boolean) : v[f.key] ?? [];
          return (
            <fieldset key={f.key} className="space-y-1.5">
              <legend className="text-sm font-semibold text-ink/85">{label}</legend>
              {(f.options ?? []).map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm">
                  <input type={f.type === 'radio' ? 'radio' : 'checkbox'} name={f.key} checked={cur.includes(o.value)}
                    onChange={(e) => set(f.key, f.type === 'radio' ? o.value : e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value))} />
                  {optLabel(o)}
                </label>
              ))}
              {help && <p className="text-xs text-gray-500">{help}</p>}{err && <p className="text-xs text-red-600">{err}</p>}
            </fieldset>
          );
        }
        if (f.type === 'file') {
          const list = files[f.key] ?? [];
          return (
            <div key={f.key} className="space-y-2">
              <p className="text-sm font-semibold text-ink/85">{label}</p>
              <FilePicker label={L('اختيار ملف', 'Choose a file')} multiple={(f.maxFiles ?? 1) > 1} accept={(f.fileKinds ?? ['image', 'pdf', 'doc']).map((k) => ACCEPT[k]).join(',')}
                hint={`${(f.fileKinds ?? []).join(' / ')} · ≤ ${f.maxSizeMb ?? 5} MB · ${L('حتى', 'up to')} ${f.maxFiles ?? 1}`} onChange={(l) => addFiles(f, l)} />
              {list.length > 0 && (
                <ul className="space-y-1 text-sm">{list.map((x, i) => <li key={i} className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate">{x.name}</span><button type="button" className="text-xs text-red-600" onClick={() => setFiles((o) => ({ ...o, [f.key]: list.filter((_, j) => j !== i) }))}>{L('إزالة', 'Remove')}</button></li>)}</ul>
              )}
              {help && <p className="text-xs text-gray-500">{help}</p>}{err && <p className="text-xs text-red-600">{err}</p>}
            </div>
          );
        }
        const common = { className: inputCls, value: v[f.key] ?? '', onChange: (e: React.ChangeEvent<any>) => set(f.key, e.target.value) };
        return (
          <Field key={f.key} label={label} hint={help} error={err}>
            {f.type === 'textarea' ? <textarea rows={4} maxLength={f.maxLength ?? 5000} {...common} />
              : f.type === 'select' ? <select {...common}><option value="">{L('اختر…', 'Select…')}</option>{(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{optLabel(o)}</option>)}</select>
              : <input type={f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'url' ? 'url' : f.type === 'phone' ? 'tel' : 'text'}
                  dir={['email', 'url', 'phone', 'number'].includes(f.type) ? 'ltr' : undefined} min={f.min} max={f.max} maxLength={f.type === 'text' ? f.maxLength ?? 300 : undefined} {...common} />}
          </Field>
        );
      })}
      {/* honeypot: hidden from people, filled by bots */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
      {form.requireConsent && (
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErrs((o) => ({ ...o, _consent: '' })); }} />
            <span>{L('أوافق على معالجة بياناتي لغرض هذا الطلب وفق ', 'I agree to my data being processed for this request according to the ')}<Link href={href('/privacy')} target="_blank" className="font-bold text-primary underline">{L('سياسة الخصوصية', 'privacy policy')}</Link></span>
          </label>
          {errs._consent && <p className="mt-1 text-xs text-red-600">{errs._consent}</p>}
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? L('جارٍ الإرسال…', 'Sending…') : L('إرسال الطلب', 'Submit')}</Button></div>
    </form>
  );
}
