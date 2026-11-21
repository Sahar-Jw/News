'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { hubUrl } from '@/lib/hubs-meta';
import { permsFor } from '@/lib/form-pages';
import { useToast } from '@/components/ui/toast';

interface Group { key: string; count: number; latest: { id: number; reference: string; form: string; applicantName: string | null } | null }
interface Unread { count: number; groups: Group[] }

/** where each kind of request is handled: the page's OWN Requests tab (never the form builder), and what the page is called */
const PAGES: Record<string, { ar: string; en: string; url: string }> = {
  trainees: { ar: 'مركز التدريب — المتدرّبون', en: 'Training center — Trainees', url: hubUrl('training', 'trainees') },
  trainerApps: { ar: 'مركز التدريب — طلبات المدرّبين', en: 'Training center — Trainer applications', url: hubUrl('training', 'trainerApps') },
  membership: { ar: 'الانتساب والخدمات — طلبات الانتساب', en: 'Membership — Requests', url: hubUrl('membership', 'applications') },
  incubator: { ar: 'حاضنة الأعمال — الطلبات', en: 'Business incubator — Requests', url: hubUrl('incubator', 'applications') },
  get2trade: { ar: 'Get2Trade — طلبات الحجز والاستفسار', en: 'Get2Trade — Booking requests', url: hubUrl('get2trade', 'bookings') },
  expo: { ar: 'DCC EXPO — الطلبات', en: 'DCC EXPO — Requests', url: hubUrl('expo', 'applications') },
  contactOneStop: { ar: 'الخدمات والمواعيد — رسائل التواصل', en: 'Services & appointments — Contact messages', url: hubUrl('services', 'messages') },
  contactWomen: { ar: 'لجنة سيدات الأعمال — رسائل التواصل', en: 'Women Business Committee — Contact messages', url: hubUrl('women', 'messages') },
  contact: { ar: 'تواصل معنا — الرسائل', en: 'Contact — Messages', url: '/admin/messages' },
};

/**
 * New-request notification for staff, on top of every management page, refreshed each minute (and a toast when a new request arrives while the
 * page is open). It lists, for each page the person manages, how many requests are waiting and which one came last, and links to that
 * page's own Requests tab. The server only sends the pages this person manages, so nobody is told about another team's requests.
 */
export function FormsInbox() {
  const { can } = useAuth();
  const { lang, href } = useI18n();
  const ar = lang === 'ar';
  const toast = useToast();
  const [u, setU] = useState<Unread | null>(null);
  const last = useRef<Map<string, number> | null>(null);
  // the pages the person manages decide what they are told about (the server sends only those); the global forms permission is not needed
  const allowed = can(...permsFor('read'));

  useEffect(() => {
    if (!allowed) return;
    let stop = false;
    const tick = () => {
      if (document.hidden) return;
      api<Unread>('/admin/forms/unread', { quiet: true }).then((d) => {
        if (stop) return;
        const before = last.current;
        if (before) for (const g of d.groups) if (g.count > (before.get(g.key) ?? 0)) toast(ar ? `طلب جديد في «${PAGES[g.key]?.ar ?? g.key}»` : `New request in “${PAGES[g.key]?.en ?? g.key}”`);
        last.current = new Map(d.groups.map((g) => [g.key, g.count]));
        setU(d);
      }).catch(() => undefined);
    };
    tick();
    const t = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [allowed, ar, toast]);

  const groups = (u?.groups ?? []).filter((g) => PAGES[g.key]);
  if (!allowed || groups.length === 0) return null;
  return (
    <div className="mb-4 space-y-2" role="status" aria-live="polite">
      {groups.map((g) => {
        const p = PAGES[g.key];
        const who = g.latest ? `${g.latest.reference}${g.latest.applicantName ? ` (${g.latest.applicantName})` : ''}` : '';
        const text = ar
          ? (g.count === 1 ? 'لديك طلب جديد لم تقرأه' : `لديك ${g.count} طلبات جديدة لم تُقرأ`)
          : (g.count === 1 ? 'You have 1 new unread request' : `You have ${g.count} new unread requests`);
        return (
          <Link key={g.key} href={href(p.url)} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200 transition hover:bg-red-100">
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white" aria-hidden="true">{g.count}</span>
            <span className="min-w-0 flex-1">
              <b className="block">{ar ? p.ar : p.en}</b>
              <span className="block text-xs text-red-800/90">{text}{who ? (ar ? ` — آخر طلب: ${who}` : ` — latest: ${who}`) : ''}</span>
            </span>
            <span className="shrink-0 font-bold">{ar ? 'عرض الطلبات ←' : 'View requests →'}</span>
          </Link>
        );
      })}
    </div>
  );
}
