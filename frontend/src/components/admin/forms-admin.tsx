'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { mayOnForms, type SubAction } from '@/lib/form-pages';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Center, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm';
import { Col, DataTable } from '@/components/admin/data-table';
import { DynamicForm, FieldDef, FieldOption, PublicForm, isShown } from '@/components/site/dynamic-form';

interface Status { key: string; ar: string; en?: string; color?: string }
interface Cat { key: string; ar: string; en?: string }
interface Hook { name: string; url: string; secret?: string; events: string[]; enabled: boolean; hasSecret?: boolean; keepSecret?: boolean }
interface FormDef {
  id: number; slug: string; titleAr: string; titleEn: string | null; descriptionAr: string | null; descriptionEn: string | null; successAr: string | null; successEn: string | null;
  isOpen: boolean; isListed: boolean; fields: FieldDef[]; statuses: Status[]; categories: Cat[]; notifyEmails: string | null; sendReceipt: boolean; requireConsent: boolean;
  retentionDays: number | null; integrations: Hook[]; version: number; contextType?: string | null; dedupe?: string | null; submissionsTotal?: number; submissionsUnread?: number;
}
const TYPES: [string, string, string][] = [
  ['text', 'نص قصير', 'Short text'], ['textarea', 'نص طويل', 'Long text'], ['number', 'رقم', 'Number'], ['email', 'بريد إلكتروني', 'Email'], ['phone', 'هاتف', 'Phone'], ['url', 'رابط', 'Link'],
  ['date', 'تاريخ', 'Date'], ['select', 'قائمة منسدلة', 'Dropdown'], ['radio', 'اختيار واحد', 'Single choice'], ['multiselect', 'اختيار متعدد', 'Multiple choice'], ['checkbox', 'مربع موافقة', 'Checkbox'],
  ['file', 'مرفق (ملفات)', 'Attachment'], ['heading', 'عنوان قسم', 'Section heading'], ['note', 'نص توضيحي', 'Note'],
];
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^[^a-z]+/, '');
const move = <T,>(a: T[], i: number, d: number) => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return b; [b[i], b[j]] = [b[j], b[i]]; return b; };
/** the course / space / package a request is about */
const ctxText = (c: Record<string, any> | null | undefined) => [c?.courseName, c?.spaceName, c?.packageName].filter(Boolean).join(' · ');
const chip = (color?: string) => ({ backgroundColor: `${color ?? '#64748b'}22`, color: color ?? '#475569' });

function useL() {
  const { lang } = useI18n();
  return (ar: string, en: string) => (lang === 'ar' ? ar : en);
}

// ============================================================================================ field editor
const OPTION_TYPES = ['select', 'radio', 'multiselect'];
const LAYOUT_TYPES = ['heading', 'note'];
const IDENTITY_ROLE_TYPES = ['text', 'email', 'phone'];

/** a condition can only look at an earlier field that still exists: drop the ones a delete / move made invalid, so the server never refuses the list for it */
function tidy(fields: FieldDef[]): FieldDef[] {
  return fields.map((f, i) => {
    if (!f.showIf) return f;
    const at = fields.findIndex((x) => x.key === f.showIf!.key);
    if (at < 0 || at >= i) { const { showIf: _s, ...rest } = f; return rest; }
    return f;
  });
}

/** Add, delete and edit the inputs of a form; each input has a type, a label (Arabic / English), required or not, and its options when it is a choice. */
function FieldEditor({ fields, onChange }: { fields: FieldDef[]; onChange: (f: FieldDef[]) => void }) {
  const L = useL();
  const confirm = useConfirm();
  const { lang } = useI18n();
  const set = (next: FieldDef[]) => onChange(tidy(next));
  const upd = (i: number, p: Partial<FieldDef>) => set(fields.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const add = (type: string) => {
    let n = fields.length + 1;
    while (fields.some((f) => f.key === `${type}_${n}`)) n++;
    const f: FieldDef = { key: `${type}_${n}`, type, labelAr: '' };
    if (OPTION_TYPES.includes(type)) f.options = [{ value: 'option_1', ar: '' }];
    if (type === 'file') { f.fileKinds = ['pdf', 'image']; f.maxFiles = 1; f.maxSizeMb = 5; }
    set([...fields, f]);
  };
  const changeType = (i: number, type: string) => {
    const f = fields[i];
    const p: Partial<FieldDef> = { type };
    if (OPTION_TYPES.includes(type) && !f.options?.length && !f.optionsSource) p.options = [{ value: 'option_1', ar: '' }];
    if (type === 'file') { p.fileKinds = f.fileKinds ?? ['pdf', 'image']; p.maxFiles = f.maxFiles ?? 1; p.maxSizeMb = f.maxSizeMb ?? 5; }
    upd(i, p);
  };
  const remove = async (i: number) => {
    const f = fields[i];
    if (f.role && !(await confirm({ danger: true, message: L('هذا الحقل يحدد هوية المتقدم (الاسم أو البريد أو الهاتف)، وحذفه يعطّل المراسلة أو العرض في القوائم. متأكد من الحذف؟', 'This input identifies the applicant (name, e-mail or phone); deleting it disables contacting them or showing them in lists. Delete anyway?') }))) return;
    set(fields.filter((_, j) => j !== i));
  };
  const setOpt = (i: number, k: number, p: Partial<FieldOption>) => upd(i, { options: fields[i].options!.map((o, j) => (j === k ? { ...o, ...p } : o)) });

  return (
    <div className="space-y-3">
      {fields.length === 0 && <p className="rounded-xl bg-canvas p-4 text-center text-sm text-gray-500">{L('لا توجد حقول. أضف أول حقل من الأزرار أدناه.', 'No inputs yet. Add the first one with the buttons below.')}</p>}
      {fields.map((f, i) => {
        const layout = LAYOUT_TYPES.includes(f.type);
        const locked = !!f.role; // identifies the applicant: its kind of input cannot change
        return (
          <div key={f.key} className="space-y-2 rounded-2xl border border-line bg-white p-3">
            <div className="grid gap-2 sm:grid-cols-[11rem_1fr_1fr_auto]">
              <select className={inputCls} aria-label={L('نوع الحقل', 'Input type')} value={f.type} disabled={locked && !IDENTITY_ROLE_TYPES.includes(f.type)} onChange={(e) => changeType(i, e.target.value)}
                title={locked ? L('هذا الحقل يحدد هوية المتقدم: يمكن تغيير نوعه بين نص وبريد وهاتف فقط', 'Identifies the applicant: its type can only change between text, e-mail and phone') : undefined}>
                {TYPES.filter((t) => !locked || IDENTITY_ROLE_TYPES.includes(t[0])).map((t) => <option key={t[0]} value={t[0]}>{t[lang === 'ar' ? 1 : 2]}</option>)}
              </select>
              <input className={inputCls} placeholder={L('العنوان بالعربية', 'Label (Arabic)')} value={f.labelAr} maxLength={300} onChange={(e) => upd(i, { labelAr: e.target.value })} />
              <input dir="ltr" className={inputCls} placeholder={L('العنوان بالإنكليزية', 'Label (English)')} value={f.labelEn ?? ''} maxLength={300} onChange={(e) => upd(i, { labelEn: e.target.value })} />
              <span className="flex items-center gap-1">
                <Button size="sm" variant="ghost" type="button" aria-label="up" onClick={() => set(move(fields, i, -1))}>↑</Button>
                <Button size="sm" variant="ghost" type="button" aria-label="down" onClick={() => set(move(fields, i, 1))}>↓</Button>
                <Button size="sm" variant="danger" type="button" onClick={() => remove(i)}>{L('حذف', 'Delete')}</Button>
              </span>
            </div>
            {!layout && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.required} onChange={(e) => upd(i, { required: e.target.checked })} />{L('مطلوب', 'Required')}</label>}
            {f.optionsSource && <p className="text-xs text-gray-500">{L('خيارات هذه القائمة تأتي من سجلات النظام (المساحات / الباقات)، لا تُكتب هنا.', 'The options of this list come from the system records (spaces / packages); they are not typed here.')}</p>}
            {OPTION_TYPES.includes(f.type) && !f.optionsSource && (
              <div className="space-y-2">
                {(f.options ?? []).map((o, k) => (
                  <div key={k} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input className={inputCls} placeholder={L('نص الخيار بالعربية', 'Option (Arabic)')} value={o.ar} maxLength={200} onChange={(e) => setOpt(i, k, { ar: e.target.value })} />
                    <input dir="ltr" className={inputCls} placeholder={L('نص الخيار بالإنكليزية', 'Option (English)')} value={o.en ?? ''} maxLength={200} onChange={(e) => setOpt(i, k, { en: e.target.value })} />
                    <Button size="sm" variant="danger" type="button" disabled={(f.options?.length ?? 0) < 2} onClick={() => upd(i, { options: f.options!.filter((_, j) => j !== k) })}>×</Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" type="button" onClick={() => {
                  let n = (f.options?.length ?? 0) + 1;
                  while (f.options?.some((o) => o.value === `option_${n}`)) n++;
                  upd(i, { options: [...(f.options ?? []), { value: `option_${n}`, ar: '' }] });
                }}>+ {L('خيار', 'Option')}</Button>
              </div>
            )}
            {f.type === 'file' && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {([['image', L('صور', 'Images')], ['pdf', 'PDF'], ['doc', 'Word']] as const).map(([k, name]) => (
                  <label key={k} className="flex items-center gap-1"><input type="checkbox" checked={!!f.fileKinds?.includes(k)} onChange={(e) => upd(i, { fileKinds: e.target.checked ? [...(f.fileKinds ?? []), k] : (f.fileKinds ?? []).filter((x) => x !== k) })} />{name}</label>
                ))}
                <label className="flex items-center gap-2">{L('عدد الملفات', 'Files')}<input type="number" min={1} max={10} className="w-16 rounded-lg border border-line px-2 py-1" value={f.maxFiles ?? 1} onChange={(e) => upd(i, { maxFiles: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} /></label>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2 rounded-2xl bg-canvas p-3">
        <span className="w-full text-xs font-bold text-gray-600">{L('إضافة حقل جديد (اختر نوعه)', 'Add a new input (pick its type)')}</span>
        {TYPES.map((t) => <Button key={t[0]} size="sm" variant="outline" type="button" onClick={() => add(t[0])}>+ {t[lang === 'ar' ? 1 : 2]}</Button>)}
      </div>
    </div>
  );
}

// ============================================================================================ edit dialog: inputs + live form
/** The two things a manager does with a form: change its inputs, and try it (fill it in and send it) exactly as a visitor sees it. */
function FormDialog({ initial, onClose, onSaved }: { initial: FormDef; onClose: () => void; onSaved: () => void }) {
  const L = useL();
  const { lang } = useI18n();
  const toast = useToast();
  const { can } = useAuth();
  const [fields, setFields] = useState<FieldDef[]>(initial.fields);
  const [tab, setTab] = useState<'fields' | 'try'>('fields');
  const [busy, setBusy] = useState(false);
  const canEdit = can('forms.update');
  const dirty = JSON.stringify(fields) !== JSON.stringify(initial.fields);

  const save = async () => {
    setBusy(true);
    try {
      await api(`/admin/forms/${initial.id}`, { method: 'PATCH', body: { fields: fields.map((f) => ({ ...f, labelAr: f.labelAr.trim() })) } });
      toast(L('تم الحفظ بنجاح', 'Saved'));
      onSaved();
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const preview: PublicForm = {
    slug: initial.slug, titleAr: initial.titleAr, titleEn: initial.titleEn, isOpen: true, requireConsent: initial.requireConsent, contextType: initial.contextType,
    // no real records in the editor: a list that is filled from the system (spaces, packages ...) shows one placeholder instead of the data
    fields: fields.map((f) => (f.optionsSource ? { ...f, options: [{ value: '', ar: '(تُعبَّأ تلقائياً من سجلات النظام)', en: '(filled automatically from the system records)' }] } : f)),
  };

  return (
    <Modal open onClose={onClose} title={`${L('تعديل النموذج', 'Edit form')}: ${(lang === 'en' && initial.titleEn) || initial.titleAr}`} wide closeOnBackdrop={false}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1 border-b border-line pb-2">
          <button type="button" onClick={() => setTab('fields')} className={`rounded-lg px-3 py-1.5 text-sm ${tab === 'fields' ? 'bg-primary text-white' : 'bg-canvas text-gray-700'}`}>{L('الحقول', 'Inputs')} ({fields.length})</button>
          <button type="button" onClick={() => setTab('try')} className={`rounded-lg px-3 py-1.5 text-sm ${tab === 'try' ? 'bg-primary text-white' : 'bg-canvas text-gray-700'}`}>{L('النموذج كما يراه الزائر', 'The form as visitors see it')}</button>
        </div>
        {tab === 'fields' && (canEdit ? <FieldEditor fields={fields} onChange={setFields} /> : <p className="text-sm text-gray-500">{L('ليست لديك صلاحية تعديل النماذج.', 'You cannot edit forms.')}</p>)}
        {tab === 'try' && (
          <div className="space-y-3">
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800">
              {L('هذه معاينة لشكل النموذج بحقوله الحالية فقط: الحقول معطّلة ولا تحتوي أي بيانات، ولا يمكن تعبئتها أو إرسال النموذج من هنا.', 'This is a preview of the form with its current inputs only: the inputs are disabled and empty, and the form cannot be filled in or sent from here.')}
              {dirty && <b className="block text-red-700">{L('لديك تعديلات غير محفوظة: احفظها لتصبح في النموذج الذي يراه الزوّار.', 'You have unsaved changes: save them so they appear in the form visitors see.')}</b>}
            </p>
            <DynamicForm key={JSON.stringify(preview.fields).length} form={preview} preview />
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="outline" onClick={onClose}>{L('إغلاق', 'Close')}</Button>
          {canEdit && <Button disabled={busy || !dirty} onClick={save}>{L('حفظ', 'Save')}</Button>}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================================ forms list
export function FormsBuilderAdmin() {
  const L = useL();
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState<FormDef[] | null>(null);
  const [edit, setEdit] = useState<FormDef | null>(null);
  const load = useCallback(() => { api<FormDef[]>('/admin/forms').then(setRows).catch((e) => toast(e.message, 'err')); }, [toast]);
  useEffect(load, [load]);

  const open = async (r: FormDef) => { try { setEdit(await api<FormDef>(`/admin/forms/${r.id}`)); } catch (e: any) { toast(e.message, 'err'); } };
  if (!rows) return <Center><Spinner /></Center>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{L('اختر نموذجاً لإضافة حقول جديدة أو حذف حقول أو تعديلها، مع اختيار نوع كل حقل.', 'Pick a form to add, delete or edit its inputs and choose the type of each.')}</p>
      <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-xs text-gray-600"><tr><th className="p-3 text-start">{L('النموذج', 'Form')}</th><th className="p-3 text-start">{L('الحقول', 'Inputs')}</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-line bg-white">
            {rows.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-gray-500">{L('لا توجد نماذج', 'No forms')}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-bold">{(lang === 'en' && r.titleEn) || r.titleAr}</td>
                <td className="p-3">{r.fields.filter((f) => !LAYOUT_TYPES.includes(f.type)).length}</td>
                <td className="p-3 text-end"><Button size="sm" variant="outline" onClick={() => open(r)}>{can('forms.update') ? L('تعديل', 'Edit') : L('عرض', 'View')}</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <FormDialog initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

// ============================================================================================ submissions
interface SubRow { context: Record<string, any> | null; id: number; reference: string; formId: number; applicantName: string | null; applicantEmail: string | null; applicantPhone: string | null; status: string; category: string | null; isRead: boolean; createdAt: string; anonymizedAt: string | null; form: { id: number; titleAr: string; titleEn: string | null } | null }
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
  const confirm = useConfirm();
  const [s, setS] = useState<SubFull | null>(null);
  // the page's own permission is enough to handle its requests (see lib/form-pages.ts)
  const may = (a: SubAction) => mayOnForms(can, (s as any)?.form?.slug ? [(s as any).form.slug] : undefined, a);
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
    if (!(await confirm({ danger: true, confirmLabel: L('مسح', 'Erase'), message: L('مسح البيانات الشخصية والمرفقات لهذا الطلب نهائياً؟', 'Erase this request’s personal data and files permanently?') }))) return;
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
          {ctxText(s.context) && <p className="rounded-xl bg-primary/5 p-3 text-sm"><b>{L('مرتبط بـ', 'Linked to')}:</b> {ctxText(s.context)}</p>}
          {/* the request is shown inside the form's own inputs, filled with what the applicant wrote (read only) */}
          <div className="grid gap-3 sm:grid-cols-2">
            {s.fields.filter((f) => f.type !== 'file' && isShown(f, s.answers)).map((f) => {
              const label = (lang === 'en' && f.labelEn) || f.labelAr;
              if (f.type === 'heading') return <h3 key={f.key} className="border-s-4 border-accent ps-3 pt-2 text-sm font-bold text-secondary sm:col-span-2">{label}</h3>;
              if (f.type === 'note') return <p key={f.key} className="rounded-xl bg-canvas p-3 text-xs text-gray-600 sm:col-span-2">{label}</p>;
              const v = s.answers[f.key];
              if (f.type === 'checkbox') return <label key={f.key} className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" disabled checked={v === true} />{label}</label>;
              const text = v === undefined || v === null || v === '' ? '' : show(f, v);
              return (
                <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <Field label={`${label}${f.sensitive ? ' 🔒' : ''}`}>
                    {f.type === 'textarea'
                      ? <textarea readOnly rows={Math.min(8, Math.max(2, text.split('\n').length + 1))} className={`${inputCls} bg-gray-50`} value={text} />
                      : <input readOnly className={`${inputCls} bg-gray-50`} dir={['email', 'url', 'phone', 'number', 'date'].includes(f.type) ? 'ltr' : undefined} value={text} />}
                  </Field>
                </div>
              );
            })}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">{L('المرفقات', 'Attachments')}</h3>
            {s.filesHidden && <p className="text-sm text-gray-500">{L('المرفقات مخفية: تلزم صلاحية «عرض الحقول الحساسة والمرفقات».', 'Attachments are hidden: the sensitive-data permission is needed.')}</p>}
            {!s.filesHidden && s.files.length === 0 && <p className="text-sm text-gray-500">—</p>}
            {s.files.length > 0 && <ul className="divide-y divide-line rounded-xl border border-line">{s.files.map((f) => <li key={f.id} className="flex items-center gap-3 p-2.5 text-sm"><span className="min-w-0 flex-1 truncate">{f.name} <span className="text-xs text-gray-500">({s.fields.find((x) => x.key === f.fieldKey)?.labelAr ?? f.fieldKey})</span></span><span className="text-xs text-gray-500">{kb(f.size)}</span><Button size="sm" variant="outline" onClick={() => getFile(f)}>{L('تنزيل', 'Download')}</Button></li>)}</ul>}
          </div>
          {may('update') && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={L('الحالة', 'Status')}><select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>{s.statuses.map((x) => <option key={x.key} value={x.key}>{(lang === 'en' && x.en) || x.ar}</option>)}</select></Field>
              <Field label={L('التصنيف', 'Category')}><select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">—</option>{s.categories.map((x) => <option key={x.key} value={x.key}>{(lang === 'en' && x.en) || x.ar}</option>)}</select></Field>
              <div className="sm:col-span-2"><Field label={L('ملاحظات داخلية', 'Internal notes')}><textarea rows={3} maxLength={5000} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
              <div className="flex justify-end sm:col-span-2"><Button disabled={busy} onClick={save}>{L('حفظ', 'Save')}</Button></div>
            </div>
          )}
          {may('contact') && (
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
          {may('delete') && !s.anonymizedAt && <div className="flex justify-start"><Button variant="danger" size="sm" onClick={erase}>{L('مسح البيانات الشخصية (طلب صاحب البيانات)', 'Erase personal data (data-subject request)')}</Button></div>}
        </div>
      )}
    </Modal>
  );
}

export function FormSubmissionsAdmin({ slugs }: { slugs?: string[] } = {}) {
  const L = useL();
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [forms, setForms] = useState<FormDef[]>([]);
  const [formId, setFormId] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [key, setKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // the forms of this page only (the server sends no more than the person may handle), without the form builder's data
  useEffect(() => { api<FormDef[]>('/admin/forms/for-requests', { params: { slugs: slugs?.join(',') } }).then((all) => { setForms(all); setLoaded(true); }).catch((e) => toast(e.message, 'err')); }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const scope = formId ? forms.filter((f) => String(f.id) === formId) : forms;
  const idsParam = !formId && slugs ? forms.map((f) => f.id).join(',') : '';
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
    { key: 'context', searchable: false, label: L('مرتبط بـ', 'Linked to'), render: (r) => ctxText(r.context) || '—', text: (r) => ctxText(r.context) },
    { key: 'status', searchable: false, label: L('الحالة', 'Status'), render: (r) => { const s = stName(r.status, r.formId); return <span className="rounded px-1.5 py-0.5 text-[10px]" style={chip(s.color)}>{s.label}</span>; }, text: (r) => stName(r.status, r.formId).label },
    { key: 'category', searchable: false, label: L('التصنيف', 'Category'), render: (r) => catName(r.category, r.formId) || '—', text: (r) => catName(r.category, r.formId) },
    { key: 'createdAt', type: 'date', label: L('التاريخ', 'Date'), render: (r) => fmtDate(lang, r.createdAt, true), text: (r) => r.createdAt },
  ];

  if (slugs && !loaded) return <Center><Spinner /></Center>;
  if (slugs && forms.length === 0) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{L('نموذج هذه الصفحة غير موجود. شغّل ترحيل قاعدة البيانات (migration:run) ثم أعد المحاولة.', 'The form of this page does not exist. Run the database migration (migration:run) and try again.')}</p>;
  return (
    <>
      <DataTable<SubRow>
        key={`${formId}|${idsParam}`} endpoint="/admin/forms/submissions" columns={cols} dateFilter refreshKey={key} exportable={mayOnForms(can, slugs, 'export')} exportName="form-submissions"
        baseParams={formId ? { formId } : idsParam ? { formIds: idsParam } : undefined}
        filters={[
          { key: 'status', label: L('الحالة', 'Status'), options: [...statuses.values()].map((s) => ({ value: s.key, label: (lang === 'en' && s.en) || s.ar })) },
          { key: 'category', label: L('التصنيف', 'Category'), options: [...cats.values()].map((c) => ({ value: c.key, label: (lang === 'en' && c.en) || c.ar })) },
          { key: 'unread', label: L('القراءة', 'Read'), options: [{ value: 'true', label: L('غير مقروء فقط', 'Unread only') }] },
        ]}
        bulkDelete={{ path: '/admin/forms/submissions/bulk-delete', can: mayOnForms(can, slugs, 'delete') }}
        toolbar={(slugs && forms.length < 2) ? undefined : (
          <select className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm" aria-label={L('النموذج', 'Form')} value={formId} onChange={(e) => setFormId(e.target.value)}>
            <option value="">{L('كل النماذج', 'All forms')}</option>{forms.map((f) => <option key={f.id} value={f.id}>{(lang === 'en' && f.titleEn) || f.titleAr}</option>)}
          </select>
        )}
        rowActions={(r) => <Button size="sm" variant="outline" onClick={() => setOpenId(r.id)}>{L('فتح', 'Open')}</Button>}
      />
      {openId !== null && <SubmissionDialog id={openId} onClose={() => setOpenId(null)} onChanged={() => setKey((k) => k + 1)} />}
    </>
  );
}

// ============================================================================================ backups
interface Backup { id: string; createdAt: string; trigger: string; by: string | null; ok: boolean; tables?: number; rows?: number; dbBytes?: number; filesFile?: string | null; filesBytes?: number; filesNote?: string; encrypted: boolean; durationMs: number }
interface BackupStatus { store?: 's3' | 'disk'; persistent?: boolean; dir: string; running: boolean; encrypted: boolean; automatic: boolean; intervalHours: number; keep: number; filesDriver: string }

export function BackupsAdmin() {
  const L = useL();
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<{ status: BackupStatus; data: Backup[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api<{ status: BackupStatus; data: Backup[] }>('/admin/backups').then(setData).catch((e) => toast(e.message, 'err')); }, [toast]);
  useEffect(load, [load]);
  const create = async () => { setBusy(true); try { await api('/admin/backups', { method: 'POST' }); toast(L('تم إنشاء النسخة الاحتياطية', 'Backup created')); load(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); } };
  const get = async (b: Backup, kind: 'db' | 'files', encrypted: boolean) => { try { await download(`/admin/backups/${b.id}/${kind}`, encrypted ? { encrypted: 1 } : {}, kind === 'db' ? `${b.id}${encrypted ? '-encrypted' : ''}.zip` : `${b.id}.files.tar.gz`); } catch (e: any) { toast(e.message, 'err'); } };
  const del = async (b: Backup) => { if (!(await confirm({ danger: true, message: L('حذف هذه النسخة؟', 'Delete this backup?') }))) return; try { await api(`/admin/backups/${b.id}`, { method: 'DELETE' }); load(); } catch (e: any) { toast(e.message, 'err'); } };
  if (!data) return <Center><Spinner /></Center>;
  const st = data.status;
  return (
    <div className="space-y-4">
      {st.persistent === false && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm leading-7 text-red-800 ring-1 ring-red-200">
          <p className="font-bold">{L('⚠ النسخ الاحتياطية تُحفظ على قرص الحاوية المؤقت وتُمحى عند كل إعادة نشر أو إعادة تشغيل.', '⚠ Backups are stored on the container\'s temporary disk and are erased at every redeploy or restart.')}</p>
          <p>{L(`اربط Volume دائماً بالمسار ${st.dir} (أو غيّر BACKUP_DIR إلى مسار مربوط بـ Volume) ثم أعد التشغيل. نزّل نسخك الحالية الآن قبل ذلك.`, `Mount a persistent volume at ${st.dir} (or point BACKUP_DIR at a mounted volume) and restart. Download your current backups first.`)}</p>
        </div>
      )}
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
                <td className="p-3 text-xs">{b.ok ? <>{b.tables} {L('جدول', 'tables')} · {b.rows} {L('سجل', 'rows')} · {kb(b.dbBytes ?? 0)}{b.filesFile ? ` · ${L('الملفات', 'files')} ${kb(b.filesBytes ?? 0)}` : ''}</> : <span className="text-red-600">{L('فشلت', 'Failed')}</span>}</td>
                <td className="p-3"><span className="flex flex-wrap justify-end gap-1">
                  {b.ok && can('backups.download') && <Button size="sm" variant="outline" onClick={() => get(b, 'db', false)}>{L('تنزيل', 'Download')}</Button>}
                  {b.ok && st.encrypted && can('backups.download') && <Button size="sm" variant="outline" onClick={() => get(b, 'db', true)}>{L('تنزيل مشفّر', 'Download encrypted')}</Button>}
                  {b.ok && b.filesFile && can('backups.download') && <Button size="sm" variant="outline" onClick={() => get(b, 'files', false)}>{L('تنزيل الملفات', 'Download files')}</Button>}
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
