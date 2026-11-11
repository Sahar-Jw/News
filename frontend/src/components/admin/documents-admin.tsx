'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Modal } from '@/components/ui/ui';
import { DocumentDialog, EMPTY_DRAFT, toDraft, type DocRow, type Draft } from '@/components/admin/document-dialog';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

type Row = DocRow;

/** Decisions, circulars and library files. Each record needs one PDF (up to 25 MB); on edit the PDF is replaced only when a new one is chosen. */
export function DocumentsAdmin({ kind }: { kind?: 'library' } = {}) {
  const { t, href } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);

  const open = (r?: Row) => setDraft(r ? toDraft(r) : { ...EMPTY_DRAFT, ...(kind ? { kind } : {}) });

  const yn = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const cols: Col<Row>[] = [
    { key: 'titleAr', label: t('pg.titleAr') },
    { key: 'titleEn', label: t('pg.titleEn') },
    { key: 'docNumber', label: t('doc.number'), render: (r) => <bdi dir="ltr">{r.docNumber}</bdi> },
    { key: 'kind', searchable: false, label: t('doc.kind'), render: (r) => t(`doc.kind.${r.kind}`), text: (r) => t(`doc.kind.${r.kind}`) },
    { key: 'issuerAr', searchable: false, label: t('doc.issuer'), render: (r) => r.issuerAr, text: (r) => r.issuerAr },
    { key: 'docDate', searchable: false, label: t('doc.date'), render: (r) => r.docDate ?? '', text: (r) => r.docDate ?? '' },
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
  ];

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/documents/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <RequirePerm any={['documents.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t(kind ? 'adm.library' : 'adm.documents')}</h1>
      <DataTable<Row>
        endpoint="/admin/documents"
        baseParams={kind ? { kind } : undefined}
        columns={cols}
        refreshKey={key}
        exportable={false}
        bulkDelete={{ path: '/admin/documents/bulk-delete', can: can('documents.delete') }}
        toolbar={can('documents.create') && <Button onClick={() => open()}>＋ {t('doc.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            <Link href={href(`/documents/view?id=${r.id}`)} target="_blank" className="rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50">{t('pg.view')}</Link>
            {can('documents.update') && <Button size="sm" variant="outline" onClick={() => open(r)}>{t('app.edit')}</Button>}
            {can('documents.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />
      {draft && <DocumentDialog key={draft.id ?? 'new'} draft={draft} lockKind={!!kind} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); setKey((k) => k + 1); }} />}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={remove}>{t('app.delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
