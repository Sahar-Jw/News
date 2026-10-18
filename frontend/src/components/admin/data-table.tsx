'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, download } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

export interface Col<T> {
  /** also the export key understood by the API */
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  /** plain text used for printing */
  text?: (row: T) => string;
  /** false = never offered in export/print (e.g. computed cells) */
  exportable?: boolean;
  /** false = no per-column search box (default true) */
  searchable?: boolean;
  /** date columns are searched as YYYY-MM-DD text */
  type?: 'date';
}
export interface FilterDef {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}
interface Meta { page: number; total: number; totalPages: number; from: number; to: number }

interface Props<T> {
  endpoint: string;
  columns: Col<T>[];
  baseParams?: Record<string, string>;
  filters?: FilterDef[];
  dateFilter?: boolean;
  rowActions?: (row: T, reload: () => void) => React.ReactNode;
  /** enable row selection + bulk delete (path relative to API, receives {ids}) */
  bulkDelete?: { path: string; can: boolean };
  exportable?: boolean;
  toolbar?: React.ReactNode;
  refreshKey?: number;
  exportName?: string;
}

export function DataTable<T extends { id: number }>({ endpoint, columns, baseParams, filters = [], dateFilter, rowActions, bulkDelete, exportable = true, toolbar, refreshKey = 0, exportName = 'export' }: Props<T>) {
  const { t, lang, dir } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState<T[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState('10');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fv, setFv] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [bump, setBump] = useState(0);
  const [cf, setCf] = useState<Record<string, string>>({});
  const [dcf, setDcf] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [colMenu, setColMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setDq(q); setPage(1); }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  useEffect(() => {
    const id = setTimeout(() => { setDcf(cf); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [cf]);

  useEffect(() => {
    if (!colMenu) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setColMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [colMenu]);

  const params = useCallback(() => {
    const active = Object.fromEntries(Object.entries(dcf).filter(([, v]) => v.trim()));
    return { ...baseParams, ...fv, q: dq, from, to, ...(Object.keys(active).length && { cf: JSON.stringify(active) }) };
  }, [baseParams, fv, dq, from, to, dcf]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // filtering, paging and permissions are all enforced by the server
      const r = await api<{ data: T[]; meta: Meta }>(endpoint, { params: { ...params(), page, limit } });
      setRows(r.data);
      setMeta(r.meta);
      setSel(new Set());
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, [endpoint, params, page, limit, toast]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [load, refreshKey, bump]);

  const shown = columns.filter((c) => !hidden.has(c.key));
  const toggleCol = (k: string) => setHidden((h) => { const n = new Set(h); n.has(k) ? n.delete(k) : n.add(k); return n; });
  /** what is visible in the table is what gets exported / printed */
  const expCols = shown.filter((c) => c.exportable !== false && c.key !== '_actions').map((c) => c.key);
  const exportable_ = columns;

  const doExport = async (format: 'csv' | 'xlsx') => {
    if (!expCols.length) return toast(t('tbl.needColumn'), 'err');
    try {
      await download(`${endpoint}/export`, { ...params(), format, columns: expCols.join(','), lang }, `${exportName}.${format}`);
    } catch (e: any) { toast(e.message, 'err'); }
  };

  const doPrint = async () => {
    if (!expCols.length) return toast(t('tbl.needColumn'), 'err');
    try {
      const all = await api<{ data: T[] }>(endpoint, { params: { ...params(), limit: 'all' } });
      const cols = exportable_.filter((c) => expCols.includes(c.key));
      const cell = (c: Col<T>, r: T) => String(c.text ? c.text(r) : (r as any)[c.key] ?? '').replace(/[<>&]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m] as string));
      const html = `<html dir="${dir}" lang="${lang}"><head><meta charset="utf-8"><title>${exportName}</title><style>body{font-family:Cairo,Tahoma,Arial,sans-serif;padding:16px}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #999;padding:5px 7px;text-align:start}th{background:#eee}</style></head><body><h3>${exportName}</h3><table><thead><tr><th>#</th>${cols.map((c) => `<th>${c.label}</th>`).join('')}</tr></thead><tbody>${all.data.map((r, i) => `<tr><td>${i + 1}</td>${cols.map((c) => `<td>${cell(c, r)}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
      const w = window.open('', '_blank');
      if (!w) return toast('Popup blocked', 'err');
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    } catch (e: any) { toast(e.message, 'err'); }
  };

  const del = async () => {
    try {
      await api(bulkDelete!.path, { method: 'POST', body: { ids: [...sel] } });
      toast(t('app.deleted'));
      setConfirmDel(false);
      setBump((b) => b + 1);
    } catch (e: any) { toast(e.message, 'err'); setConfirmDel(false); }
  };

  const allOnPage = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const skip = meta ? meta.from - 1 : 0;

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-end gap-2 rounded-xl border bg-white p-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          {t('tbl.pageSize')}
          <select value={limit} onChange={(e) => { setLimit(e.target.value); setPage(1); }} className="rounded-lg border px-2 py-2">
            {['10', '20', '50', '100', 'all'].map((n) => <option key={n} value={n}>{n === 'all' ? t('app.all') : n}</option>)}
          </select>
        </label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('tbl.search')} className={`${inputCls} max-w-56`} />
        {filters.map((f) => (
          <select key={f.key} value={fv[f.key] ?? ''} onChange={(e) => { setFv({ ...fv, [f.key]: e.target.value }); setPage(1); }} className={`${inputCls} max-w-44`} aria-label={f.label}>
            <option value="">{f.label}: {t('app.all')}</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {dateFilter && (
          <>
            <label className="text-xs text-gray-500">{t('tbl.from')}<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className={`${inputCls} mt-0.5`} /></label>
            <label className="text-xs text-gray-500">{t('tbl.to')}<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className={`${inputCls} mt-0.5`} /></label>
          </>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {bulkDelete?.can && sel.size > 0 && <Button variant="danger" onClick={() => setConfirmDel(true)}>{t('tbl.deleteSelected')} ({sel.size})</Button>}
          {exportable && (
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-amber-100 p-1">
              <Button size="sm" variant="ghost" onClick={() => doExport('xlsx')}>{t('tbl.exportXlsx')}</Button>
              <Button size="sm" variant="ghost" onClick={() => doExport('csv')}>{t('tbl.exportCsv')}</Button>
              <Button size="sm" variant="ghost" onClick={doPrint}>{t('tbl.print')}</Button>
            </div>
          )}
          <div className="relative" ref={menuRef}>
            <Button size="sm" variant="outline" onClick={() => setColMenu((o) => !o)} aria-expanded={colMenu}>{t('tbl.customize')} ▾</Button>
            {colMenu && (
              <div className="absolute end-0 top-full z-30 mt-1 min-w-52 rounded-lg border bg-white p-2 shadow-lg">
                {columns.filter((c) => c.key !== '_actions').map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                    <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => toggleCol(c.key)} />
                    <span>{c.label}</span>
                    {exportable && c.exportable === false && <span className="ms-auto text-[10px] text-gray-400">{t('tbl.noExport')}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
          {toolbar}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-start text-xs uppercase text-gray-600">
            <tr>
              <th className="w-10 px-3 py-3 text-start">{t('tbl.no')}</th>
              {bulkDelete?.can && <th className="w-10 px-3"><input type="checkbox" aria-label={t('tbl.selectAll')} checked={allOnPage} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>}
              {rowActions && <th className="px-3 text-start">{t('app.actions')}</th>}
              {shown.map((c) => <th key={c.key} className="px-3 py-3 text-start font-semibold">{c.label}</th>)}
            </tr>
            <tr className="no-print border-t bg-white normal-case">
              <th className="px-3 py-2" />
              {bulkDelete?.can && <th className="px-3" />}
              {rowActions && <th className="px-3" />}
              {shown.map((c) => (
                <th key={c.key} className="px-2 py-2">
                  {c.searchable !== false && c.key !== '_actions' && (
                    <input
                      value={cf[c.key] ?? ''}
                      onChange={(e) => setCf((v) => ({ ...v, [c.key]: e.target.value }))}
                      placeholder={c.type === 'date' ? 'YYYY-MM-DD' : t('tbl.colSearch')}
                      aria-label={`${t('tbl.colSearch')}: ${c.label}`}
                      className="w-full min-w-24 rounded border px-2 py-1 text-xs font-normal outline-none focus:border-primary"
                      dir={c.type === 'date' ? 'ltr' : undefined}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={99}><Center><Spinner /></Center></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={99} className="py-10 text-center text-gray-500">{t('tbl.noRows')}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">{skip + i + 1}</td>
                {bulkDelete?.can && <td className="px-3"><input type="checkbox" checked={sel.has(r.id)} onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(r.id) : n.delete(r.id); setSel(n); }} /></td>}
                {rowActions && <td className="whitespace-nowrap px-3">{rowActions(r, () => setBump((b) => b + 1))}</td>}
                {shown.map((c) => <td key={c.key} className="max-w-xs px-3 py-2">{c.render ? c.render(r) : String((r as any)[c.key] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <div>{meta && `${t('tbl.showing')} ${meta.from}–${meta.to} ${t('tbl.of')} ${meta.total}`}</div>
        {limit !== 'all' && meta && (() => {
          const last = meta.totalPages;
          const start = Math.max(1, Math.min(page - 2, last - 4));
          const nums = Array.from({ length: Math.min(5, last) }, (_, k) => start + k);
          return (
            <div className="flex flex-wrap items-center gap-1">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(1)}>{t('tbl.first')}</Button>
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('app.prev')}</Button>
              {nums.map((n) => <Button key={n} size="sm" variant={n === page ? 'primary' : 'outline'} onClick={() => setPage(n)}>{n}</Button>)}
              <Button size="sm" variant="outline" disabled={page >= last} onClick={() => setPage(page + 1)}>{t('app.next')}</Button>
              <Button size="sm" variant="outline" disabled={page >= last} onClick={() => setPage(last)}>{t('tbl.last')}</Button>
            </div>
          );
        })()}
      </div>

      <Modal open={confirmDel} onClose={() => setConfirmDel(false)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmDel(false)}>{t('app.cancel')}</Button><Button variant="danger" onClick={del}>{t('app.delete')}</Button></div>
      </Modal>
    </div>
  );
}
