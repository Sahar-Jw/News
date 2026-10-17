'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate, fmtNum } from '@/lib/utils';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from './data-table';

interface Row { id: number; title: string; subject: string | null; mainCategory: string; subcategory: string | null; topics: string[]; publishAt: string | null; viewCount: number; status: string; language: string; visibility: string }

/** Unified table for regular news (section="regular") and every special section. */
export function NewsTable({ section }: { section: string }) {
  const { t, href, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const special = section !== 'regular';
  const sp = special ? `&section=${section}` : '';
  const statusBadge = (s: string) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${s === 'published' ? 'bg-emerald-100 text-emerald-700' : s === 'scheduled' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{t(`s.${s}`)}</span>;

  const cols: Col<Row>[] = [
    { key: 'title', label: t('f.title') },
    { key: 'subject', label: t('f.subject') },
    ...(special ? [] : [
      { key: 'mainCategory', label: t('f.mainCategory') } as Col<Row>,
      { key: 'subcategory', label: t('f.subcategory') } as Col<Row>,
    ]),
    { key: 'topics', label: t('site.topics'), render: (r) => (r.topics ?? []).join('، '), text: (r) => (r.topics ?? []).join(', ') },
    { key: 'publishAt', type: 'date', label: t('f.publishAt'), render: (r) => <div>{fmtDate(lang, r.publishAt, true)} {statusBadge(r.status)}</div>, text: (r) => `${fmtDate(lang, r.publishAt)} (${r.status})` },
    { key: 'viewCount', label: t('f.views'), render: (r) => fmtNum(lang, r.viewCount) },
    { key: 'language', searchable: false, label: t('f.language'), render: (r) => t(`l.${r.language}`) },
    { key: 'visibility', searchable: false, label: t('f.visibility'), render: (r) => t(`v.${r.visibility}`) },
  ];

  return (
    <DataTable<Row>
      endpoint="/admin/news"
      baseParams={{ section }}
      columns={cols}
      dateFilter
      exportable={can('news.export')}
      exportName={special ? section.toLowerCase() : 'news'}
      filters={[
        { key: 'status', label: t('f.status'), options: ['scheduled', 'published'].map((s) => ({ value: s, label: t(`s.${s}`) })) },
        { key: 'language', label: t('f.language'), options: ['ar', 'en'].map((s) => ({ value: s, label: t(`l.${s}`) })) },
        { key: 'visibility', label: t('f.visibility'), options: ['public', 'members'].map((s) => ({ value: s, label: t(`v.${s}`) })) },
      ]}
      bulkDelete={{ path: '/admin/news/bulk-delete', can: can('news.delete') }}
      toolbar={can('news.create') && can('news.publish') && <Link href={href(`/admin/news/edit?${special ? `section=${section}` : 'new=1'}`)}><Button>＋ {t('app.add')}</Button></Link>}
      rowActions={(r, reload) => (
        <div className="flex gap-1">
          {can('news.update') && <Link href={href(`/admin/news/edit?id=${r.id}${sp}`)}><Button size="sm" variant="outline">{t('app.edit')}</Button></Link>}
          <Link href={href(`/news/view?id=${r.id}`)} target="_blank"><Button size="sm" variant="ghost">{t('app.view')}</Button></Link>
          {can('news.delete') && <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => { if (!confirm(t('tbl.confirmDelete'))) return; try { await api(`/admin/news/${r.id}`, { method: 'DELETE' }); toast(t('app.deleted')); reload(); } catch (e: any) { toast(e.message, 'err'); } }}>✕</Button>}
        </div>
      )}
    />
  );
}
