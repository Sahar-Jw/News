'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fileUrl, onSiteChange } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/ui/toast';
import { Center, Spinner } from '@/components/ui/ui';
import { CommitteeDialog } from '@/components/admin/committees-admin';
import { ConfirmDelete, ItemActions, ManageBtn, PageManageBar } from '@/components/site/page-manage-bar';
import { CategoryNews } from '@/components/site/category-news';

interface Card { id: number; name: string; summary: string; chairName: string; tags: string[]; logoUrl: string | null }

/** Committees and sectors, with a text search. */
export default function CommitteesPage() {
  const { lang, t, href } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [all, setAll] = useState<Card[] | null>(null);
  const [q, setQ] = useState('');
  // manager tools: the committee window (id = committee being edited, none = a new one) and the committee waiting for the delete confirmation
  const [dialog, setDialog] = useState<{ id?: number } | null>(null);
  const [ask, setAsk] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((quiet = false) => {
    if (!quiet) setAll(null);
    api<Card[]>('/public/committees', { params: { lang }, cache: 'no-store' }).then(setAll).catch(() => { if (!quiet) setAll([]); });
  }, [lang]);
  useEffect(() => { load(); }, [load]);
  // a change made in the window below (or in another tab) shows up at once
  useEffect(() => onSiteChange(() => load(true)), [load]);

  const mayAdd = can('committees.create');
  const mayEdit = can('committees.update') && can('committees.read');
  const mayDelete = can('committees.delete');
  const remove = async () => {
    if (!ask) return;
    setBusy(true);
    try {
      await api(`/admin/committees/${ask.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      setAsk(null);
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const needle = q.trim().toLowerCase();
  const items = useMemo(
    () => (all ?? []).filter((c) => (!needle || `${c.name} ${c.summary} ${c.chairName} ${c.tags.join(' ')}`.toLowerCase().includes(needle))),
    [all, needle],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-secondary">{t('cm.title')}</h1>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
      </header>
      <PageManageBar show={mayAdd || mayEdit || mayDelete} settingsUrl={can('committees.read') ? '/admin/settings?page=committees&tab=committees' : undefined}>
        {mayAdd && <ManageBtn onClick={() => setDialog({})}>＋ {t('cm.add')}</ManageBtn>}
      </PageManageBar>
      <div className="mx-auto mb-8 max-w-3xl space-y-3" role="search">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('cm.search')} aria-label={t('cm.search')} className="h-11 w-full rounded-full border border-line bg-white px-5 text-sm outline-none focus:border-primary" />
        {q && all && <p className="text-center text-sm text-gray-500">{items.length} {t('cm.count')} <button type="button" onClick={() => { setQ(''); }} className="ms-2 font-semibold text-primary hover:underline">{t('app.reset')}</button></p>}
      </div>
      {dialog && <CommitteeDialog key={dialog.id ?? 'new'} id={dialog.id} onClose={() => setDialog(null)} onChanged={() => load(true)} />}
      {ask && <ConfirmDelete busy={busy} onConfirm={remove} onClose={() => setAsk(null)} />}
      {!all ? <Center><Spinner /></Center> : items.length === 0 ? <Center>{t('cm.empty')}</Center> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
            <Link href={href(`/committees/view?id=${c.id}`)} className="group flex flex-1 flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent">
              <div className="flex items-center gap-3">
                {c.logoUrl ? <img src={fileUrl(c.logoUrl)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl bg-canvas object-contain" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl text-primary" aria-hidden="true">🏛</span>}
                <h2 className="font-bold leading-snug text-secondary group-hover:text-primary">{c.name}</h2>
              </div>
              {c.chairName && <p className="mt-3 text-xs text-gray-600">{t('cm.chair')}: <b>{c.chairName}</b></p>}
              {c.summary && <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-700">{c.summary}</p>}
              {c.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{c.tags.slice(0, 4).map((x) => <span key={x} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{x}</span>)}</div>}
            </Link>
            <ItemActions onEdit={mayEdit ? () => setDialog({ id: c.id }) : undefined} onDelete={mayDelete ? () => setAsk(c) : undefined} />
            </div>
          ))}
        </div>
      )}
      <CategoryNews category="committees" className="mt-10 !px-0 !pb-0" />
    </div>
  );
}
