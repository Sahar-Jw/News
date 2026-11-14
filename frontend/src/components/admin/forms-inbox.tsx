'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { hubUrl } from '@/lib/hubs-meta';
import { useToast } from '@/components/ui/toast';

interface Unread { count: number; latest: { id: number; reference: string; form: string; applicantName: string | null }[] }

/** New-request notification for staff: a banner on every management page, refreshed each minute (and a toast when a new request arrives while the page is open). */
export function FormsInbox() {
  const { can } = useAuth();
  const { lang, href } = useI18n();
  const toast = useToast();
  const [u, setU] = useState<Unread | null>(null);
  const last = useRef<number | null>(null);
  const allowed = can('forms.submissions.read');

  useEffect(() => {
    if (!allowed) return;
    let stop = false;
    const tick = () => {
      if (document.hidden) return;
      api<Unread>('/admin/forms/unread').then((d) => {
        if (stop) return;
        if (last.current !== null && d.count > last.current) toast(lang === 'ar' ? 'وصل طلب جديد' : 'A new request arrived');
        last.current = d.count;
        setU(d);
      }).catch(() => undefined);
    };
    tick();
    const t = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, [allowed, lang, toast]);

  if (!allowed || !u || u.count === 0) return null;
  return (
    <Link href={href(hubUrl('forms', 'submissions'))} className="mb-4 flex items-center gap-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200 hover:bg-red-100" role="status">
      <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">{u.count}</span>
      <span>{lang === 'ar' ? 'طلبات جديدة غير مقروءة' : 'unread new requests'}{u.latest[0] ? ` — ${u.latest[0].reference}${u.latest[0].applicantName ? ` (${u.latest[0].applicantName})` : ''}` : ''}</span>
    </Link>
  );
}
