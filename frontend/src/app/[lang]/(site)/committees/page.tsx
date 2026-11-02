'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';

interface Card { id: number; name: string; summary: string; chairName: string; tags: string[]; logoUrl: string | null }

/** Committees and sectors, with a "find my committee by business activity" search. */
export default function CommitteesPage() {
  const { lang, t, href } = useI18n();
  const [items, setItems] = useState<Card[] | null>(null);
  const [q, setQ] = useState('');
  const [applied, setApplied] = useState('');

  useEffect(() => {
    setItems(null);
    api<Card[]>('/public/committees', { params: { lang, q: applied || undefined }, cache: 'no-store' }).then(setItems).catch(() => setItems([]));
  }, [lang, applied]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-secondary">{t('cm.title')}</h1>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
      </header>
      <form onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); }} className="mx-auto mb-8 flex max-w-xl gap-2" role="search">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('cm.search')} aria-label={t('cm.search')} className="h-11 min-w-0 flex-1 rounded-full border border-line bg-white px-4 text-sm outline-none focus:border-primary" />
        <button className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-white">{t('app.search')}</button>
      </form>
      {!items ? <Center><Spinner /></Center> : items.length === 0 ? <Center>{t('cm.empty')}</Center> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <Link key={c.id} href={href(`/committees/view?id=${c.id}`)} className="group flex flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent">
              <div className="flex items-center gap-3">
                {c.logoUrl ? <img src={fileUrl(c.logoUrl)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl bg-canvas object-contain" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl text-primary" aria-hidden="true">🏛</span>}
                <h2 className="font-bold leading-snug text-secondary group-hover:text-primary">{c.name}</h2>
              </div>
              {c.chairName && <p className="mt-3 text-xs text-gray-600">{t('cm.chair')}: <b>{c.chairName}</b></p>}
              {c.summary && <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-700">{c.summary}</p>}
              {c.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{c.tags.slice(0, 4).map((x) => <span key={x} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{x}</span>)}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
