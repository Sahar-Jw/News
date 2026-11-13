'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, download } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Center, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { Pager } from '@/components/site/pager';
import { useToast } from '@/components/ui/toast';

interface Change { table: string; id: number | string | null; op: 'insert' | 'update' | 'remove'; before?: Record<string, unknown>; after?: Record<string, unknown> }
type Outcome = 'success' | 'failure' | 'warning';
interface Row {
  id: number; category: string; action: string; description: string; createdAt: string; outcome: Outcome;
  actor: { fullName: string; email?: string } | null;
  entityType: string | null; entityId: number | null;
  details: Record<string, unknown> | null; changes: Change[] | null;
  ip: string | null; userAgent: string | null; method: string | null; route: string | null;
}
interface Facets { categories: { value: string; count: number }[]; actions: { value: string; count: number }[]; entityTypes: { value: string; count: number }[]; actors: { id: number; name: string; email: string; count: number }[] }
interface Result { data: Row[]; meta: { page: number; total: number; totalPages: number } }

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

/** colour of an action's badge: green = add, amber = change, red = delete / failure, blue = sign-in, violet = data leaving, grey = other */
function tone(action: string, outcome: Outcome) {
  if (outcome === 'failure') return 'bg-red-50 text-red-700 ring-red-200';
  if (outcome === 'warning') return 'bg-orange-50 text-orange-700 ring-orange-200';
  if (/^(create|register|role\.create)$/.test(action)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (/delete/.test(action)) return 'bg-red-50 text-red-700 ring-red-200';
  if (/^(login|logout|verify)$/.test(action)) return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (/export|download/.test(action)) return 'bg-violet-50 text-violet-700 ring-violet-200';
  if (/update|change|reset|preferences|profile|role|manage|publish/.test(action)) return 'bg-amber-50 text-amber-800 ring-amber-200';
  return 'bg-gray-100 text-gray-700 ring-gray-200';
}
const Badge = ({ cls, children }: { cls: string; children: React.ReactNode }) => <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>{children}</span>;

/** "Chrome on Windows" out of the browser's user-agent text */
function device(ua: string | null) {
  if (!ua) return '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /curl|postman|insomnia|axios|node/i.test(ua) ? 'API client' : '';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ') || ua.slice(0, 40);
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

/** what the person of an entry is: the account, or (a failed sign-in has none) the e-mail that was typed */
function who(r: Row, anon: string) {
  if (r.actor) return { name: r.actor.fullName, sub: r.actor.email ?? '' };
  const typed = typeof r.details?.email === 'string' ? r.details.email : '';
  return { name: typed || anon, sub: typed ? anon : '' };
}

function Value({ v, lang }: { v: unknown; lang: string }) {
  if (v === undefined) return <span className="text-gray-300">—</span>;
  if (v === null || v === '') return <span className="italic text-gray-400">{lang === 'ar' ? 'فارغ' : 'empty'}</span>;
  if (typeof v === 'boolean') return <span className={v ? 'text-emerald-700' : 'text-gray-500'}>{v ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No')}</span>;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return <span dir="ltr">{fmtDate(lang, v, true)}</span>;
  const text = typeof v === 'object' ? JSON.stringify(v, null, 1) : String(v);
  return <span className="block max-h-40 overflow-auto whitespace-pre-wrap break-words" dir="auto">{text}</span>;
}

function ChangeBlock({ c, lang }: { c: Change; lang: string }) {
  const fields = Object.keys(c.op === 'remove' ? c.before ?? {} : c.after ?? {});
  const head = c.op === 'insert' ? 'bg-emerald-50 text-emerald-800' : c.op === 'remove' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800';
  const label = c.op === 'insert' ? ['تم إنشاء السجل', 'Record created'] : c.op === 'remove' ? ['تم حذف السجل', 'Record deleted'] : ['تم تعديل السجل', 'Record updated'];
  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-line">
      <div className={`flex items-center justify-between gap-3 px-3 py-2 text-xs font-bold ${head}`}>
        <span>{lang === 'ar' ? label[0] : label[1]}</span>
        <span dir="ltr" className="font-mono">{pick(MODULES, c.table, lang)}{c.id != null ? ` #${c.id}` : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="w-1/4 px-3 py-2 text-start font-semibold">{lang === 'ar' ? 'الحقل' : 'Field'}</th>
              {c.op !== 'insert' && <th className="px-3 py-2 text-start font-semibold">{lang === 'ar' ? 'قبل' : 'Before'}</th>}
              {c.op !== 'remove' && <th className="px-3 py-2 text-start font-semibold">{lang === 'ar' ? 'بعد' : 'After'}</th>}
            </tr>
          </thead>
          <tbody>
            {fields.map((k) => (
              <tr key={k} className="border-t border-line align-top">
                <td className="px-3 py-2"><div className="font-semibold text-gray-700">{FIELDS[k]?.[lang === 'ar' ? 0 : 1] ?? humanize(k)}</div><div className="font-mono text-[11px] text-gray-400" dir="ltr">{k}</div></td>
                {c.op !== 'insert' && <td className={`max-w-[18rem] px-3 py-2 ${c.op === 'update' ? 'bg-red-50/60' : ''}`}><Value v={c.before?.[k]} lang={lang} /></td>}
                {c.op !== 'remove' && <td className={`max-w-[18rem] px-3 py-2 ${c.op === 'update' ? 'bg-emerald-50/60' : ''}`}><Value v={c.after?.[k]} lang={lang} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="text-xs font-semibold text-gray-500">{label}</div><div className="mt-0.5 break-words text-sm">{children}</div></div>;
}

function Detail({ row, lang }: { row: Row; lang: string }) {
  const ar = lang === 'ar';
  const [raw, setRaw] = useState(false);
  const p = who(row, ar ? 'زائر / غير مسجّل' : 'Guest / not signed in');
  const extra = row.details && Object.keys(row.details).length ? row.details : null;
  const outcomeText = row.outcome === 'failure' ? (ar ? 'فشل / مرفوض' : 'Failed / refused') : row.outcome === 'warning' ? (ar ? 'تنبيه' : 'Warning') : (ar ? 'نجاح' : 'Success');
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge cls={tone(row.action, row.outcome)}>{pick(ACTIONS, row.action, lang)}</Badge>
        <Badge cls="bg-gray-100 text-gray-700 ring-gray-200">{pick(MODULES, row.category, lang)}</Badge>
        <Badge cls={row.outcome === 'success' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : row.outcome === 'failure' ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-orange-50 text-orange-700 ring-orange-200'}>{outcomeText}</Badge>
      </div>
      <p className="mb-5 rounded-xl bg-gray-50 p-3 text-sm font-medium leading-7">{row.description}</p>
      <div className="mb-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Info label={ar ? 'التاريخ والوقت' : 'Date & time'}><span dir="ltr">{fmtDate(lang, row.createdAt, true)}</span></Info>
        <Info label={ar ? 'المنفّذ' : 'User'}>{p.name}{p.sub && <span className="block text-xs text-gray-500" dir="ltr">{p.sub}</span>}</Info>
        <Info label={ar ? 'عنوان IP' : 'IP address'}><span dir="ltr" className="font-mono">{row.ip ?? '—'}</span></Info>
        <Info label={ar ? 'المتصفح / الجهاز' : 'Browser / device'}>{device(row.userAgent) || '—'}</Info>
        <Info label={ar ? 'السجل المتأثر' : 'Affected record'}>{row.entityType ? <span dir="ltr">{pick(MODULES, row.entityType, lang)}{row.entityId ? ` #${row.entityId}` : ''}</span> : '—'}</Info>
        <Info label={ar ? 'الطلب' : 'Request'}>{row.method ? <span dir="ltr" className="font-mono text-xs">{row.method} {row.route}</span> : '—'}</Info>
        <Info label={ar ? 'رقم السجل' : 'Log ID'}><span dir="ltr" className="font-mono">#{row.id}</span></Info>
      </div>
      <h3 className="mb-2 text-sm font-bold">{ar ? 'التغييرات' : 'Changes'}</h3>
      {row.changes?.length ? row.changes.map((c, i) => <ChangeBlock key={i} c={c} lang={lang} />) : <p className="mb-3 text-sm text-gray-500">{ar ? 'لا توجد تغييرات مسجّلة على بيانات.' : 'No data changes were recorded for this entry.'}</p>}
      {extra && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-bold">{ar ? 'تفاصيل إضافية' : 'Additional details'}</h3>
          <dl className="grid gap-2 rounded-xl border border-line p-3 text-sm sm:grid-cols-2">
            {Object.entries(extra).map(([k, v]) => <div key={k}><dt className="text-xs text-gray-500">{FIELDS[k]?.[ar ? 0 : 1] ?? humanize(k)}</dt><dd className="break-words"><Value v={v} lang={lang} /></dd></div>)}
          </dl>
        </div>
      )}
      <button type="button" onClick={() => setRaw((v) => !v)} className="mt-5 text-xs font-semibold text-primary hover:underline">{raw ? (ar ? 'إخفاء البيانات الخام' : 'Hide raw data') : (ar ? 'عرض البيانات الخام (JSON)' : 'Show raw data (JSON)')}</button>
      {raw && <pre dir="ltr" className="mt-2 max-h-72 overflow-auto rounded-xl bg-gray-900 p-3 text-xs leading-5 text-gray-100">{JSON.stringify(row, null, 2)}</pre>}
    </div>
  );
}

const PRESETS: ['all' | 'today' | '7' | '30', string, string][] = [['all', 'الكل', 'All time'], ['today', 'اليوم', 'Today'], ['7', 'آخر 7 أيام', 'Last 7 days'], ['30', 'آخر 30 يوماً', 'Last 30 days']];

/** The audit log: who did what, where and when, with the result, the address it came from and what exactly changed. Read-only. */
export function AuditLog() {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const { can } = useAuth();
  const toast = useToast();
  const [facets, setFacets] = useState<Facets | null>(null);
  const [f, setF] = useState({ q: '', category: '', action: '', entityType: '', actorId: '', outcome: '', from: '', to: '', preset: 'all' as 'all' | 'today' | '7' | '30' | 'custom', sortDir: 'desc' });
  const [text, setText] = useState('');
  const [limit, setLimit] = useState('20');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<Row | null>(null);

  useEffect(() => { api<Facets>('/admin/audit-logs/facets', { cache: 'no-store' }).then(setFacets).catch(() => setFacets({ categories: [], actions: [], entityTypes: [], actors: [] })); }, []);
  useEffect(() => { const h = setTimeout(() => setF((x) => (x.q === text.trim() ? x : { ...x, q: text.trim() })), 350); return () => clearTimeout(h); }, [text]);
  useEffect(() => { setPage(1); }, [f, limit]);

  const params = useMemo(() => ({ q: f.q || undefined, category: f.category || undefined, action: f.action || undefined, entityType: f.entityType || undefined, actorId: f.actorId || undefined, outcome: f.outcome || undefined, from: f.from || undefined, to: f.to || undefined, sortDir: f.sortDir }), [f]);
  const load = useCallback(() => {
    setErr('');
    api<Result>('/admin/audit-logs', { params: { ...params, page, limit }, cache: 'no-store' }).then(setRes).catch((e) => { setErr(e.message); setRes({ data: [], meta: { page: 1, total: 0, totalPages: 1 } }); });
  }, [params, page, limit]);
  useEffect(() => { load(); }, [load]);

  const setPreset = (p: 'all' | 'today' | '7' | '30') => setF((x) => ({ ...x, preset: p, from: p === 'all' ? '' : p === 'today' ? ymd(new Date()) : daysAgo(Number(p)), to: p === 'all' ? '' : ymd(new Date()) }));
  const dirty = !!(f.q || f.category || f.action || f.entityType || f.actorId || f.outcome || f.from || f.to);
  const reset = () => { setText(''); setF((x) => ({ ...x, q: '', category: '', action: '', entityType: '', actorId: '', outcome: '', from: '', to: '', preset: 'all' })); };
  const exportAs = async (format: 'csv' | 'xlsx') => { try { await download('/admin/audit-logs/export', { ...params, format, lang }, `audit-logs.${format}`); } catch (e: any) { toast(e.message, 'err'); } };
  const anon = ar ? 'زائر / غير مسجّل' : 'Guest / not signed in';
  const sel = `${inputCls} !w-auto min-w-[9rem]`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{ar ? 'سجل التدقيق' : 'Audit log'}</h1>
          <p className="mt-1 text-sm text-gray-500">{ar ? 'سجل للقراءة فقط بكل ما يجري على الموقع: من نفّذ ماذا، وأين، ومتى، ومن أي عنوان، وما الذي تغيّر.' : 'A read-only record of everything done on the site: who did what, where, when, from which address, and what changed.'}</p>
        </div>
        {can('audit.export') && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportAs('csv')}>⬇ CSV</Button>
            <Button variant="outline" size="sm" onClick={() => exportAs('xlsx')}>⬇ Excel</Button>
          </div>
        )}
      </div>

      {/* filters */}
      <div className="mb-4 space-y-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={ar ? 'بحث في الوصف، المستخدم، البريد، IP، الإجراء…' : 'Search description, user, email, IP, action…'} className={`${inputCls} min-w-[16rem] flex-1`} aria-label={ar ? 'بحث' : 'Search'} />
          <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1" role="group" aria-label={ar ? 'الفترة' : 'Period'}>
            {PRESETS.map(([id, a, e]) => <button key={id} type="button" aria-pressed={f.preset === id} onClick={() => setPreset(id)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${f.preset === id ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-primary'}`}>{ar ? a : e}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={sel} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label={ar ? 'القسم' : 'Module'}>
            <option value="">{ar ? 'كل الأقسام' : 'All modules'}</option>
            {(facets?.categories ?? []).map((c) => <option key={c.value} value={c.value}>{pick(MODULES, c.value, lang)} ({c.count})</option>)}
          </select>
          <select className={sel} value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} aria-label={ar ? 'الإجراء' : 'Action'}>
            <option value="">{ar ? 'كل الإجراءات' : 'All actions'}</option>
            {(facets?.actions ?? []).map((c) => <option key={c.value} value={c.value}>{pick(ACTIONS, c.value, lang)} ({c.count})</option>)}
          </select>
          <select className={sel} value={f.actorId} onChange={(e) => setF({ ...f, actorId: e.target.value })} aria-label={ar ? 'المستخدم' : 'User'}>
            <option value="">{ar ? 'كل المستخدمين' : 'All users'}</option>
            {(facets?.actors ?? []).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.count})</option>)}
          </select>
          <select className={sel} value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })} aria-label={ar ? 'النتيجة' : 'Result'}>
            <option value="">{ar ? 'كل النتائج' : 'All results'}</option>
            <option value="success">{ar ? 'نجاح' : 'Success'}</option>
            <option value="failure">{ar ? 'فشل / مرفوض' : 'Failed / refused'}</option>
            <option value="warning">{ar ? 'تنبيه' : 'Warning'}</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">{ar ? 'من' : 'From'}<input type="date" className={`${inputCls} !w-auto`} value={f.from} max={f.to || undefined} onChange={(e) => setF({ ...f, from: e.target.value, preset: 'custom' })} /></label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">{ar ? 'إلى' : 'To'}<input type="date" className={`${inputCls} !w-auto`} value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, to: e.target.value, preset: 'custom' })} /></label>
          {dirty && <button type="button" onClick={reset} className="rounded-full px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10">✕ {ar ? 'مسح الفلاتر' : 'Clear filters'}</button>}
        </div>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-xs text-gray-500">
          <span>{res ? `${res.meta.total.toLocaleString(lang === 'ar' ? 'ar' : 'en')} ${ar ? 'سجل' : 'entries'}` : ''}</span>
          <span className="flex items-center gap-3">
            <button type="button" onClick={() => setF({ ...f, sortDir: f.sortDir === 'desc' ? 'asc' : 'desc' })} className="font-semibold hover:text-primary">{f.sortDir === 'desc' ? (ar ? 'الأحدث أولاً ↓' : 'Newest first ↓') : (ar ? 'الأقدم أولاً ↑' : 'Oldest first ↑')}</button>
            <label className="flex items-center gap-1">{ar ? 'عدد الصفوف' : 'Rows'}<select className="rounded-lg border border-line bg-white px-1.5 py-1" value={limit} onChange={(e) => setLimit(e.target.value)}>{['20', '50', '100'].map((n) => <option key={n}>{n}</option>)}</select></label>
          </span>
        </div>
        {!res ? <Center><Spinner /></Center> : err ? <p role="alert" className="p-6 text-center text-red-600">{err}</p> : res.data.length === 0 ? <p className="p-10 text-center text-sm text-gray-500">{ar ? 'لا توجد سجلات مطابقة.' : 'No matching entries.'}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  {[ar ? 'التاريخ والوقت' : 'Date & time', ar ? 'المنفّذ' : 'User', ar ? 'الإجراء' : 'Action', ar ? 'القسم' : 'Module', ar ? 'السجل' : 'Record', ar ? 'الوصف' : 'Description', 'IP', ar ? 'النتيجة' : 'Result', ''].map((h, i) => <th key={i} className="px-3 py-2.5 text-start font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {res.data.map((r) => {
                  const p = who(r, anon);
                  return (
                    <tr key={r.id} onClick={() => setOpen(r)} className={`cursor-pointer border-t border-line align-top transition hover:bg-primary/5 ${r.outcome === 'failure' ? 'bg-red-50/40' : ''}`}>
                      <td className="whitespace-nowrap px-3 py-2.5"><span dir="ltr">{fmtDate(lang, r.createdAt, true)}</span></td>
                      <td className="px-3 py-2.5"><div className="font-semibold">{p.name}</div>{p.sub && <div className="text-xs text-gray-500" dir="ltr">{p.sub}</div>}</td>
                      <td className="px-3 py-2.5"><Badge cls={tone(r.action, r.outcome)}>{pick(ACTIONS, r.action, lang)}</Badge></td>
                      <td className="whitespace-nowrap px-3 py-2.5">{pick(MODULES, r.category, lang)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-gray-600" dir="ltr">{r.entityType ? `${pick(MODULES, r.entityType, lang)}${r.entityId ? ` #${r.entityId}` : ''}` : '—'}</td>
                      <td className="max-w-[22rem] px-3 py-2.5"><span className="line-clamp-2">{r.description}</span>{r.changes?.length ? <span className="mt-1 inline-block text-[11px] font-semibold text-primary">{r.changes.length} {ar ? 'تغيير' : 'change(s)'}</span> : null}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-gray-600" dir="ltr">{r.ip ?? '—'}</td>
                      <td className="px-3 py-2.5"><Badge cls={r.outcome === 'success' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : r.outcome === 'failure' ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-orange-50 text-orange-700 ring-orange-200'}>{r.outcome === 'success' ? (ar ? 'نجاح' : 'Success') : r.outcome === 'failure' ? (ar ? 'فشل' : 'Failed') : (ar ? 'تنبيه' : 'Warning')}</Badge></td>
                      <td className="px-3 py-2.5"><Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setOpen(r); }}>{ar ? 'تفاصيل' : 'Details'}</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {res && <Pager page={res.meta.page} totalPages={res.meta.totalPages} onPage={setPage} className="mt-4" />}

      <Modal open={!!open} onClose={() => setOpen(null)} title={ar ? 'تفاصيل السجل' : 'Log entry'} wide>
        {open && <Detail row={open} lang={lang} />}
      </Modal>
    </div>
  );
}
