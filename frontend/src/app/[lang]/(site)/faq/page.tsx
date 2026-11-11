'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, onSiteChange } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/ui/toast';
import { Center, Spinner } from '@/components/ui/ui';
import { ConfirmDelete, ItemActions, ManageBtn, PageManageBar } from '@/components/site/page-manage-bar';
import { FaqDialog } from '@/components/admin/faqs-admin';

interface Faq { id: number; scope: string; question: string; answer: string }

/** Public FAQ page: questions grouped by scope (tabs appear when more than one scope has questions), one answer open at a time. */
export default function FaqPage() {
  const { lang, t } = useI18n();
  const [items, setItems] = useState<Faq[] | null>(null);
  const [scope, setScope] = useState('all');
  const [open, setOpen] = useState<number | null>(null);

  const { can } = useAuth();
  const toast = useToast();
  // manager tools (hidden from visitors): the question window (id = edit, none = new) and the question waiting for the delete confirmation
  const [dialog, setDialog] = useState<{ id?: number } | null>(null);
  const [ask, setAsk] = useState<Faq | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((quiet = false) => {
    if (!quiet) setItems(null);
    api<Faq[]>('/public/faqs', { params: { lang }, cache: 'no-store' }).then(setItems).catch(() => { if (!quiet) setItems([]); });
  }, [lang]);
  useEffect(() => { load(); }, [load]);
  // a change made in the window below (or in another tab) shows up at once
  useEffect(() => onSiteChange(() => load(true)), [load]);

  const mayAdd = can('faqs.create'), mayEdit = can('faqs.update') && can('faqs.read'), mayDelete = can('faqs.delete');
  const remove = async () => {
    if (!ask) return;
    setBusy(true);
    try {
      await api(`/admin/faqs/${ask.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      setAsk(null);
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const scopes = useMemo(() => [...new Set((items ?? []).map((f) => f.scope))], [items]);
  const shown = (items ?? []).filter((f) => scope === 'all' || f.scope === scope);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-secondary">{t('site.faq')}</h1>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" />
        </div>
      </header>
      <PageManageBar show={mayAdd || mayEdit || mayDelete} settingsUrl={can('faqs.read') ? '/admin/settings?page=pages&tab=faqs' : undefined}>
        {mayAdd && <ManageBtn onClick={() => setDialog({})}>＋ {t('faq.add')}</ManageBtn>}
      </PageManageBar>
      {dialog && <FaqDialog key={dialog.id ?? 'new'} id={dialog.id} scope={scope !== 'all' ? scope : undefined} onClose={() => setDialog(null)} onSaved={() => load(true)} />}
      {ask && <ConfirmDelete busy={busy} onConfirm={remove} onClose={() => setAsk(null)} />}
      {!items ? <Center><Spinner /></Center> : items.length === 0 ? <Center>{t('faq.empty')}</Center> : (
        <>
          {scopes.length > 1 && (
            <div className="mb-5 flex flex-wrap justify-center gap-2" role="tablist">
              {['all', ...scopes].map((sc) => (
                <button key={sc} type="button" role="tab" aria-selected={scope === sc} onClick={() => { setScope(sc); setOpen(null); }}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${scope === sc ? 'border-primary bg-primary text-white' : 'bg-white text-gray-700 hover:border-primary'}`}>
                  {sc === 'all' ? t('faq.all') : t(`faq.scope.${sc}`)}
                </button>
              ))}
            </div>
          )}
          <div className="grid items-start gap-3 md:grid-cols-2">
            {shown.map((f) => {
              const on = open === f.id;
              return (
                <div key={f.id} className={`overflow-hidden rounded-2xl bg-white shadow-card ring-1 transition ${on ? 'ring-accent' : 'ring-line'}`}>
                  <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : f.id)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start font-bold text-secondary">
                    <span>{f.question}</span>
                    <span className={`shrink-0 text-accent transition-transform ${on ? 'rotate-45' : ''}`} aria-hidden="true">＋</span>
                  </button>
                  {on && <div className="whitespace-pre-line border-t border-line px-5 py-4 text-sm leading-7 text-gray-700">{f.answer}</div>}
                  {(mayEdit || mayDelete) && <div className="border-t border-line p-2"><ItemActions onEdit={mayEdit ? () => setDialog({ id: f.id }) : undefined} onDelete={mayDelete ? () => setAsk(f) : undefined} /></div>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
