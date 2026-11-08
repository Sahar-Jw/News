'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

const SCOPES = ['general', 'one_stop', 'membership', 'training', 'expo'] as const;
interface Row { id: number; scope: string; questionAr: string; questionEn: string; answerAr: string; answerEn: string; sortOrder: number; isActive: boolean }
interface Draft { id?: number; scope: string; questionAr: string; questionEn: string; answerAr: string; answerEn: string; sortOrder: string; isActive: boolean }
const EMPTY: Draft = { scope: 'general', questionAr: '', questionEn: '', answerAr: '', answerEn: '', sortOrder: '0', isActive: true };

/** Frequently asked questions: Arabic is required, English is optional; the public page shows only the visible ones, in the given order. */
export function FaqsAdmin({ scope }: { scope?: string } = {}) {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const open = (r?: Row) => setDraft(r ? { id: r.id, scope: r.scope, questionAr: r.questionAr, questionEn: r.questionEn, answerAr: r.answerAr, answerEn: r.answerEn, sortOrder: String(r.sortOrder), isActive: r.isActive } : { ...EMPTY, ...(scope ? { scope } : {}) });

  const cols: Col<Row>[] = [
    { key: 'questionAr', label: t('faq.questionAr') },
    { key: 'questionEn', label: t('faq.questionEn') },
    { key: 'scope', label: t('faq.scope'), render: (r) => t(`faq.scope.${r.scope}`), text: (r) => t(`faq.scope.${r.scope}`) },
    { key: 'sortOrder', searchable: false, label: t('faq.order'), render: (r) => r.sortOrder, text: (r) => String(r.sortOrder) },
    {
      key: 'isActive', searchable: false, label: t('faq.active'),
      render: (r) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${r.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(r.isActive ? 'sub.yes' : 'sub.no')}</span>,
      text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no'),
    },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const body = {
      scope: draft.scope, questionAr: draft.questionAr.trim(), questionEn: draft.questionEn.trim(),
      answerAr: draft.answerAr.trim(), answerEn: draft.answerEn.trim(), sortOrder: Number(draft.sortOrder) || 0, isActive: draft.isActive,
    };
    setBusy(true);
    try {
      await api(draft.id ? `/admin/faqs/${draft.id}` : '/admin/faqs', { method: draft.id ? 'PATCH' : 'POST', body });
      toast(t('app.saved'));
      setDraft(null);
      setKey((k) => k + 1);
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/faqs/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <RequirePerm any={['faqs.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t(scope === 'expo' ? 'ex.faq' : 'adm.faqs')}</h1>
      <DataTable<Row>
        endpoint="/admin/faqs"
        baseParams={scope ? { scope } : undefined}
        columns={cols}
        refreshKey={key}
        exportable={false}
        filters={!scope ? [{ key: 'scope', label: t('faq.scope'), options: SCOPES.map((s) => ({ value: s, label: t(`faq.scope.${s}`) })) }] : []}
        bulkDelete={{ path: '/admin/faqs/bulk-delete', can: can('faqs.delete') }}
        toolbar={can('faqs.create') && <Button onClick={() => open()}>＋ {t('faq.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            {can('faqs.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('faqs.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('faq.edit') : t('faq.add')} wide>
        {draft && (
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              {!scope && <Field label={t('faq.scope')}>
                <select className={inputCls} value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value })}>
                  {SCOPES.map((s) => <option key={s} value={s}>{t(`faq.scope.${s}`)}</option>)}
                </select>
              </Field>}
              <Field label={t('faq.order')}><input type="number" min={0} max={100000} className={inputCls} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></Field>
              <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />{t('faq.active')}</label>
            </div>
            <Field label={t('faq.questionAr')}><input required maxLength={500} dir="rtl" className={inputCls} value={draft.questionAr} onChange={(e) => setDraft({ ...draft, questionAr: e.target.value })} /></Field>
            <Field label={t('faq.answerAr')}><textarea required maxLength={5000} dir="rtl" rows={4} className={inputCls} value={draft.answerAr} onChange={(e) => setDraft({ ...draft, answerAr: e.target.value })} /></Field>
            <Field label={t('faq.questionEn')} hint={t('faq.hint')}><input maxLength={500} dir="ltr" className={inputCls} value={draft.questionEn} onChange={(e) => setDraft({ ...draft, questionEn: e.target.value })} /></Field>
            <Field label={t('faq.answerEn')}><textarea maxLength={5000} dir="ltr" rows={4} className={inputCls} value={draft.answerEn} onChange={(e) => setDraft({ ...draft, answerEn: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDraft(null)}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
          </form>
        )}
      </Modal>
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{t('app.delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
