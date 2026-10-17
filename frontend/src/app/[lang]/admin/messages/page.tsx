'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, Modal } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';

interface Row { id: number; name: string; email: string; subject: string; message?: string; isRead: boolean; createdAt: string }

export default function MessagesPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState<Row | null>(null);
  const [key, setKey] = useState(0);
  const cols: Col<Row>[] = [
    { key: 'name', label: t('contact.name') },
    { key: 'email', label: t('contact.email'), render: (r) => <span dir="ltr">{r.email}</span> },
    { key: 'subject', label: t('contact.subject') },
    { key: 'isRead', searchable: false, label: t('f.status'), render: (r) => (r.isRead ? <span className="text-gray-400">{t('m.read')}</span> : <span className="rounded bg-primary px-1.5 text-xs text-white">{t('m.unread')}</span>), text: (r) => (r.isRead ? t('m.read') : t('m.unread')) },
    { key: 'createdAt', type: 'date', label: t('f.date'), render: (r) => fmtDate(lang, r.createdAt, true), text: (r) => fmtDate(lang, r.createdAt, true) },
  ];
  return (
    <RequirePerm any={['messages.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.messages')}</h1>
      <DataTable<Row>
        endpoint="/admin/messages" columns={cols} dateFilter refreshKey={key} exportName="messages"
        filters={[{ key: 'isRead', label: t('f.status'), options: [{ value: 'false', label: t('m.unread') }, { value: 'true', label: t('m.read') }] }]}
        rowActions={(r) => (
          <Button size="sm" variant="outline" onClick={async () => {
            try { // the API marks it read only after a successful fetch
              const m = await api<Row>(`/admin/messages/${r.id}`);
              setOpen(m); setKey((k) => k + 1);
            } catch (e: any) { toast(e.message, 'err'); }
          }}>{t('app.view')}</Button>
        )}
      />
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.subject}>
        {open && (
          <div className="space-y-3 text-sm">
            <div><span className="text-gray-500">{t('contact.name')}: </span>{open.name} — <span dir="ltr">{open.email}</span></div>
            <div className="text-gray-500">{fmtDate(lang, open.createdAt, true)}</div>
            <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 leading-7">{open.message}</p>
          </div>
        )}
      </Modal>
    </RequirePerm>
  );
}
