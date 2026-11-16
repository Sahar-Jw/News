'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Center, Spinner, inputCls } from '@/components/ui/ui';
import { Pager } from '@/components/site/pager';
import { useToast } from '@/components/ui/toast';

interface Change { table: string; id: number | string | null; op: 'insert' | 'update' | 'remove'; before?: Record<string, unknown>; after?: Record<string, unknown> }
interface Row {
  id: number; category: string; action: string; kind: string; description: string; createdAt: string;
  actor: { fullName: string; email?: string } | null;
  details: Record<string, unknown> | null; changes: Change[] | null;
}
interface Facet { value: string; count: number }
interface Facets { types: Facet[]; actions: Facet[] }
interface Result { data: Row[]; meta: { page: number; total: number; totalPages: number } }

const PAGE_SIZE = 20;

/** names of the modules (the `category` of an entry) and of the actions, Arabic / English; anything not listed is shown in a readable form of its code */
const MODULES: Record<string, [string, string]> = {
  auth: ['تسجيل الدخول والحسابات', 'Sign-in & accounts'], security: ['الأمان', 'Security'], news: ['الأخبار', 'News'], users: ['المستخدمون', 'Users'], permissions: ['الأدوار والصلاحيات', 'Roles & permissions'],
  settings: ['إعدادات الموقع', 'Site settings'], cities: ['المدن', 'Cities'], messages: ['الرسائل', 'Messages'], subscribers: ['المشتركون', 'Subscribers'], ads: ['الإعلانات', 'Ads'], gallery: ['المعرض', 'Gallery'],
  occasions: ['المعارض والفعاليات', 'Exhibitions & events'], faqs: ['الأسئلة الشائعة', 'FAQ'], pages: ['الصفحات الثابتة', 'Static pages'], nav: ['القائمة الرئيسية', 'Main menu'], documents: ['الوثائق والقرارات', 'Documents'],
  services: ['الخدمات', 'Services'], training: ['مركز التدريب', 'Training center'], expo: ['DCC EXPO', 'DCC EXPO'], incubator: ['حاضنة الأعمال', 'Business incubator'], board: ['مجلس الإدارة', 'Board'],
  committees: ['اللجان', 'Committees'], membership: ['الانتساب', 'Membership'], get2trade: ['Get2Trade', 'Get2Trade'], women: ['سيدات الأعمال', 'Businesswomen'], hero: ['الصفحة الرئيسية', 'Home page'],
  mail: ['البريد', 'Mail'], footer: ['التذييل', 'Footer'], shortcuts: ['الاختصارات', 'Shortcuts'], files: ['الملفات', 'Files'], customers: ['العملاء', 'Customers'], appointments: ['المواعيد', 'Appointments'],
  audit: ['سجل التدقيق', 'Audit log'], system: ['النظام', 'System'],
};
const ACTIONS: Record<string, [string, string]> = {
  create: ['إضافة', 'Create'], update: ['تعديل', 'Update'], delete: ['حذف', 'Delete'], read: ['اطلاع', 'View'], export: ['تصدير', 'Export'], login: ['تسجيل دخول', 'Sign in'], logout: ['تسجيل خروج', 'Sign out'],
  'login.failed': ['محاولة دخول فاشلة', 'Failed sign-in'], 'login.inactive': ['دخول بحساب غير مفعّل', 'Inactive account sign-in'], register: ['إنشاء حساب', 'Register'], verify: ['تفعيل', 'Verify'],
  'password.change': ['تغيير كلمة المرور', 'Password change'], 'password.reset': ['إعادة تعيين كلمة المرور', 'Password reset'], 'password.reset.request': ['طلب إعادة تعيين كلمة المرور', 'Password reset request'],
  'password.reset.request.ignored': ['طلب إعادة تعيين غير منفّذ', 'Password reset ignored'], 'profile.update': ['تعديل الملف الشخصي', 'Profile update'], 'profile.avatar': ['تغيير الصورة الشخصية', 'Avatar change'], 'profile.cv': ['رفع السيرة الذاتية', 'CV upload'],
  'role.create': ['إضافة دور', 'Role created'], 'role.update': ['تعديل دور', 'Role updated'], 'role.delete': ['حذف دور', 'Role deleted'], 'role.permissions.update': ['تعديل صلاحيات دور', 'Role permissions updated'],
  permission_denied: ['رفض صلاحية', 'Permission denied'], privilege_escalation_attempt: ['محاولة رفع صلاحيات', 'Privilege escalation attempt'], unsubscribe: ['إلغاء اشتراك', 'Unsubscribe'], preferences: ['تعديل التفضيلات', 'Preferences'],
  'update.file': ['تغيير ملف', 'File change'], 'manage-link': ['إدارة الروابط', 'Manage links'], auto_publish: ['نشر تلقائي', 'Auto publish'], 'private.download': ['تنزيل ملف خاص', 'Private download'], unlogged_request: ['إجراء بلا سجل مخصص', 'Unlogged request'],
};
const FIELDS: Record<string, [string, string]> = {
  id: ['المعرّف', 'ID'], title: ['العنوان', 'Title'], titleAr: ['العنوان (عربي)', 'Title (Arabic)'], titleEn: ['العنوان (إنجليزي)', 'Title (English)'], name: ['الاسم', 'Name'], nameAr: ['الاسم (عربي)', 'Name (Arabic)'], nameEn: ['الاسم (إنجليزي)', 'Name (English)'],
  fullName: ['الاسم الكامل', 'Full name'], email: ['البريد الإلكتروني', 'Email'], phone: ['الهاتف', 'Phone'], status: ['الحالة', 'Status'], isActive: ['فعّال', 'Active'], is_active: ['فعّال', 'Active'], roleId: ['الدور', 'Role'], role_id: ['الدور', 'Role'],
  description: ['الوصف', 'Description'], body: ['المحتوى', 'Content'], content: ['المحتوى', 'Content'], value: ['القيمة', 'Value'], key: ['المفتاح', 'Key'], category: ['القسم', 'Category'], createdAt: ['تاريخ الإنشاء', 'Created at'], updatedAt: ['تاريخ التعديل', 'Updated at'],
  created_at: ['تاريخ الإنشاء', 'Created at'], updated_at: ['تاريخ التعديل', 'Updated at'], publishAt: ['تاريخ النشر', 'Publish date'], publish_at: ['تاريخ النشر', 'Publish date'], sortOrder: ['الترتيب', 'Order'], sort_order: ['الترتيب', 'Order'],
};
const humanize = (code: string) => code.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_.\-/]+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
const pick = (map: Record<string, [string, string]>, code: string, lang: string) => map[code]?.[lang === 'ar' ? 0 : 1] ?? humanize(code);


/** the kinds of action the filter offers (the screen groups the ~35 raw codes into these) */
const KINDS: Record<string, [string, string]> = {
  create: ['إضافة', 'Create'], update: ['تعديل', 'Update'], delete: ['حذف', 'Delete'], login: ['تسجيل دخول', 'Sign in'], logout: ['تسجيل خروج', 'Sign out'],
  failed: ['محاولة مرفوضة', 'Failed attempt'], password: ['كلمة المرور', 'Password'], export: ['تصدير', 'Export'], download: ['تنزيل', 'Download'], access: ['اطلاع على بيانات', 'Data access'], other: ['أخرى', 'Other'],
};
/** the badge says what happened; for the plain kinds that is the kind itself, for the others the specific action */
const GENERIC_KINDS = new Set(['create', 'update', 'delete', 'login', 'logout', 'export']);
const badgeText = (r: Row, lang: string) => (GENERIC_KINDS.has(r.kind) ? KINDS[r.kind][lang === 'ar' ? 0 : 1] : pick(ACTIONS, r.action, lang));

function tone(kind: string) {
  switch (kind) {
    case 'create': return 'bg-green-50 text-green-700 ring-green-100';
    case 'update': return 'bg-blue-50 text-blue-700 ring-blue-100';
    case 'delete': return 'bg-amber-50 text-amber-700 ring-amber-100';
    case 'failed': return 'bg-red-50 text-red-700 ring-red-100';
    case 'export': case 'download': return 'bg-violet-50 text-violet-700 ring-violet-100';
    case 'password': return 'bg-sky-50 text-sky-700 ring-sky-100';
    default: return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

/** statuses and flags written as codes, in words */
const VALUES: Record<string, [string, string]> = {
  published: ['منشور', 'Published'], scheduled: ['مجدول', 'Scheduled'], public: ['عام', 'Public'], members: ['للأعضاء', 'Members only'], ar: ['العربية', 'Arabic'], en: ['الإنجليزية', 'English'],
  new: ['جديد', 'New'], in_review: ['قيد المراجعة', 'In review'], accepted: ['مقبول', 'Accepted'], approved: ['مقبول', 'Approved'], rejected: ['مرفوض', 'Rejected'], active: ['فعّال', 'Active'], inactive: ['غير فعّال', 'Inactive'],
};

/** columns nobody needs to read: identifiers, timestamps, storage details, secrets */
const HIDDEN = new Set(['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at', 'version', 'viewCount', 'excerpt', 'fileUrl', 'mimeType', 'storageType', 'fileSize', 'size', 'path', 'passwordHash', 'password']);
const hidden = (k: string) => HIDDEN.has(k) || /(^|[a-z])Id$/.test(k) || /_id$/.test(k) || /(Path|Hash|Token)$/.test(k);
const MAX_SHOWN = 8; // a created / deleted record can have dozens of columns: the first ones tell what it is

/** the fields a change really touched, as { key, before, after } (created: only after, deleted: only before) */
function fieldsOf(c: Change) {
  const keys = Object.keys(c.op === 'remove' ? c.before ?? {} : c.after ?? {}).filter((k) => !hidden(k));
  return keys
    .map((k) => ({ key: k, before: c.before?.[k], after: c.after?.[k] }))
    .filter((f) => c.op !== 'update' || JSON.stringify(f.before) !== JSON.stringify(f.after));
}
const countChanges = (r: Row) => (r.changes ?? []).reduce((n, c) => n + fieldsOf(c).length, 0);

/** the person of an entry: the account, or (a failed sign-in has none) the e-mail that was typed */
function who(r: Row, anon: string) {
  if (r.actor) return { name: r.actor.fullName, sub: r.actor.email ?? '' };
  const typed = typeof r.details?.email === 'string' ? r.details.email : '';
  return { name: typed || anon, sub: typed ? anon : '' };
}

function Value({ v, lang }: { v: unknown; lang: string }) {
  const ar = lang === 'ar';
  if (v === undefined || v === null || v === '') return <span className="italic text-gray-400">{ar ? 'فارغ' : 'empty'}</span>;
  if (typeof v === 'boolean') return <>{v ? (ar ? 'نعم' : 'Yes') : (ar ? 'لا' : 'No')}</>;
  if (typeof v === 'string' && VALUES[v]) return <>{VALUES[v][ar ? 0 : 1]}</>;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return <span dir="ltr">{fmtDate(lang, v, true)}</span>;
  const text = Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join('، ') : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return <span title={text.length > 90 ? text : undefined}>{text.length > 90 ? `${text.slice(0, 90)}…` : text}</span>;
}

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${cls}`}>{children}</span>;
}

function Initial({ name }: { name: string }) {
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">{name.trim().slice(0, 1).toUpperCase()}</span>;
}

/** what was changed: the fields as "before → after" cards (created / deleted records show their main fields) */
function Changes({ row, lang }: { row: Row; lang: string }) {
  const ar = lang === 'ar';
  const [all, setAll] = useState(false);
  const blocks = (row.changes ?? []).map((c) => ({ c, fields: fieldsOf(c) })).filter((b) => b.fields.length);
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      {blocks.map(({ c, fields }, i) => {
        const shown = all || c.op === 'update' ? fields : fields.slice(0, MAX_SHOWN);
        return (
          <div key={i}>
            {blocks.length > 1 && <div className="mb-1.5 text-[11px] font-bold text-slate-500">{pick(MODULES, c.table, lang)}{c.id != null ? ` #${c.id}` : ''}</div>}
            <div className="grid gap-2 sm:grid-cols-2">
              {shown.map((f) => (
                <div key={f.key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="text-[11px] font-semibold text-slate-600">{FIELDS[f.key]?.[ar ? 0 : 1] ?? humanize(f.key)}</div>
                  {c.op === 'update' ? (
                    <div className="mt-1 flex min-w-0 items-center gap-2 text-xs">
                      <span className="min-w-0 truncate rounded-md bg-red-50 px-2 py-1 text-red-700 line-through decoration-red-300"><Value v={f.before} lang={lang} /></span>
                      <span className="shrink-0 text-slate-300" aria-hidden="true">{ar ? '←' : '→'}</span>
                      <span className="min-w-0 truncate rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700"><Value v={f.after} lang={lang} /></span>
                    </div>
                  ) : (
                    <div className={`mt-1 min-w-0 truncate rounded-md px-2 py-1 text-xs font-medium ${c.op === 'insert' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}><Value v={c.op === 'insert' ? f.after : f.before} lang={lang} /></div>
                  )}
                </div>
              ))}
            </div>
            {!all && c.op !== 'update' && fields.length > MAX_SHOWN && (
              <button type="button" onClick={() => setAll(true)} className="mt-2 text-xs font-semibold text-primary hover:underline">{ar ? `عرض كل الحقول (${fields.length})` : `Show all ${fields.length} fields`}</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** the "what" of an entry: the sentence, and (when data changed) a toggle that opens the before / after cards */
function Details({ row, lang, open, onToggle }: { row: Row; lang: string; open: boolean; onToggle: () => void }) {
  const ar = lang === 'ar';
  const n = countChanges(row);
  return (
    <div className="min-w-0">
      <div className="text-sm font-medium leading-6 text-slate-800">{row.description}</div>
      {n > 0 && (
        <button type="button" onClick={onToggle} aria-expanded={open} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          {ar ? `${n} تغييرات` : `${n} changes`} <span aria-hidden="true">{open ? '▲' : '▼'}</span>
        </button>
      )}
      {open && <Changes row={row} lang={lang} />}
    </div>
  );
}

/** The audit log: who did what and when, with what changed. Read-only; same layout as the task-management system's audit log. */
export function AuditLog() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const { can } = useAuth();
  const toast = useToast();
  const [facets, setFacets] = useState<Facets>({ types: [], actions: [] });
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => { api<Facets>('/admin/audit-logs/facets', { cache: 'no-store' }).then(setFacets).catch(() => undefined); }, []);
  useEffect(() => { const h = setTimeout(() => setSearch(searchInput.trim()), 400); return () => clearTimeout(h); }, [searchInput]);
  useEffect(() => { setPage(1); }, [category, kind, search, from, to]);

  const params = { q: search || undefined, category: category || undefined, kind: kind || undefined, from: from || undefined, to: to || undefined };
  const key = JSON.stringify(params);
  const load = useCallback(() => {
    setErr('');
    api<Result>('/admin/audit-logs', { params: { ...JSON.parse(key), page, limit: PAGE_SIZE }, cache: 'no-store' })
      .then(setRes)
      .catch((e) => { setErr(e.message); setRes({ data: [], meta: { page: 1, total: 0, totalPages: 1 } }); });
  }, [key, page]);
  useEffect(() => { load(); }, [load]);

  const dirty = !!(category || kind || search || from || to);
  const clear = () => { setCategory(''); setKind(''); setSearchInput(''); setSearch(''); setFrom(''); setTo(''); };
  const exportXlsx = async () => { try { await download('/admin/audit-logs/export', { ...params, format: 'xlsx', lang }, 'audit-logs.xlsx'); } catch (e: any) { toast(e.message, 'err'); } };
  const anon = ar ? 'زائر / غير مسجّل' : 'Guest / not signed in';
  const toggle = (id: number) => setOpenId((c) => (c === id ? null : id));
  const th = 'px-4 py-3 text-start';

  return (
    <div className="mx-auto max-w-[1500px] pb-12">
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-5 sm:px-7">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950 sm:text-3xl">{ar ? 'سجل التدقيق' : 'Audit log'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{ar ? 'من فعل ماذا ومتى، وما الذي تغيّر. للقراءة فقط.' : 'Who did what and when, and what changed. Read-only.'}</p>
        </div>
        {can('audit.export') && <Button variant="outline" size="sm" onClick={exportXlsx}>⬇ Excel</Button>}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3">
          <input type="search" className={`${inputCls} w-full`} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label={ar ? 'بحث' : 'Search'}
            placeholder={ar ? 'بحث بالوصف أو اسم المستخدم أو بريده…' : 'Search by description, user name or e-mail…'} />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <select className={`${inputCls} sm:!w-[220px]`} value={category} onChange={(e) => setCategory(e.target.value)} aria-label={ar ? 'النوع' : 'Type'}>
              <option value="">{ar ? 'كل الأنواع' : 'All types'}</option>
              {facets.types.map((t) => <option key={t.value} value={t.value}>{pick(MODULES, t.value, lang)}</option>)}
            </select>
            <select className={`${inputCls} sm:!w-[220px]`} value={kind} onChange={(e) => setKind(e.target.value)} aria-label={ar ? 'الإجراء' : 'Action'}>
              <option value="">{ar ? 'كل الإجراءات' : 'All actions'}</option>
              {facets.actions.map((a) => <option key={a.value} value={a.value}>{KINDS[a.value]?.[ar ? 0 : 1] ?? a.value}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-500">{ar ? 'من' : 'From'}
              <input type="date" className={`${inputCls} sm:!w-[160px]`} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-500">{ar ? 'إلى' : 'To'}
              <input type="date" className={`${inputCls} sm:!w-[160px]`} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
            {dirty && <button type="button" onClick={clear} className="text-sm font-medium text-primary hover:underline sm:ms-auto">{ar ? 'مسح الفلاتر' : 'Clear filters'}</button>}
          </div>
        </div>
      </section>

      <div className="mt-5 text-sm text-slate-500"><span className="font-semibold text-slate-800">{res ? res.meta.total.toLocaleString(ar ? 'ar' : 'en') : 0}</span> {ar ? 'سجل' : 'entries'}</div>
      {err && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err}</div>}

      {!res ? <Center><Spinner /></Center> : res.data.length === 0 ? (
        <div className="mt-4 flex min-h-[240px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 text-center text-sm text-slate-500">{ar ? 'لا توجد سجلات مطابقة.' : 'No matching entries.'}</div>
      ) : (
        <div className="mt-4">
          {/* desktop */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white md:block">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  <th className={th}>{ar ? 'التاريخ' : 'Date'}</th><th className={th}>{ar ? 'المستخدم' : 'User'}</th><th className={th}>{ar ? 'الإجراء' : 'Action'}</th>
                  <th className={`${th} hidden lg:table-cell`}>{ar ? 'النوع' : 'Type'}</th><th className={th}>{ar ? 'التفاصيل' : 'Details'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {res.data.map((r) => {
                  const p = who(r, anon);
                  return (
                    <tr key={r.id} className="align-top transition hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500" dir="ltr">{fmtDate(lang, r.createdAt, true)}</td>
                      <td className="px-4 py-3"><div className="flex min-w-0 items-center gap-2.5"><Initial name={p.name} /><div className="min-w-0"><div className="truncate text-sm font-medium text-slate-800">{p.name}</div>{p.sub && <div className="truncate text-xs text-slate-400" dir="ltr">{p.sub}</div>}</div></div></td>
                      <td className="px-4 py-3"><Badge cls={tone(r.kind)}>{badgeText(r, lang)}</Badge></td>
                      <td className="hidden px-4 py-3 lg:table-cell"><Badge cls="bg-slate-100 text-slate-600 ring-slate-200">{pick(MODULES, r.category, lang)}</Badge></td>
                      <td className="px-4 py-3"><Details row={r} lang={lang} open={openId === r.id} onToggle={() => toggle(r.id)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* mobile */}
          <div className="space-y-3 md:hidden">
            {res.data.map((r) => {
              const p = who(r, anon);
              return (
                <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5"><Initial name={p.name} /><div className="min-w-0"><div className="truncate text-sm font-medium text-slate-800">{p.name}</div>{p.sub && <div className="truncate text-xs text-slate-400" dir="ltr">{p.sub}</div>}</div></div>
                    <div className="shrink-0 whitespace-nowrap text-xs text-slate-400" dir="ltr">{fmtDate(lang, r.createdAt, true)}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2"><Badge cls={tone(r.kind)}>{badgeText(r, lang)}</Badge><Badge cls="bg-slate-100 text-slate-600 ring-slate-200">{pick(MODULES, r.category, lang)}</Badge></div>
                  <div className="mt-3 border-t border-slate-100 pt-3"><Details row={r} lang={lang} open={openId === r.id} onToggle={() => toggle(r.id)} /></div>
                </article>
              );
            })}
          </div>
        </div>
      )}
      {res && <Pager page={res.meta.page} totalPages={res.meta.totalPages} onPage={setPage} className="mt-4" />}
    </div>
  );
}
