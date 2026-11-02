'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { RichEditor } from '@/components/admin/rich-editor';

interface Row { id: number; slug: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; sortOrder: number; isActive: boolean; showInFooter: boolean }
interface Draft { id?: number; slug: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; sortOrder: string; isActive: boolean; showInFooter: boolean }
const EMPTY: Draft = { slug: '', titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', sortOrder: '0', isActive: true, showInFooter: false };

/** Static pages with a rich-text body (Arabic required, English optional). A page is public only while "visible" is on. */
export function PagesAdmin() {
  const { t, href } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const open = (r?: Row) => setDraft(r
    ? { id: r.id, slug: r.slug, titleAr: r.titleAr, titleEn: r.titleEn, bodyAr: r.bodyAr, bodyEn: r.bodyEn, sortOrder: String(r.sortOrder), isActive: r.isActive, showInFooter: r.showInFooter }
    : { ...EMPTY });

  const yn = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const cols: Col<Row>[] = [
    { key: 'titleAr', label: t('pg.titleAr') },
    { key: 'titleEn', label: t('pg.titleEn') },
    { key: 'slug', label: t('pg.slug'), render: (r) => <bdi dir="ltr">{r.slug}</bdi> },
    { key: 'sortOrder', searchable: false, label: t('faq.order'), render: (r) => r.sortOrder, text: (r) => String(r.sortOrder) },
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
    { key: 'showInFooter', searchable: false, label: t('pg.footer'), render: (r) => yn(r.showInFooter), text: (r) => t(r.showInFooter ? 'sub.yes' : 'sub.no') },
  ];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const body = {
      slug: draft.slug.trim().toLowerCase(), titleAr: draft.titleAr.trim(), titleEn: draft.titleEn.trim(),
      bodyAr: draft.bodyAr, bodyEn: draft.bodyEn, sortOrder: Number(draft.sortOrder) || 0, isActive: draft.isActive, showInFooter: draft.showInFooter,
    };
    setBusy(true);
    try {
      await api(draft.id ? `/admin/pages/${draft.id}` : '/admin/pages', { method: draft.id ? 'PATCH' : 'POST', body });
      toast(t('app.saved'));
      setDraft(null);
      setKey((k) => k + 1);
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/pages/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <RequirePerm any={['pages.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.pages')}</h1>
      <DataTable<Row>
        endpoint="/admin/pages"
        columns={cols}
        refreshKey={key}
        exportable={false}
        bulkDelete={{ path: '/admin/pages/bulk-delete', can: can('pages.delete') }}
        toolbar={can('pages.create') && <Button onClick={() => open()}>＋ {t('pg.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            <Link href={href(`/pages/view?slug=${encodeURIComponent(r.slug)}`)} target="_blank" className="rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50">{t('pg.view')}</Link>
            {can('pages.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('pages.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t('pg.edit') : t('pg.add')} wide>
        {draft && (
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('pg.titleAr')}><input required maxLength={255} dir="rtl" className={inputCls} value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} /></Field>
              <Field label={t('pg.titleEn')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} /></Field>
              <Field label={t('pg.slug')} hint={t('pg.slugHint')}><input required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" dir="ltr" className={inputCls} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} /></Field>
              <Field label={t('faq.order')}><input type="number" min={0} max={100000} className={inputCls} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></Field>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />{t('faq.active')}</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.showInFooter} onChange={(e) => setDraft({ ...draft, showInFooter: e.target.checked })} />{t('pg.footer')}</label>
            </div>
            <Field label={t('pg.bodyAr')}><RichEditor key={`ar-${draft.id ?? 'new'}`} value={draft.bodyAr} onChange={(h) => setDraft((d) => (d ? { ...d, bodyAr: h } : d))} dir="rtl" /></Field>
            <Field label={t('pg.bodyEn')} hint={t('faq.hint')}><RichEditor key={`en-${draft.id ?? 'new'}`} value={draft.bodyEn} onChange={(h) => setDraft((d) => (d ? { ...d, bodyEn: h } : d))} dir="ltr" /></Field>
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
