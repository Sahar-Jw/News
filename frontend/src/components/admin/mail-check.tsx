'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, inputCls } from '@/components/ui/ui';

interface Status { enabled: boolean; packageInstalled: boolean; host: string | null; port: number; secure: boolean; user: string | null; hasPassword: boolean; from: string | null }
interface Result { ok: boolean; code?: string; message?: string; response?: string }

/** What a failed test usually means, in plain words (the raw error is always shown under it). */
function hint(r: Result, ar: boolean): string {
  const code = r.code ?? '';
  const text = `${r.message ?? ''} ${r.response ?? ''}`;
  if (code === 'NOT_CONFIGURED') return ar ? 'إعدادات البريد غير موجودة في بيئة الـ Backend. أضف MAIL_HOST و MAIL_PORT و MAIL_USER و MAIL_PASS و MAIL_FROM في متغيرات البيئة الخاصة بتطبيق الـ Backend على الاستضافة ثم أعد تشغيله (ملف .env لا يصل إلى الحاوية).' : 'The mail settings are missing from the backend environment. Add MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS and MAIL_FROM to the environment variables of the BACKEND app on the host, then restart it (a .env file does not reach the container).';
  if (code === 'EAUTH' || /535|534|Invalid login|Username and Password not accepted|BadCredentials/i.test(text)) return ar ? 'رفض خادم البريد اسم المستخدم أو كلمة المرور. في Gmail يجب تفعيل التحقق بخطوتين وإنشاء «كلمة مرور تطبيق» جديدة واستخدامها في MAIL_PASS (وليس كلمة مرور الحساب).' : 'The mail server rejected the user name or password. With Gmail, turn on 2-Step Verification, create a new “app password” and use it as MAIL_PASS (not the account password).';
  if (['ETIMEDOUT', 'ECONNECTION', 'ECONNREFUSED', 'ESOCKET', 'EDNS', 'ENOTFOUND'].includes(code)) return ar ? 'لا يستطيع الـ Backend الوصول إلى خادم البريد. غالباً الاستضافة تحجب المنفذ الصادر (587 أو 465)، أو MAIL_HOST خاطئ. اطلب من الاستضافة السماح بالاتصال الصادر عبر SMTP، أو جرّب المنفذ 465 مع MAIL_SECURE=true.' : 'The backend cannot reach the mail server. Usually the host blocks outgoing SMTP (port 587 or 465), or MAIL_HOST is wrong. Ask the host to allow outgoing SMTP, or try port 465 with MAIL_SECURE=true.';
  return ar ? 'تعذّر الإرسال. انسخ الخطأ أدناه عند طلب المساعدة.' : 'Sending failed. Copy the error below when asking for help.';
}

/** Mail check (Subscribers page): what is configured on the server and a real test message that shows the exact error when mail does not arrive. */
export function MailCheck() {
  const { lang } = useI18n();
  const { can, me } = useAuth();
  const ar = lang === 'ar';
  const [st, setSt] = useState<Status | null>(null);
  const [to, setTo] = useState(me?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { api<Status>('/admin/mail/status', { cache: 'no-store' }).then(setSt).catch(() => setSt(null)); }, []);
  useEffect(() => { if (me?.email && !to) setTo(me.email); }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setRes(null);
    try { setRes(await api<Result>('/admin/mail/test', { method: 'POST', body: { to: to.trim() } })); }
    catch (err: any) { setRes({ ok: false, message: err.message }); }
    finally { setBusy(false); }
  };

  if (!st) return null;
  const ok = st.enabled && st.hasPassword;
  return (
    <section className="mb-5 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-start">
        <span className="flex items-center gap-2 text-sm font-bold text-primary"><span className="h-4 w-1 rounded-full bg-accent" />{ar ? 'فحص البريد الإلكتروني' : 'Mail check'}</span>
        <span className="flex items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-0.5 font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{ok ? (ar ? 'مُعدّ' : 'Configured') : (ar ? 'غير مُعدّ' : 'Not configured')}</span>
          <span aria-hidden="true" className={`text-[10px] text-gray-500 transition ${open ? 'rotate-180' : ''}`}>▼</span>
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            <div className="flex gap-2"><dt className="text-gray-500">{ar ? 'الخادم' : 'Server'}:</dt><dd dir="ltr">{st.host ? `${st.host}:${st.port}${st.secure ? ' (SSL)' : ''}` : '—'}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500">{ar ? 'الحساب' : 'Account'}:</dt><dd dir="ltr">{st.user ?? '—'}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500">{ar ? 'كلمة المرور' : 'Password'}:</dt><dd>{st.hasPassword ? (ar ? 'موجودة' : 'set') : (ar ? 'غير موجودة' : 'missing')}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-500">{ar ? 'المرسِل' : 'From'}:</dt><dd dir="ltr">{st.from ?? '—'}</dd></div>
          </dl>
          {can('settings.update') ? (
            <form onSubmit={send} className="flex flex-wrap items-center gap-2">
              <input type="email" dir="ltr" required className={`${inputCls} max-w-xs flex-1`} value={to} onChange={(e) => setTo(e.target.value)} placeholder={ar ? 'أرسل رسالة اختبار إلى…' : 'Send a test message to…'} aria-label={ar ? 'بريد الاختبار' : 'Test address'} />
              <Button disabled={busy || !to.trim()}>{busy ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : (ar ? 'إرسال رسالة اختبار' : 'Send test message')}</Button>
            </form>
          ) : <p className="text-xs text-gray-500">{ar ? 'لا تملك صلاحية إرسال رسالة اختبار.' : 'You do not have permission to send a test message.'}</p>}
          {res && (res.ok
            ? <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ar ? 'تم إرسال رسالة الاختبار. تحقق من صندوق الوارد ومن البريد غير المرغوب.' : 'The test message was sent. Check the inbox and the spam folder.'}</p>
            : (
              <div role="alert" className="space-y-1 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <p className="font-semibold">{hint(res, ar)}</p>
                <p dir="ltr" className="break-words font-mono text-xs text-red-600">{[res.code, res.message, res.response].filter(Boolean).join(' — ')}</p>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
