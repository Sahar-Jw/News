'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { RequirePerm } from '@/components/admin/guard';

interface ItemD { uid: string; titleAr: string; titleEn: string; url: string; isActive: boolean; newTab: boolean }
interface GroupD { uid: string; titleAr: string; titleEn: string; kind: 'links' | 'official' | 'legal'; columns: 1 | 2; isActive: boolean; items: ItemD[] }
interface Api { groups: { titleAr: string; titleEn: string; kind: 'links' | 'official' | 'legal'; columns: 1 | 2; isActive: boolean; items: { titleAr: string; titleEn: string; url: string; isActive: boolean; newTab: boolean }[] }[] }

let seq = 0;
const uid = () => `n${++seq}`;
const fromApi = (d: Api): GroupD[] => d.groups.map((g) => ({ uid: uid(), titleAr: g.titleAr, titleEn: g.titleEn, kind: g.kind, columns: g.columns, isActive: g.isActive, items: g.items.map((i) => ({ uid: uid(), ...i })) }));
/** what is sent to the API (and compared to detect unsaved changes) */
const toBody = (gs: GroupD[]) => ({ groups: gs.map((g) => ({ titleAr: g.titleAr.trim(), titleEn: g.titleEn.trim(), kind: g.kind, columns: g.kind === 'links' ? g.columns : (1 as const), isActive: g.isActive, items: g.items.map((i) => ({ titleAr: i.titleAr.trim(), titleEn: i.titleEn.trim(), url: i.url.trim(), isActive: i.isActive, newTab: i.newTab })) })) });

type Drag = { kind: 'item'; gid: string; iid: string } | { kind: 'group'; gid: string };

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${on ? 'bg-primary' : 'bg-gray-300'} disabled:opacity-50`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? 'start-[1.125rem]' : 'start-0.5'}`} />
    </button>
  );
}

const Grip = (p: React.HTMLAttributes<HTMLSpanElement> & { draggable?: boolean }) => (
  <span {...p} className="flex h-8 w-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg text-gray-400 transition hover:bg-primary/10 hover:text-primary active:cursor-grabbing" aria-hidden="true">
    <svg viewBox="0 0 12 18" width="10" height="15" fill="currentColor"><circle cx="3" cy="3" r="1.4" /><circle cx="9" cy="3" r="1.4" /><circle cx="3" cy="9" r="1.4" /><circle cx="9" cy="9" r="1.4" /><circle cx="3" cy="15" r="1.4" /><circle cx="9" cy="15" r="1.4" /></svg>
  </span>
);
const IconBtn = ({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) => (
  <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled}
    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm transition disabled:opacity-30 ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-500 hover:bg-primary/10 hover:text-primary'}`}>{children}</button>
);

/**
 * Footer editor (Settings -> Footer): the footer's link columns (title + links), the "official links" list shown under the contact details
 * and the small legal links of the bottom bar. A column set to "two lines" is wider and lays its links out in two columns. Same drag, arrows
 * and "move to" controls as the main menu editor. Nothing is stored until "Save" is pressed. Contact details, social links, titles, the
 * newsletter text, the tagline and the rights line are edited in the Settings table (category "Footer" / "Contact" / "Social").
 */
export function FooterAdmin() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const edit = can('footer.update');
  const [groups, setGroups] = useState<GroupD[] | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const drag = useRef<Drag | null>(null);
  const [over, setOver] = useState<{ gid: string; iid?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const gs = fromApi(await api<Api>('/admin/footer'));
      setGroups(gs);
      setSaved(JSON.stringify(toBody(gs)));
    } catch (e: any) { toast(e.message, 'err'); setGroups([]); }
  }, [toast]);
  useEffect(() => { void load(); }, [load]);

  const dirty = groups !== null && JSON.stringify(toBody(groups)) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // ---- problems (shown under the fields and block saving): the dropdown names and the Arabic link names are required
  const problems = useMemo(() => {
    const p = new Map<string, string>();
    (groups ?? []).forEach((g) => {
      if (!g.titleAr.trim()) p.set(g.uid, t('nv.errGroup'));
      g.items.forEach((i) => { if (!i.titleAr.trim()) p.set(i.uid + ':t', t('nv.errLink')); });
    });
    return p;
  }, [groups, t]);

  // ---- state helpers
  const setG = (gid: string, patch: Partial<GroupD>) => setGroups((gs) => gs!.map((g) => (g.uid === gid ? { ...g, ...patch } : g)));
  const setI = (gid: string, iid: string, patch: Partial<ItemD>) => setGroups((gs) => gs!.map((g) => (g.uid === gid ? { ...g, items: g.items.map((i) => (i.uid === iid ? { ...i, ...patch } : i)) } : g)));
  const addGroup = () => setGroups((gs) => [...gs!, { uid: uid(), titleAr: '', titleEn: '', kind: 'links', columns: 1, isActive: true, items: [] }]);
  const delGroup = (gid: string) => setGroups((gs) => gs!.filter((g) => g.uid !== gid));

  /** moves a link to `toGid`, before `beforeIid` (or at the end) */
  const moveItem = (fromGid: string, iid: string, toGid: string, beforeIid: string | null) => setGroups((gs) => {
    const src = gs!.find((g) => g.uid === fromGid)?.items.find((i) => i.uid === iid);
    if (!src || iid === beforeIid) return gs;
    const without = gs!.map((g) => (g.uid === fromGid ? { ...g, items: g.items.filter((i) => i.uid !== iid) } : g));
    return without.map((g) => {
      if (g.uid !== toGid) return g;
      const at = beforeIid ? g.items.findIndex((i) => i.uid === beforeIid) : -1;
      const items = [...g.items];
      items.splice(at < 0 ? items.length : at, 0, src);
      return { ...g, items };
    });
  });
  const shiftItem = (gid: string, iid: string, by: -1 | 1) => setGroups((gs) => gs!.map((g) => {
    if (g.uid !== gid) return g;
    const i = g.items.findIndex((x) => x.uid === iid), j = i + by;
    if (i < 0 || j < 0 || j >= g.items.length) return g;
    const items = [...g.items];
    [items[i], items[j]] = [items[j], items[i]];
    return { ...g, items };
  }));
  const moveGroup = (gid: string, beforeGid: string | null) => setGroups((gs) => {
    const g = gs!.find((x) => x.uid === gid);
    if (!g || gid === beforeGid) return gs;
    const rest = gs!.filter((x) => x.uid !== gid);
    const at = beforeGid ? rest.findIndex((x) => x.uid === beforeGid) : -1;
    rest.splice(at < 0 ? rest.length : at, 0, g);
    return rest;
  });
  const shiftGroup = (gid: string, by: -1 | 1) => setGroups((gs) => {
    const i = gs!.findIndex((x) => x.uid === gid), j = i + by;
    if (i < 0 || j < 0 || j >= gs!.length) return gs;
    const next = [...gs!];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  // ---- drag and drop (mouse; the arrows and the "move to" list cover touch screens)
  const startDrag = (d: Drag, row: HTMLElement | null) => (e: React.DragEvent) => {
    drag.current = d;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', d.kind);
    if (row) e.dataTransfer.setDragImage(row, 16, 16);
  };
  const endDrag = () => { drag.current = null; setOver(null); };
  const allow = (kind: Drag['kind'], target: { gid: string; iid?: string }) => (e: React.DragEvent) => {
    if (!edit || drag.current?.kind !== kind) return;
    e.preventDefault();
    e.stopPropagation();
    if (over?.gid !== target.gid || over?.iid !== target.iid) setOver(target);
  };
  const dropItem = (toGid: string, beforeIid: string | null) => (e: React.DragEvent) => {
    const d = drag.current;
    if (!edit || d?.kind !== 'item') return;
    e.preventDefault();
    e.stopPropagation();
    moveItem(d.gid, d.iid, toGid, beforeIid);
    endDrag();
  };
  const dropGroup = (beforeGid: string | null) => (e: React.DragEvent) => {
    const d = drag.current;
    if (!edit || d?.kind !== 'group') return;
    e.preventDefault();
    e.stopPropagation();
    moveGroup(d.gid, beforeGid);
    endDrag();
  };

  const save = async () => {
    if (!groups) return;
    if (problems.size) { toast(Array.from(problems.values())[0], 'err'); return; }
    setBusy(true);
    try {
      const fresh = fromApi(await api<Api>('/admin/footer', { method: 'PUT', body: toBody(groups) }));
      setGroups(fresh);
      setSaved(JSON.stringify(toBody(fresh)));
      toast(t('nv.saved'));
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const total = groups?.reduce((n, g) => n + g.items.length, 0) ?? 0;

  return (
    <RequirePerm any={['footer.read']}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('ft.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{t('ft.subtitle')}</p>
        </div>
        {edit && groups && <Button onClick={addGroup}>＋ {t('nv.addGroup')}</Button>}
      </div>

      {!groups ? <Center><Spinner /></Center> : (
        <>

          <p className="mb-4 text-xs text-gray-500">{groups.length} · {total} {t('nv.links')}</p>
          {groups.length === 0 && <Center>{t('nv.noGroups')}</Center>}

          <div className="grid items-start gap-5 xl:grid-cols-2" onDragOver={allow('group', { gid: '' })} onDrop={dropGroup(null)}>
            {groups.map((g, gi) => {
              const gProblem = problems.get(g.uid);
              const groupDrop = over?.gid === g.uid && drag.current?.kind === 'group';
              return (
                <section
                  key={g.uid}
                  data-card
                  onDragOver={allow('group', { gid: g.uid })}
                  onDrop={dropGroup(g.uid)}
                  className={`overflow-hidden rounded-2xl bg-white shadow-card ring-1 transition ${groupDrop ? 'ring-2 ring-primary' : 'ring-line'} ${g.isActive ? '' : 'opacity-75'}`}
                >
                  <header className="flex items-start gap-2 border-b border-line bg-gradient-to-l from-primary/5 to-transparent p-3">
                    {edit && <Grip draggable onDragStart={startDrag({ kind: 'group', gid: g.uid }, null)} onDragEnd={endDrag} title={t('nv.drag')} />}
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                      <div>
                        <input value={g.titleAr} disabled={!edit} dir="rtl" maxLength={150} placeholder={t('nv.groupAr')} aria-label={t('nv.groupAr')} onChange={(e) => setG(g.uid, { titleAr: e.target.value })} className={`${inputCls} font-bold ${gProblem ? 'border-red-400' : ''}`} />
                        {gProblem && <span className="mt-1 block text-xs text-red-600">{gProblem}</span>}
                      </div>
                      <input value={g.titleEn} disabled={!edit} dir="ltr" maxLength={150} placeholder={t('nv.groupEn')} aria-label={t('nv.groupEn')} onChange={(e) => setG(g.uid, { titleEn: e.target.value })} className={`${inputCls} font-bold`} />
                      <label className="flex items-center gap-2 text-xs text-gray-600 sm:col-span-2">{t('ft.kind')}
                        <select value={g.kind} disabled={!edit} onChange={(e) => setG(g.uid, { kind: e.target.value as GroupD['kind'] })} className="rounded-lg border border-line bg-white px-2 py-1 text-xs outline-none focus:border-primary">
                          <option value="links">{t('ft.kind.links')}</option><option value="official">{t('ft.kind.official')}</option><option value="legal">{t('ft.kind.legal')}</option>
                        </select>
                        {g.kind === 'links' && (
                          <select value={g.columns} disabled={!edit} onChange={(e) => setG(g.uid, { columns: Number(e.target.value) as 1 | 2 })} aria-label={t('ft.columns')} className="rounded-lg border border-line bg-white px-2 py-1 text-xs outline-none focus:border-primary">
                            <option value={1}>{t('ft.columns.1')}</option><option value={2}>{t('ft.columns.2')}</option>
                          </select>
                        )}
                      </label>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1.5 pt-1">
                      <Switch on={g.isActive} onChange={(v) => setG(g.uid, { isActive: v })} label={t('nv.visible')} disabled={!edit} />
                      <span className="text-[10px] text-gray-500">{t(g.isActive ? 'nv.visible' : 'nv.hidden')}</span>
                    </div>
                    {edit && (
                      <div className="flex shrink-0 items-center">
                        <IconBtn label={t('nv.up')} onClick={() => shiftGroup(g.uid, -1)} disabled={gi === 0}>↑</IconBtn>
                        <IconBtn label={t('nv.down')} onClick={() => shiftGroup(g.uid, 1)} disabled={gi === groups.length - 1}>↓</IconBtn>
                        <IconBtn label={g.items.length ? t('nv.deleteBlocked') : t('nv.deleteGroup')} danger disabled={g.items.length > 0} onClick={() => delGroup(g.uid)}>✕</IconBtn>
                      </div>
                    )}
                  </header>

                  {/* links: drop here to append */}
                  <div className={`space-y-2 p-3 transition ${over?.gid === g.uid && !over.iid && drag.current?.kind === 'item' ? 'bg-primary/5' : ''}`} onDragOver={allow('item', { gid: g.uid })} onDrop={dropItem(g.uid, null)}>
                    {g.items.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-gray-500">{t('nv.empty')}</p>}
                    {g.items.map((it, ii) => {
                      const target = over?.iid === it.uid && drag.current?.kind === 'item';
                      return (
                        <div
                          key={it.uid}
                          data-row
                          onDragOver={allow('item', { gid: g.uid, iid: it.uid })}
                          onDrop={dropItem(g.uid, it.uid)}
                          className={`flex items-start gap-2 rounded-xl border bg-white p-2 transition ${target ? 'border-primary border-t-4' : 'border-line'} ${it.isActive ? '' : 'bg-gray-50 opacity-70'}`}
                        >
                          {edit && <Grip draggable onDragStart={(e) => startDrag({ kind: 'item', gid: g.uid, iid: it.uid }, (e.currentTarget as HTMLElement).closest('[data-row]'))(e)} onDragEnd={endDrag} title={t('nv.drag')} />}
                          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                            <div>
                              <input value={it.titleAr} disabled={!edit} dir="rtl" maxLength={150} placeholder={t('nv.linkAr')} aria-label={t('nv.linkAr')} onChange={(e) => setI(g.uid, it.uid, { titleAr: e.target.value })} className={`${inputCls} ${problems.get(it.uid + ':t') ? 'border-red-400' : ''}`} />
                              {problems.get(it.uid + ':t') && <span className="mt-1 block text-xs text-red-600">{problems.get(it.uid + ':t')}</span>}
                            </div>
                            <input value={it.titleEn} disabled={!edit} dir="ltr" maxLength={150} placeholder={t('nv.linkEn')} aria-label={t('nv.linkEn')} onChange={(e) => setI(g.uid, it.uid, { titleEn: e.target.value })} className={inputCls} />
                          </div>
                          {edit && groups.length > 1 && (
                            <label className="flex shrink-0 items-center gap-1.5 pt-1.5 text-xs text-gray-600"><span className="hidden sm:inline">{t('nv.moveTo')}</span>
                              <select value={g.uid} onChange={(e) => moveItem(g.uid, it.uid, e.target.value, null)} aria-label={t('nv.moveTo')} className="max-w-[9rem] rounded-lg border border-line bg-white px-2 py-1 text-xs outline-none focus:border-primary">
                                {groups.map((x) => <option key={x.uid} value={x.uid}>{x.titleAr.trim() || '—'}</option>)}
                              </select>
                            </label>
                          )}
                          {edit && (
                            <div className="flex shrink-0 items-center">
                              <IconBtn label={t('nv.up')} onClick={() => shiftItem(g.uid, it.uid, -1)} disabled={ii === 0}>↑</IconBtn>
                              <IconBtn label={t('nv.down')} onClick={() => shiftItem(g.uid, it.uid, 1)} disabled={ii === g.items.length - 1}>↓</IconBtn>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>


          {/* unsaved changes bar */}
          {edit && dirty && (
            <div className="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary px-5 py-3 text-white shadow-lift">
              <span className="text-sm font-semibold">● {t('nv.unsaved')}{problems.size > 0 ? ` — ${problems.size}` : ''}</span>
              <div className="flex gap-2">
                <Button variant="outline" className="!border-white/40 !bg-transparent !text-white hover:!bg-white/10" onClick={() => void load()}>{t('nv.discard')}</Button>
                <Button disabled={busy || problems.size > 0} onClick={save}>{t('nv.save')}</Button>
              </div>
            </div>
          )}
        </>
      )}

    </RequirePerm>
  );
}
