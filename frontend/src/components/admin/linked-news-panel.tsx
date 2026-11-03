'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Button, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

interface N { id: number; title: string; publishAt: string | null }

/**
 * News attached to one record (content_links), shown on that record's public page: search news by title, attach, detach.
 * `base` is the admin API path of the record, e.g. "/admin/board/5"; it must offer GET /news, GET /news-search, POST /news and POST /news/unlink.
 */
export function LinkedNewsPanel({ base }: { base: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [linked, setLinked] = useState<N[]>([]);
  const [found, setFound] = useState<N[]>([]);
  const [q, setQ] = useState('');

  const load = useCallback(() => api<N[]>(`${base}/news`).then(setLinked).catch((e) => toast(e.message, 'err')), [base, toast]);
  useEffect(() => { setFound([]); void load(); }, [load]);

  const search = async () => { try { setFound(await api<N[]>(`${base}/news-search`, { params: { q } })); } catch (e: any) { toast(e.message, 'err'); } };
  const attach = async (n: N) => { try { await api(`${base}/news`, { method: 'POST', body: { newsIds: [n.id] } }); setFound((x) => x.filter((y) => y.id !== n.id)); await load(); } catch (e: any) { toast(e.message, 'err'); } };
  const detach = async (n: N) => { try { await api(`${base}/news/unlink`, { method: 'POST', body: { newsIds: [n.id] } }); await load(); } catch (e: any) { toast(e.message, 'err'); } };

  return (
    <section className="mt-5 space-y-3 rounded-xl border border-line p-4">
      <h3 className="text-sm font-bold">{t('ln.title')}</h3>
      <p className="text-xs text-gray-600">{t('ln.hint')}</p>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} placeholder={t('ln.search')} className={inputCls} />
        <Button type="button" onClick={search}>{t('app.search')}</Button>
      </div>
      {found.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {found.map((n) => <li key={n.id} className="flex items-center gap-3 p-3 text-sm"><span className="min-w-0 flex-1 truncate">{n.title}</span><span className="text-xs text-gray-500">{fmtDate('ar', n.publishAt)}</span><Button type="button" size="sm" onClick={() => attach(n)}>{t('ln.attach')}</Button></li>)}
        </ul>
      )}
      <ul className="divide-y rounded-lg border">
        {linked.length === 0 && <li className="p-3 text-sm text-gray-500">{t('ln.none')}</li>}
        {linked.map((n) => <li key={n.id} className="flex items-center gap-3 p-3 text-sm"><span className="min-w-0 flex-1 truncate">{n.title}</span><span className="text-xs text-gray-500">{fmtDate('ar', n.publishAt)}</span><Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => detach(n)}>{t('ln.detach')}</Button></li>)}
      </ul>
    </section>
  );
}
