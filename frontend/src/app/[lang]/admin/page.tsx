'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

export default function Dashboard() {
  const { me, can } = useAuth();
  const { t, href, lang } = useI18n();
  const [c, setC] = useState<Record<string, number>>({});
  useEffect(() => {
    const tot = (p: string, params: Record<string, string>, key: string) => api<any>(p, { params: { ...params, limit: '10' } }).then((r) => setC((s) => ({ ...s, [key]: r.meta.total }))).catch(() => {});
    if (can('news.read')) { tot('/admin/news', { section: 'regular' }, 'news'); tot('/admin/news', { status: 'draft' }, 'drafts'); }
    if (can('users.read')) { tot('/admin/users', {}, 'users'); tot('/admin/users', { isActive: 'false' }, 'pending'); }
    if (can('messages.read')) tot('/admin/messages', { isRead: 'false' }, 'unread');
    // eslint-disable-next-line
  }, []);
  const cards: [string, string | undefined, string, boolean][] = [
    [t('adm.news'), c.news?.toString(), '/admin/news', can('news.read')],
    [t('s.draft'), c.drafts?.toString(), '/admin/news', can('news.read')],
    [t('adm.users'), c.users?.toString(), '/admin/users', can('users.read')],
    [t('u.pending'), c.pending?.toString(), '/admin/users', can('users.read')],
    [`${t('adm.messages')} (${t('m.unread')})`, c.unread?.toString(), '/admin/messages', can('messages.read')],
  ];
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t('adm.welcome')} {me?.fullName}</h1>
      <p className="mb-6 text-sm text-gray-500">{lang === 'ar' ? me?.role?.nameAr : me?.role?.nameEn}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.filter((x) => x[3]).map(([l, v, to]) => (
          <Link key={l} href={href(to)} className="rounded-xl border bg-white p-5 shadow-sm hover:shadow-md">
            <div className="text-3xl font-bold text-primary">{v ?? '…'}</div>
            <div className="mt-1 text-sm text-gray-600">{l}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
