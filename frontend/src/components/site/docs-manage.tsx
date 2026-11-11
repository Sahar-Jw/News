'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/ui/toast';
import { DocumentDialog, EMPTY_DRAFT, toDraft, type DocRow, type Draft } from '@/components/admin/document-dialog';
import { ConfirmDelete, ItemActions, ManageBtn, ManageLink, PageManageBar } from '@/components/site/page-manage-bar';
import type { Doc } from '@/components/site/documents-browser';

/**
 * Manage buttons of the Decisions & circulars and the Library pages, for the people who may manage documents (visitors see nothing):
 *  - `bar`: the dashed bar at the top of the page: add a document (opens the form right here), the documents list and all settings;
 *  - `actions(doc)`: edit / delete buttons for one row of the results;
 *  - `dialogs`: the windows those buttons open (put them anywhere in the page);
 *  - `rev`: goes up after every change, put it in the dependencies of the page's data fetch.
 * `kind` / `subtype` = what a new document starts as (the part or type being browsed).
 */
export function useDocsManage({ kind, subtype, tab = 'documents' }: { kind?: string; subtype?: string; tab?: 'documents' | 'library' }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ask, setAsk] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const [rev, setRev] = useState(0);
  const mayAdd = can('documents.create');
  const mayEdit = can('documents.update') && can('documents.read');
  const mayDelete = can('documents.delete');

  const edit = async (d: Doc) => {
    try { setDraft(toDraft(await api<DocRow>(`/admin/documents/${d.id}`))); } catch (e: any) { toast(e.message, 'err'); }
  };
  const remove = async () => {
    if (!ask) return;
    setBusy(true);
    try {
      await api(`/admin/documents/${ask.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      setAsk(null);
      setRev((n) => n + 1);
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  const bar = (
    <PageManageBar show={mayAdd || mayEdit || mayDelete} settingsUrl={can('documents.read') ? '/admin/settings?page=documents' : undefined}>
      {mayAdd && <ManageBtn onClick={() => setDraft({ ...EMPTY_DRAFT, ...(kind ? { kind } : {}), subtype: subtype ?? '' })}>＋ {t('doc.add')}</ManageBtn>}
      {can('documents.read') && <ManageLink to={`/admin/settings?page=documents&tab=${tab}`}>▤ {t('doc.manageList')}</ManageLink>}
    </PageManageBar>
  );
  const actions = (d: Doc) => <ItemActions onEdit={mayEdit ? () => edit(d) : undefined} onDelete={mayDelete ? () => setAsk(d) : undefined} />;
  const dialogs = (
    <>
      {draft && <DocumentDialog key={draft.id ?? 'new'} draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); setRev((n) => n + 1); }} />}
      {ask && <ConfirmDelete busy={busy} onConfirm={remove} onClose={() => setAsk(null)} />}
    </>
  );
  return { bar, actions, dialogs, rev };
}
