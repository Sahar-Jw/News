'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Center, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { FieldDef, FieldOption } from '@/components/site/dynamic-form';

interface Status { key: string; ar: string; en?: string; color?: string }
interface Cat { key: string; ar: string; en?: string }
interface Hook { name: string; url: string; secret?: string; events: string[]; enabled: boolean; hasSecret?: boolean; keepSecret?: boolean }
interface FormDef {
  id: number; slug: string; titleAr: string; titleEn: string | null; descriptionAr: string | null; descriptionEn: string | null; successAr: string | null; successEn: string | null;
  isOpen: boolean; isListed: boolean; fields: FieldDef[]; statuses: Status[]; categories: Cat[]; notifyEmails: string | null; sendReceipt: boolean; requireConsent: boolean;
  retentionDays: number | null; integrations: Hook[]; version: number; submissionsTotal?: number; submissionsUnread?: number;
}
const TYPES: [string, string, string][] = [
  ['text', 'نص قصير', 'Short text'], ['textarea', 'نص طويل', 'Long text'], ['number', 'رقم', 'Number'], ['email', 'بريد إلكتروني', 'Email'], ['phone', 'هاتف', 'Phone'], ['url', 'رابط', 'Link'],
  ['date', 'تاريخ', 'Date'], ['select', 'قائمة منسدلة', 'Dropdown'], ['radio', 'اختيار واحد', 'Single choice'], ['multiselect', 'اختيار متعدد', 'Multiple choice'], ['checkbox', 'مربع موافقة', 'Checkbox'],
  ['file', 'مرفق (ملفات)', 'Attachment'], ['heading', 'عنوان قسم', 'Section heading'], ['note', 'نص توضيحي', 'Note'],
];
const DEFAULT_STATUSES: Status[] = [
  { key: 'new', ar: 'جديد', en: 'New', color: '#2563eb' }, { key: 'in_review', ar: 'قيد المراجعة', en: 'In review', color: '#d97706' }, { key: 'accepted', ar: 'مقبول', en: 'Accepted', color: '#059669' },
  { key: 'rejected', ar: 'مرفوض', en: 'Rejected', color: '#dc2626' }, { key: 'completed', ar: 'مكتمل', en: 'Completed', color: '#475569' },
];
const NEW_FORM: Omit<FormDef, 'id' | 'version'> = {
  slug: '', titleAr: '', titleEn: '', descriptionAr: '', descriptionEn: '', successAr: '', successEn: '', isOpen: true, isListed: true, fields: [], statuses: DEFAULT_STATUSES, categories: [],
  notifyEmails: '', sendReceipt: true, requireConsent: true, retentionDays: null, integrations: [],
};
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^[^a-z]+/, '');
const move = <T,>(a: T[], i: number, d: number) => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return b; [b[i], b[j]] = [b[j], b[i]]; return b; };
const chip = (color?: string) => ({ backgroundColor: `${color ?? '#64748b'}22`, color: color ?? '#475569' });

function useL() {
  const { lang } = useI18n();
  return (ar: string, en: string) => (lang === 'ar' ? ar : en);
}

// ============================================================================================ field editor
function FieldEditor({ fields, onChange }: { fields: FieldDef[]; onChange: (f: FieldDef[]) => void }) {
  const L = useL();
  const { lang } = useI18n();
  const upd = (i: number, p: Partial<FieldDef>) => onChange(fields.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const add = (type: string) => {
    let n = fields.length + 1;
    while (fields.some((f) => f.key === `${type}_${n}`)) n++;
    const f: FieldDef = { key: `${type}_${n}`, type, labelAr: '' };
    if (['select', 'radio', 'multiselect'].includes(type)) f.options = [{ value: 'option_1', ar: '' }];
    if (type === 'file') { f.fileKinds = ['pdf', 'image']; f.maxFiles = 1; f.maxSizeMb = 5; }
    onChange([...fields, f]);
  };
  const setOpt = (i: number, k: number, p: Partial<FieldOption>) => upd(i, { options: fields[i].options!.map((o, j) => (j === k ? { ...o, ...p } : o)) });
  const earlier = (i: number) => fields.slice(0, i).filter((f) => !['heading', 'note', 'file'].includes(f.type));

  return (
    <div className="space-y-3">
      {fields.length === 0 && <p className="rounded-xl bg-canvas p-4 text-center text-sm text-gray-500">{L('لا توجد حقول بعد. أضف أول حقل من الأزرار أدناه.', 'No fields yet. Add the first one with the buttons below.')}</p>}
      {fields.map((f, i) => {
        const display = f.type === 'heading' || f.type === 'note';
        const typeName = TYPES.find((t) => t[0] === f.type)?.[lang === 'ar' ? 1 : 2] ?? f.type;
        return (
          <div key={i} className="space-y-3 rounded-2xl border border-line bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{i + 1}. {typeName}</span>
              <span className="ms-auto flex gap-1">
                <Button size="sm" variant="ghost" type="button" onClick={() => onChange(move(fields, i, -1))} aria-label="up">↑</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => onChange(move(fields, i, 1))} aria-label="down">↓</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => { const c = { ...f, key: `${f.key}_copy`.slice(0, 50) }; onChange([...fields.slice(0, i + 1), c, ...fields.slice(i + 1)]); }}>{L('نسخ', 'Copy')}</Button>
                <Button size="sm" variant="danger" type="button" onClick={() => onChange(fields.filter((_, j) => j !== i))}>{L('حذف', 'Delete')}</Button>
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={L('العنوان (عربي)', 'Label (Arabic)')}><input className={inputCls} value={f.labelAr} maxLength={300} onChange={(e) => upd(i, { labelAr: e.target.value })} /></Field>
              <Field label={L('العنوان (إنكليزي)', 'Label (English)')}><input dir="ltr" className={inputCls} value={f.labelEn ?? ''} maxLength={300} onChange={(e) => upd(i, { labelEn: e.target.value })} /></Field>
              <Field label={L('نوع الحقل', 'Field type')}>
                <select className={inputCls} value={f.type} onChange={(e) => upd(i, { type: e.target.value, ...(['select', 'radio', 'multiselect'].includes(e.target.value) && !f.options?.length ? { options: [{ value: 'option_1', ar: '' }] } : {}), ...(e.target.value === 'file' ? { fileKinds: f.fileKinds ?? ['pdf', 'image'], maxFiles: f.maxFiles ?? 1, maxSizeMb: f.maxSizeMb ?? 5 } : {}) })}>
                  {TYPES.map((t) => <option key={t[0]} value={t[0]}>{t[lang === 'ar' ? 1 : 2]}</option>)}
                </select>
              </Field>
              <Field label={L('المعرّف (a-z, 0-9, _)', 'Key (a-z, 0-9, _)')} hint={L('تُخزَّن الإجابات تحت هذا المعرّف؛ غيّره فقط قبل وصول طلبات.', 'Answers are stored under it; only change it before submissions arrive.')}>
                <input dir="ltr" className={inputCls} value={f.key} maxLength={50} onChange={(e) => upd(i, { key: keyOf(e.target.value) })} />
              </Field>
            </div>
            {!display && (
              <>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  {f.type !== 'checkbox' || true ? <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.required} onChange={(e) => upd(i, { required: e.target.checked })} />{L('مطلوب', 'Required')}</label> : null}
                  {f.type !== 'file' && <label className="flex items-center gap-2"><input type="checkbox" checked={!!f.sensitive} onChange={(e) => upd(i, { sensitive: e.target.checked })} />{L('حساس (مشفّر ومخفي عمّن لا يملك الصلاحية)', 'Sensitive (encrypted, hidden without permission)')}</label>}
                  {['text', 'email', 'phone'].includes(f.type) && (
                    <label className="flex items-center gap-2">{L('يحدد هوية المتقدم:', 'Identifies the applicant:')}
                      <select className="rounded-lg border border-line px-2 py-1" value={f.role ?? ''} onChange={(e) => upd(i, { role: (e.target.value || undefined) as any })}>
                        <option value="">—</option><option value="name">{L('الاسم', 'Name')}</option>{f.type === 'email' && <option value="email">{L('البريد', 'Email')}</option>}{f.type === 'phone' && <option value="phone">{L('الهاتف', 'Phone')}</option>}
                      </select>
                    </label>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={L('نص مساعد (عربي)', 'Help (Arabic)')}><input className={inputCls} value={f.helpAr ?? ''} maxLength={500} onChange={(e) => upd(i, { helpAr: e.target.value })} /></Field>
                  <Field label={L('نص مساعد (إنكليزي)', 'Help (English)')}><input dir="ltr" className={inputCls} value={f.helpEn ?? ''} maxLength={500} onChange={(e) => upd(i, { helpEn: e.target.value })} /></Field>
                </div>
                {f.type === 'number' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={L('الحد الأدنى', 'Min')}><input type="number" className={inputCls} value={f.min ?? ''} onChange={(e) => upd(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
                    <Field label={L('الحد الأعلى', 'Max')}><input type="number" className={inputCls} value={f.max ?? ''} onChange={(e) => upd(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
                  </div>
                )}
                {(f.type === 'text' || f.type === 'textarea') && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={L('أقل عدد أحرف', 'Min length')}><input type="number" min={0} className={inputCls} value={f.minLength ?? ''} onChange={(e) => upd(i, { minLength: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
                    <Field label={L('أكبر عدد أحرف', 'Max length')}><input type="number" min={1} max={20000} className={inputCls} value={f.maxLength ?? ''} onChange={(e) => upd(i, { maxLength: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
                  </div>
                )}
                {['select', 'radio', 'multiselect'].includes(f.type) && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{L('الخيارات', 'Options')}</p>
                    {(f.options ?? []).map((o, k) => (
                      <div key={k} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                        <input dir="ltr" className={inputCls} placeholder={L('القيمة', 'Value')} value={o.value} maxLength={100} onChange={(e) => setOpt(i, k, { value: e.target.value })} />
                        <input className={inputCls} placeholder={L('النص (عربي)', 'Text (Arabic)')} value={o.ar} maxLength={200} onChange={(e) => setOpt(i, k, { ar: e.target.value })} />
                        <input dir="ltr" className={inputCls} placeholder={L('النص (إنكليزي)', 'Text (English)')} value={o.en ?? ''} maxLength={200} onChange={(e) => setOpt(i, k, { en: e.target.value })} />
                        <Button size="sm" variant="danger" type="button" onClick={() => upd(i, { options: f.options!.filter((_, j) => j !== k) })}>×</Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" type="button" onClick={() => upd(i, { options: [...(f.options ?? []), { value: `option_${(f.options?.length ?? 0) + 1}`, ar: '' }] })}>+ {L('خيار', 'Option')}</Button>
                  </div>
                )}
                {f.type === 'file' && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label={L('الأنواع المسموحة', 'Allowed types')}>
                      <span className="flex flex-wrap gap-3 text-sm">
                        {([['image', L('صور', 'Images')], ['pdf', 'PDF'], ['doc', 'Word']] as const).map(([k, name]) => (
                          <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={!!f.fileKinds?.includes(k)} onChange={(e) => upd(i, { fileKinds: e.target.checked ? [...(f.fileKinds ?? []), k] : (f.fileKinds ?? []).filter((x) => x !== k) })} />{name}</label>
                        ))}
                      </span>
                    </Field>
                    <Field label={L('عدد الملفات', 'Max files')}><input type="number" min={1} max={10} className={inputCls} value={f.maxFiles ?? 1} onChange={(e) => upd(i, { maxFiles: Number(e.target.value) })} /></Field>
                    <Field label={L('حجم الملف (MB)', 'File size (MB)')}><input type="number" min={1} max={10} className={inputCls} value={f.maxSizeMb ?? 5} onChange={(e) => upd(i, { maxSizeMb: Number(e.target.value) })} /></Field>
                  </div>
                )}
              </>
            )}
            {earlier(i).length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>{L('أظهر هذا الحقل فقط عندما', 'Show only when')}</span>
                <select className="rounded-lg border border-line px-2 py-1" value={f.showIf?.key ?? ''} onChange={(e) => upd(i, { showIf: e.target.value ? { key: e.target.value, equals: f.showIf?.equals ?? '' } : undefined })}>
                  <option value="">{L('— دائماً —', '— always —')}</option>{earlier(i).map((x) => <option key={x.key} value={x.key}>{x.labelAr || x.key}</option>)}
                </select>
                {f.showIf && <><span>=</span><input dir="ltr" className="rounded-lg border border-line px-2 py-1" placeholder={L('القيمة', 'value')} value={f.showIf.equals} onChange={(e) => upd(i, { showIf: { key: f.showIf!.key, equals: e.target.value } })} /></>}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2 rounded-2xl bg-canvas p-3">
        <span className="w-full text-xs font-bold text-gray-600">{L('إضافة حقل', 'Add a field')}</span>
        {TYPES.map((t) => <Button key={t[0]} size="sm" variant="outline" type="button" onClick={() => add(t[0])}>+ {t[lang === 'ar' ? 1 : 2]}</Button>)}
      </div>
    </div>
  );
}

// ============================================================================================ form dialog
type Tab = 'general' | 'fields' | 'workflow' | 'privacy' | 'links';

function FormDialog({ initial, onClose, onSaved }: { initial: FormDef | null; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const toast = useToast();
  const { can } = useAuth();
  const [f, setF] = useState<Omit<FormDef, 'id' | 'version'> & { id?: number }>(initial ?? NEW_FORM);
  const [tab, setTab] = useState<Tab>('general');
  const [busy, setBusy] = useState(false);
  const canEdit = initial ? can('forms.update') : can('forms.create');
  const up = (p: Partial<FormDef>) => setF((o) => ({ ...o, ...p }));
  const tabs: [Tab, string][] = [['general', L('عام', 'General')], ['fields', `${L('الحقول', 'Fields')} (${f.fields.length})`], ['workflow', L('الحالات والتصنيفات', 'Statuses & categories')], ['privacy', L('الإشعارات والخصوصية', 'Notifications & privacy')], ['links', L('الربط مع الأنظمة', 'Integrations')]];

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        slug: f.slug, titleAr: f.titleAr, titleEn: f.titleEn, descriptionAr: f.descriptionAr, descriptionEn: f.descriptionEn, successAr: f.successAr, successEn: f.successEn, isOpen: f.isOpen, isListed: f.isListed,
        fields: f.fields, statuses: f.statuses, categories: f.categories, notifyEmails: f.notifyEmails, sendReceipt: f.sendReceipt, requireConsent: f.requireConsent, retentionDays: f.retentionDays,
        integrations: f.integrations.map(({ hasSecret, keepSecret, ...h }) => ({ ...h, keepSecret: !h.secret && !!hasSecret })),
      };
      await api(initial ? `/admin/forms/${initial.id}` : '/admin/forms', { method: initial ? 'PATCH' : 'POST', body });
      toast(L('تم الحفظ بنجاح', 'Saved'));
      onSaved();
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={initial ? `${L('تعديل النموذج', 'Edit form')}: ${initial.titleAr}` : L('نموذج جديد', 'New form')} wide closeOnBackdrop={false}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1 border-b border-line pb-2">
          {tabs.map(([k, name]) => <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm ${tab === k ? 'bg-primary text-white' : 'bg-canvas text-gray-700'}`}>{name}</button>)}
        </div>
        {tab === 'general' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={L('عنوان النموذج (عربي) *', 'Title (Arabic) *')}><input className={inputCls} value={f.titleAr} maxLength={200} onChange={(e) => up({ titleAr: e.target.value })} /></Field>
            <Field label={L('عنوان النموذج (إنكليزي)', 'Title (English)')}><input dir="ltr" className={inputCls} value={f.titleEn ?? ''} maxLength={200} onChange={(e) => up({ titleEn: e.target.value })} /></Field>
            <Field label={L('الرابط المختصر *', 'Slug *')} hint={L('يظهر في رابط النموذج: /forms?slug=…', 'Used in the form link: /forms?slug=…')}><input dir="ltr" className={inputCls} value={f.slug} maxLength={80} onChange={(e) => up({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} /></Field>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.isOpen} onChange={(e) => up({ isOpen: e.target.checked })} />{L('مفتوح لاستقبال الطلبات', 'Open for submissions')}</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.isListed} onChange={(e) => up({ isListed: e.target.checked })} />{L('يظهر في قائمة النماذج العامة', 'Listed on the public forms page')}</label>
            </div>
            <Field label={L('وصف (عربي)', 'Description (Arabic)')}><textarea rows={4} className={inputCls} value={f.descriptionAr ?? ''} onChange={(e) => up({ descriptionAr: e.target.value })} /></Field>
            <Field label={L('وصف (إنكليزي)', 'Description (English)')}><textarea dir="ltr" rows={4} className={inputCls} value={f.descriptionEn ?? ''} onChange={(e) => up({ descriptionEn: e.target.value })} /></Field>
            <Field label={L('رسالة النجاح (عربي)', 'Success message (Arabic)')}><input className={inputCls} value={f.successAr ?? ''} maxLength={2000} onChange={(e) => up({ successAr: e.target.value })} /></Field>
            <Field label={L('رسالة النجاح (إنكليزي)', 'Success message (English)')}><input dir="ltr" className={inputCls} value={f.successEn ?? ''} maxLength={2000} onChange={(e) => up({ successEn: e.target.value })} /></Field>
          </div>
        )}
        {tab === 'fields' && <FieldEditor fields={f.fields} onChange={(fields) => up({ fields })} />}
        {tab === 'workflow' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-bold">{L('حالات الطلب (الأولى = حالة الطلب الجديد)', 'Statuses (the first one is given to new requests)')}</p>
              {f.statuses.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-1.5">
                  <input dir="ltr" className={inputCls} placeholder="key" value={s.key} onChange={(e) => up({ statuses: f.statuses.map((x, j) => (j === i ? { ...x, key: keyOf(e.target.value) } : x)) })} />
                  <input className={inputCls} placeholder={L('عربي', 'Arabic')} value={s.ar} onChange={(e) => up({ statuses: f.statuses.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)) })} />
                  <input dir="ltr" className={inputCls} placeholder="English" value={s.en ?? ''} onChange={(e) => up({ statuses: f.statuses.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)) })} />
                  <input type="color" aria-label="color" className="h-10 w-10 rounded" value={s.color ?? '#64748b'} onChange={(e) => up({ statuses: f.statuses.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)) })} />
                  <span className="flex"><Button size="sm" variant="ghost" type="button" onClick={() => up({ statuses: move(f.statuses, i, -1) })}>↑</Button><Button size="sm" variant="danger" type="button" onClick={() => up({ statuses: f.statuses.filter((_, j) => j !== i) })}>×</Button></span>
                </div>
              ))}
              <Button size="sm" variant="outline" type="button" onClick={() => up({ statuses: [...f.statuses, { key: `status_${f.statuses.length + 1}`, ar: '', color: '#64748b' }] })}>+ {L('حالة', 'Status')}</Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold">{L('تصنيفات الطلبات (للفرز)', 'Categories (for sorting requests)')}</p>
              {f.categories.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5">
                  <input dir="ltr" className={inputCls} placeholder="key" value={c.key} onChange={(e) => up({ categories: f.categories.map((x, j) => (j === i ? { ...x, key: keyOf(e.target.value) } : x)) })} />
                  <input className={inputCls} placeholder={L('عربي', 'Arabic')} value={c.ar} onChange={(e) => up({ categories: f.categories.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)) })} />
                  <input dir="ltr" className={inputCls} placeholder="English" value={c.en ?? ''} onChange={(e) => up({ categories: f.categories.map((x, j) => (j === i ? { ...x, en: e.target.value } : x)) })} />
                  <Button size="sm" variant="danger" type="button" onClick={() => up({ categories: f.categories.filter((_, j) => j !== i) })}>×</Button>
                </div>
              ))}
              <Button size="sm" variant="outline" type="button" onClick={() => up({ categories: [...f.categories, { key: `cat_${f.categories.length + 1}`, ar: '' }] })}>+ {L('تصنيف', 'Category')}</Button>
            </div>
          </div>
        )}
        {tab === 'privacy' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={L('بريد الموظفين الذين يُبلَّغون بكل طلب جديد', 'Staff e-mails told about each new request')} hint={L('افصل بينها بفاصلة. لا يحتوي البريد على محتوى الطلب.', 'Comma separated. The e-mail never contains the answers.')}><input dir="ltr" className={inputCls} value={f.notifyEmails ?? ''} maxLength={1000} onChange={(e) => up({ notifyEmails: e.target.value })} /></Field>
            <Field label={L('مدة الاحتفاظ بالطلبات (أيام)', 'Keep requests for (days)')} hint={L('تُحذف الطلبات ومرفقاتها تلقائياً بعد هذه المدة. اتركه فارغاً للاحتفاظ بلا حد.', 'Requests and files are deleted automatically afterwards. Empty = keep.')}><input type="number" min={1} max={3650} className={inputCls} value={f.retentionDays ?? ''} onChange={(e) => up({ retentionDays: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.sendReceipt} onChange={(e) => up({ sendReceipt: e.target.checked })} />{L('إرسال إشعار استلام لصاحب الطلب (يلزم حقل بريد بدور «البريد»)', 'Send the applicant a receipt (needs an email field with role Email)')}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.requireConsent} onChange={(e) => up({ requireConsent: e.target.checked })} />{L('اشتراط الموافقة على سياسة الخصوصية', 'Require consent to the privacy policy')}</label>
          </div>
        )}
        {tab === 'links' && (
          <div className="space-y-3">
            <p className="rounded-xl bg-canvas p-3 text-xs text-gray-600">{L('عند وصول طلب أو تغيّر حالته يُرسَل إشعار JSON موقَّع (HMAC-SHA256 في X-Signature) إلى عنوان https تحدده، ليتصل بأنظمة الغرفة وقواعد بياناتها. تُرسل الحقول غير الحساسة فقط؛ الحقول الحساسة والمرفقات لا تغادر هذا النظام.', 'When a request arrives or changes status, a signed JSON notification (HMAC-SHA256 in X-Signature) is POSTed to the https address you set, so the chamber’s own systems and databases can be connected. Only non-sensitive fields are sent; sensitive fields and files never leave this system.')}</p>
            {f.integrations.map((h, i) => {
              const set = (p: Partial<Hook>) => up({ integrations: f.integrations.map((x, j) => (j === i ? { ...x, ...p } : x)) });
              return (
                <div key={i} className="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-2">
                  <input className={inputCls} placeholder={L('اسم النظام', 'System name')} value={h.name} onChange={(e) => set({ name: e.target.value })} />
                  <input dir="ltr" className={inputCls} placeholder="https://…" value={h.url} onChange={(e) => set({ url: e.target.value })} />
                  <input dir="ltr" type="password" autoComplete="new-password" className={inputCls} placeholder={h.hasSecret ? L('(المفتاح السري محفوظ، اتركه فارغاً لإبقائه)', '(secret stored: leave empty to keep)') : L('مفتاح التوقيع السري', 'Signing secret')} value={h.secret ?? ''} onChange={(e) => set({ secret: e.target.value })} />
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {(['submitted', 'status_changed'] as const).map((ev) => <label key={ev} className="flex items-center gap-1"><input type="checkbox" checked={h.events.includes(ev)} onChange={(e) => set({ events: e.target.checked ? [...h.events, ev] : h.events.filter((x) => x !== ev) })} />{ev === 'submitted' ? L('طلب جديد', 'New request') : L('تغيّر الحالة', 'Status change')}</label>)}
                    <label className="flex items-center gap-1"><input type="checkbox" checked={h.enabled} onChange={(e) => set({ enabled: e.target.checked })} />{L('مفعّل', 'Enabled')}</label>
                    <Button size="sm" variant="danger" type="button" onClick={() => up({ integrations: f.integrations.filter((_, j) => j !== i) })}>×</Button>
                  </div>
                </div>
              );
            })}
            <Button size="sm" variant="outline" type="button" onClick={() => up({ integrations: [...f.integrations, { name: '', url: '', events: ['submitted'], enabled: true }] })}>+ {L('ربط جديد', 'New integration')}</Button>
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="outline" onClick={onClose}>{L('إغلاق', 'Close')}</Button>
          {canEdit && <Button disabled={busy} onClick={save}>{L('حفظ', 'Save')}</Button>}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================================ forms list
export function FormsBuilderAdmin() {
  const L = useL();
  const { lang, href } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<FormDef[] | null>(null);
  const [edit, setEdit] = useState<FormDef | 'new' | null>(null);
  const [del, setDel] = useState<FormDef | null>(null);
  const load = useCallback(() => { api<FormDef[]>('/admin/forms').then(setRows).catch((e) => toast(e.message, 'err')); }, [toast]);
  useEffect(load, [load]);

  const open = async (r: FormDef) => { try { setEdit(await api<FormDef>(`/admin/forms/${r.id}`)); } catch (e: any) { toast(e.message, 'err'); } };
  const dup = async (r: FormDef) => {
    const slug = window.prompt(L('الرابط المختصر للنسخة الجديدة', 'Slug of the copy'), `${r.slug}-copy`);
    if (!slug) return;
    try { await api(`/admin/forms/${r.id}/duplicate`, { method: 'POST', body: { slug } }); toast(L('تم النسخ', 'Copied')); load(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const remove = async () => {
    if (!del) return;
    try { await api(`/admin/forms/${del.id}`, { method: 'DELETE', params: { deleteSubmissions: !!del.submissionsTotal } }); toast(L('تم الحذف', 'Deleted')); setDel(null); load(); } catch (e: any) { toast(e.message, 'err'); }
  };
  if (!rows) return <Center><Spinner /></Center>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-gray-600">{L('كل نموذج قابل للتعديل بالكامل: الحقول (أي نوع)، الإضافة والحذف، المرفقات، الحالات والتصنيفات.', 'Every form is fully editable: fields (any type), add / delete, attachments, statuses and categories.')}</p>
        {can('forms.create') && <Button onClick={() => setEdit('new')}>+ {L('نموذج جديد', 'New form')}</Button>}
      </div>
      <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-start text-xs text-gray-600"><tr><th className="p-3 text-start">{L('النموذج', 'Form')}</th><th className="p-3 text-start">{L('الحقول', 'Fields')}</th><th className="p-3 text-start">{L('الطلبات', 'Requests')}</th><th className="p-3 text-start">{L('الحالة', 'State')}</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-line bg-white">
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500">{L('لا توجد نماذج', 'No forms')}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3"><b>{(lang === 'en' && r.titleEn) || r.titleAr}</b><br /><a className="text-xs text-primary underline" dir="ltr" target="_blank" rel="noreferrer" href={href(`/forms?slug=${r.slug}`)}>/forms?slug={r.slug}</a></td>
                <td className="p-3">{r.fields.length}</td>
                <td className="p-3">{r.submissionsTotal ?? 0}{!!r.submissionsUnread && <span className="ms-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{r.submissionsUnread}</span>}</td>
                <td className="p-3"><span className={`rounded px-1.5 py-0.5 text-[10px] ${r.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>{r.isOpen ? L('مفتوح', 'Open') : L('مغلق', 'Closed')}</span></td>
                <td className="p-3"><span className="flex flex-wrap justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => open(r)}>{can('forms.update') ? L('تعديل', 'Edit') : L('عرض', 'View')}</Button>
                  {can('forms.create') && <Button size="sm" variant="ghost" onClick={() => dup(r)}>{L('نسخ', 'Duplicate')}</Button>}
                  {can('forms.delete') && <Button size="sm" variant="danger" onClick={() => setDel(r)}>{L('حذف', 'Delete')}</Button>}
                </span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <FormDialog initial={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
      <Modal open={!!del} onClose={() => setDel(null)} title={L('حذف النموذج', 'Delete form')}>
        {del && (
          <div className="space-y-3 text-sm">
            <p>{del.submissionsTotal ? L(`سيُحذف النموذج مع ${del.submissionsTotal} طلباً ومرفقاتها نهائياً. الأفضل إغلاق النموذج بدل حذفه.`, `The form, its ${del.submissionsTotal} requests and their files will be deleted permanently. Closing the form is usually better.`) : L('حذف هذا النموذج نهائياً؟', 'Delete this form permanently?')}</p>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDel(null)}>{L('إلغاء', 'Cancel')}</Button><Button variant="danger" onClick={remove}>{L('حذف نهائي', 'Delete')}</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============================================================================================ submissions
interface SubRow { id: number; reference: string; formId: number; applicantName: string | null; applicantEmail: string | null; applicantPhone: string | null; status: string; category: string | null; isRead: boolean; createdAt: string; anonymizedAt: string | null; form: { id: number; titleAr: string; titleEn: string | null } | null }
interface SubFull extends SubRow {
  fields: FieldDef[]; answers: Record<string, any>; statuses: Status[]; categories: Cat[]; staffNotes: string | null; filesHidden: boolean;
  files: { id: number; fieldKey: string; name: string; size: number; path: string }[];
  messages: { id: number; subject: string; body: string; delivered: boolean; createdAt: string; sentByName: string | null }[];
}

function SubmissionDialog({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const L = useL();
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [s, setS] = useState<SubFull | null>(null);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const r = await api<SubFull>(`/admin/forms/submissions/${id}`); setS(r); setStatus(r.status); setCategory(r.category ?? ''); setNotes(r.staffNotes ?? ''); onChanged(); } catch (e: any) { toast(e.message, 'err'); onClose(); }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    try { await api(`/admin/forms/submissions/${id}`, { method: 'PATCH', body: { status, category: category || null, staffNotes: notes } }); toast(L('تم الحفظ', 'Saved')); await load(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const send = async () => {
    setBusy(true);
    try { await api(`/admin/forms/submissions/${id}/contact`, { method: 'POST', body: { subject, body } }); toast(L('أُرسلت الرسالة', 'Message sent')); setSubject(''); setBody(''); await load(); } catch (e: any) { toast(e.message, 'err'); await load(); } finally { setBusy(false); }
  };
  const erase = async () => {
    if (!window.confirm(L('مسح البيانات الشخصية والمرفقات لهذا الطلب نهائياً؟', 'Erase this request’s personal data and files permanently?'))) return;
    try { await api(`/admin/forms/submissions/${id}/anonymize`, { method: 'POST' }); toast(L('تم المسح', 'Erased')); await load(); } catch (e: any) { toast(e.message, 'err'); }
  };
  const getFile = async (f: { path: string; name: string }) => { try { await download(`/files/${f.path}`, {}, f.name); } catch (e: any) { toast(e.message, 'err'); } };

  const show = (f: FieldDef, v: any) => {
    if (v === undefined || v === null || v === '') return '—';
    const lab = (x: string) => { const o = f.options?.find((y) => y.value === x); return o ? (lang === 'en' && o.en ? o.en : o.ar) : x; };
    if (Array.isArray(v)) return v.map(lab).join('، ');
    if (typeof v === 'boolean') return v ? L('نعم', 'Yes') : L('لا', 'No');
    return f.type === 'select' || f.type === 'radio' ? lab(String(v)) : String(v);
  };

  return (
    <Modal open onClose={onClose} title={s ? `${s.reference} — ${s.form?.titleAr ?? ''}` : '…'} wide>
      {!s ? <Center><Spinner /></Center> : (
        <div className="space-y-5">
          {s.anonymizedAt && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{L('مُسحت البيانات الشخصية لهذا الطلب بناءً على طلب.', 'This request’s personal data was erased.')}</p>}
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {s.fields.filter((f) => f.type !== 'heading' && f.type !== 'note' && f.type !== 'file').map((f) => (
              <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}><dt className="text-xs text-gray-500">{(lang === 'en' && f.labelEn) || f.labelAr}{f.sensitive && <span className="ms-1 text-[10px] text-red-600">🔒</span>}</dt><dd className="whitespace-pre-wrap font-semibold">{show(f, s.answers[f.key])}</dd></div>
            ))}
          </dl>
          <div>
            <h3 className="mb-2 text-sm font-bold">{L('المرفقات', 'Attachments')}</h3>
            {s.filesHidden && <p className="text-sm text-gray-500">{L('المرفقات مخفية: تلزم صلاحية «عرض الحقول الحساسة والمرفقات».', 'Attachments are hidden: the sensitive-data permission is needed.')}</p>}
            {!s.filesHidden && s.files.length === 0 && <p className="text-sm text-gray-500">—</p>}
            {s.files.length > 0 && <ul className="divide-y divide-line rounded-xl border border-line">{s.files.map((f) => <li key={f.id} className="flex items-center gap-3 p-2.5 text-sm"><span className="min-w-0 flex-1 truncate">{f.name} <span className="text-xs text-gray-500">({s.fields.find((x) => x.key === f.fieldKey)?.labelAr ?? f.fieldKey})</span></span><span className="text-xs text-gray-500">{kb(f.size)}</span><Button size="sm" variant="outline" onClick={() => getFile(f)}>{L('تنزيل', 'Download')}</Button></li>)}</ul>}
          </div>
          {can('forms.submissions.update') && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={L('الحالة', 'Status')}><select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>{s.statuses.map((x) => <option key={x.key} value={x.key}>{(lang === 'en' && x.en) || x.ar}</option>)}</select></Field>
              <Field label={L('التصنيف', 'Category')}><select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">—</option>{s.categories.map((x) => <option key={x.key} value={x.key}>{(lang === 'en' && x.en) || x.ar}</option>)}</select></Field>
              <div className="sm:col-span-2"><Field label={L('ملاحظات داخلية', 'Internal notes')}><textarea rows={3} maxLength={5000} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
              <div className="flex justify-end sm:col-span-2"><Button disabled={busy} onClick={save}>{L('حفظ', 'Save')}</Button></div>
            </div>
          )}
          {can('forms.submissions.contact') && (
            <div className="space-y-2 rounded-2xl bg-canvas p-3">
              <h3 className="text-sm font-bold">{L('مراسلة صاحب الطلب', 'Contact the applicant')} {s.applicantEmail ? <span dir="ltr" className="text-xs font-normal text-gray-500">({s.applicantEmail})</span> : <span className="text-xs font-normal text-red-600">{L('لا يوجد بريد', 'no e-mail')}</span>}</h3>
              {s.applicantPhone && <p className="text-xs">{L('الهاتف', 'Phone')}: <a dir="ltr" className="font-bold text-primary" href={`tel:${s.applicantPhone}`}>{s.applicantPhone}</a></p>}
              {s.applicantEmail && (
                <>
                  <input className={inputCls} placeholder={L('الموضوع', 'Subject')} value={subject} maxLength={255} onChange={(e) => setSubject(e.target.value)} />
                  <textarea rows={3} className={inputCls} placeholder={L('نص الرسالة', 'Message')} value={body} maxLength={10000} onChange={(e) => setBody(e.target.value)} />
                  <div className="flex justify-end"><Button disabled={busy || subject.length < 2 || body.length < 2} onClick={send}>{L('إرسال', 'Send')}</Button></div>
                </>
              )}
              {s.messages.length > 0 && <ul className="space-y-1 text-xs">{s.messages.map((m) => <li key={m.id} className="rounded-lg bg-white p-2 ring-1 ring-line"><b>{m.subject}</b> <span className="text-gray-500">· {fmtDate(lang, m.createdAt, true)} · {m.sentByName ?? ''} · {m.delivered ? '✓' : L('لم تُسلَّم', 'not delivered')}</span><p className="mt-1 whitespace-pre-wrap">{m.body}</p></li>)}</ul>}
            </div>
          )}
          {can('forms.submissions.delete') && !s.anonymizedAt && <div className="flex justify-start"><Button variant="danger" size="sm" onClick={erase}>{L('مسح البيانات الشخصية (طلب صاحب البيانات)', 'Erase personal data (data-subject request)')}</Button></div>}
        </div>
      )}
    </Modal>
  );
}

export function FormSubmissionsAdmin() {
  const L = useL();
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [forms, setForms] = useState<FormDef[]>([]);
  const [formId, setFormId] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [key, setKey] = useState(0);
  useEffect(() => { api<FormDef[]>('/admin/forms').then(setForms).catch((e) => toast(e.message, 'err')); }, [toast]);

  const scope = formId ? forms.filter((f) => String(f.id) === formId) : forms;
  const statuses = new Map<string, Status>();
  const cats = new Map<string, Cat>();
  for (const f of scope) { f.statuses.forEach((s) => !statuses.has(s.key) && statuses.set(s.key, s)); f.categories.forEach((c) => !cats.has(c.key) && cats.set(c.key, c)); }
  const stName = (k: string, fid: number) => { const s = forms.find((f) => f.id === fid)?.statuses.find((x) => x.key === k); return { label: s ? (lang === 'en' && s.en) || s.ar : k, color: s?.color }; };
  const catName = (k: string | null, fid: number) => { const c = forms.find((f) => f.id === fid)?.categories.find((x) => x.key === k); return c ? (lang === 'en' && c.en) || c.ar : k ?? ''; };
  const title = (r: SubRow) => (lang === 'en' && r.form?.titleEn) || r.form?.titleAr || '';

  const cols: Col<SubRow>[] = [
    { key: 'reference', searchable: false, label: '#', render: (r) => <span dir="ltr" className={r.isRead ? '' : 'font-extrabold'}>{!r.isRead && <span className="me-1 inline-block h-2 w-2 rounded-full bg-red-600" />}{r.reference}</span>, text: (r) => r.reference },
    { key: 'form', label: L('النموذج', 'Form'), render: title, text: title },
    { key: 'applicantName', label: L('الاسم', 'Name'), render: (r) => r.applicantName ?? '—' },
    { key: 'applicantEmail', label: L('البريد', 'E-mail'), render: (r) => <span dir="ltr">{r.applicantEmail ?? '—'}</span> },
    { key: 'status', searchable: false, label: L('الحالة', 'Status'), render: (r) => { const s = stName(r.status, r.formId); return <span className="rounded px-1.5 py-0.5 text-[10px]" style={chip(s.color)}>{s.label}</span>; }, text: (r) => stName(r.status, r.formId).label },
    { key: 'category', searchable: false, label: L('التصنيف', 'Category'), render: (r) => catName(r.category, r.formId) || '—', text: (r) => catName(r.category, r.formId) },
    { key: 'createdAt', type: 'date', label: L('التاريخ', 'Date'), render: (r) => fmtDate(lang, r.createdAt, true), text: (r) => r.createdAt },
  ];

  return (
    <>
      <DataTable<SubRow>
        key={formId} endpoint="/admin/forms/submissions" columns={cols} dateFilter refreshKey={key} exportable={can('forms.submissions.export')} exportName="form-submissions"
        baseParams={formId ? { formId } : undefined}
        filters={[
          { key: 'status', label: L('الحالة', 'Status'), options: [...statuses.values()].map((s) => ({ value: s.key, label: (lang === 'en' && s.en) || s.ar })) },
          { key: 'category', label: L('التصنيف', 'Category'), options: [...cats.values()].map((c) => ({ value: c.key, label: (lang === 'en' && c.en) || c.ar })) },
          { key: 'unread', label: L('القراءة', 'Read'), options: [{ value: 'true', label: L('غير مقروء فقط', 'Unread only') }] },
        ]}
        bulkDelete={{ path: '/admin/forms/submissions/bulk-delete', can: can('forms.submissions.delete') }}
        toolbar={
          <select className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm" aria-label={L('النموذج', 'Form')} value={formId} onChange={(e) => setFormId(e.target.value)}>
            <option value="">{L('كل النماذج', 'All forms')}</option>{forms.map((f) => <option key={f.id} value={f.id}>{(lang === 'en' && f.titleEn) || f.titleAr}</option>)}
          </select>
        }
        rowActions={(r) => <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)}>{L('فتح', 'Open')}</Button>}
      />
      {openId !== null && <SubmissionDialog id={openId} onClose={() => setOpenId(null)} onChanged={() => setKey((k) => k + 1)} />}
    </>
  );
}

// ============================================================================================ backups
interface Backup { id: string; createdAt: string; trigger: string; by: string | null; ok: boolean; tables?: number; rows?: number; dbBytes?: number; filesFile?: string | null; filesBytes?: number; filesNote?: string; encrypted: boolean; durationMs: number }
interface BackupStatus { dir: string; running: boolean; encrypted: boolean; automatic: boolean; intervalHours: number; keep: number; filesDriver: string }

export function BackupsAdmin() {
  const L = useL();
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<{ status: BackupStatus; data: Backup[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api<{ status: BackupStatus; data: Backup[] }>('/admin/backups').then(setData).catch((e) => toast(e.message, 'err')); }, [toast]);
  useEffect(load, [load]);
  const create = async () => { setBusy(true); try { await api('/admin/backups', { method: 'POST' }); toast(L('تم إنشاء النسخة الاحتياطية', 'Backup created')); load(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const get = async (b: Backup, kind: 'db' | 'files') => { try { await download(`/admin/backups/${b.id}/${kind}`, {}, `${b.id}.${kind === 'db' ? 'json.gz' : 'files.tar.gz'}`); } catch (e: any) { toast(e.message, 'err'); } };
  const del = async (b: Backup) => { if (!window.confirm(L('حذف هذه النسخة؟', 'Delete this backup?'))) return; try { await api(`/admin/backups/${b.id}`, { method: 'DELETE' }); load(); } catch (e: any) { toast(e.message, 'err'); } };
  if (!data) return <Center><Spinner /></Center>;
  const st = data.status;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-canvas p-4 text-sm leading-7">
        <p>{st.automatic ? L(`نسخ تلقائي كل ${st.intervalHours} ساعة، ويُحتفظ بآخر ${st.keep} نسخة.`, `Automatic backup every ${st.intervalHours} h; the last ${st.keep} are kept.`) : L('النسخ التلقائي متوقف (BACKUP_ENABLED=false).', 'Automatic backup is off (BACKUP_ENABLED=false).')}</p>
        <p>{st.encrypted ? L('🔒 الملفات مشفّرة (BACKUP_ENCRYPTION_KEY).', '🔒 Files are encrypted (BACKUP_ENCRYPTION_KEY).') : <span className="text-red-700">{L('⚠ الملفات غير مشفّرة وتحتوي بيانات شخصية: عيّن BACKUP_ENCRYPTION_KEY.', '⚠ Files are NOT encrypted and hold personal data: set BACKUP_ENCRYPTION_KEY.')}</span>}</p>
        <p className="text-xs text-gray-600">{L('انسخ هذه الملفات دورياً خارج الخادم. الاستعادة تتم بأمر (npm run backup:restore) لأنها تستبدل كل البيانات.', 'Copy these files off the server regularly. Restoring is a command (npm run backup:restore) because it replaces all data.')}</p>
        {st.filesDriver !== 'local' && <p className="text-xs text-gray-600">{L('الملفات المرفوعة على التخزين السحابي S3: فعّل الإصدارات/النسخ المتكرر في الحاوية نفسها.', 'Uploaded files live in S3: enable versioning / replication on the bucket itself.')}</p>}
      </div>
      {can('backups.create') && <Button disabled={busy || st.running} onClick={create}>{busy ? L('جارٍ النسخ…', 'Backing up…') : L('إنشاء نسخة احتياطية الآن', 'Back up now')}</Button>}
      <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-xs text-gray-600"><tr><th className="p-3 text-start">{L('النسخة', 'Backup')}</th><th className="p-3 text-start">{L('التاريخ', 'Date')}</th><th className="p-3 text-start">{L('المحتوى', 'Content')}</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-line bg-white">
            {data.data.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-500">{L('لا توجد نسخ', 'No backups yet')}</td></tr>}
            {data.data.map((b) => (
              <tr key={b.id}>
                <td className="p-3"><span dir="ltr" className="text-xs">{b.id}</span><br /><span className="text-xs text-gray-500">{b.trigger === 'manual' ? `${L('يدوي', 'Manual')}${b.by ? ` — ${b.by}` : ''}` : L('تلقائي', 'Automatic')}</span></td>
                <td className="p-3">{fmtDate(lang, b.createdAt, true)}</td>
                <td className="p-3 text-xs">{b.ok ? <>{b.tables} {L('جدول', 'tables')} · {b.rows} {L('سجل', 'rows')} · {kb(b.dbBytes ?? 0)}{b.filesFile ? ` · ${L('الملفات', 'files')} ${kb(b.filesBytes ?? 0)}` : b.filesNote ? ` · ${b.filesNote}` : ''}</> : <span className="text-red-600">{L('فشلت', 'Failed')}</span>}</td>
                <td className="p-3"><span className="flex flex-wrap justify-end gap-1">
                  {b.ok && can('backups.download') && <Button size="sm" variant="outline" onClick={() => get(b, 'db')}>{L('قاعدة البيانات', 'Database')}</Button>}
                  {b.ok && b.filesFile && can('backups.download') && <Button size="sm" variant="outline" onClick={() => get(b, 'files')}>{L('الملفات', 'Files')}</Button>}
                  {can('backups.delete') && <Button size="sm" variant="danger" onClick={() => del(b)}>{L('حذف', 'Delete')}</Button>}
                </span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
