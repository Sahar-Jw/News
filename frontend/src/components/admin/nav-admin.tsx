'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { RequirePerm } from '@/components/admin/guard';

interface ItemD { uid: string; titleAr: string; titleEn: string; url: string; isActive: boolean; newTab: boolean }
interface GroupD { uid: string; titleAr: string; titleEn: string; isActive: boolean; items: ItemD[] }
interface Api { groups: { titleAr: string; titleEn: string; isActive: boolean; items: { titleAr: string; titleEn: string; url: string; isActive: boolean; newTab: boolean }[] }[] }

const URL_OK = /^(\/(?!\/)\S*|https?:\/\/\S+)$/i;
/** site pages offered while typing a link (any other path or full address can be typed too) */
const KNOWN = ['/', '/#sec-contact', '/news', '/media', '/gallery', '/subscribe', '/one-stop', '/services', '/membership', '/documents', '/library', '/faq', '/training', '/incubator', '/get2trade', '/occasions/upcoming', '/occasions/previous', '/board', '/committees', '/committees/women', '/pages/view?slug=about', '/search', '/sitemap', '/expo'];

let seq = 0;
const uid = () => `n${++seq}`;
const fromApi = (d: Api): GroupD[] => d.groups.map((g) => ({ uid: uid(), titleAr: g.titleAr, titleEn: g.titleEn, isActive: g.isActive, items: g.items.map((i) => ({ uid: uid(), ...i })) }));
/** what is sent to the API (and compared to detect unsaved changes) */
const toBody = (gs: GroupD[]) => ({ groups: gs.map((g) => ({ titleAr: g.titleAr.trim(), titleEn: g.titleEn.trim(), isActive: g.isActive, items: g.items.map((i) => ({ titleAr: i.titleAr.trim(), titleEn: i.titleEn.trim(), url: i.url.trim(), isActive: i.isActive, newTab: i.newTab })) })) });

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
 * Main menu editor (Settings -> Main menu): the dropdowns of the site's navbar, their Arabic / English names and links.
 * Drag a link by its handle to reorder it or drop it into another dropdown (the "move to" list does the same on touch screens),
 * drag a dropdown by its handle to reorder dropdowns. Nothing is stored until "Save" is pressed.
 */
export function NavAdmin() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const edit = can('nav.update');
  const [groups, setGroups] = useState<GroupD[] | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const [over, setOver] = useState<{ gid: string; iid?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const gs = fromApi(await api<Api>('/admin/nav'));
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

  // ---- problems (shown under the fields and block saving)
  const problems = useMemo(() => {
    const p = new Map<string, string>();
    (groups ?? []).forEach((g) => {
      if (!g.titleAr.trim()) p.set(g.uid, t('nv.errGroup'));
      g.items.forEach((i) => {
        if (!i.titleAr.trim()) p.set(i.uid + ':t', t('nv.errLink'));
        if (!URL_OK.test(i.url.trim())) p.set(i.uid + ':u', t('nv.errUrl'));
      });
    });
    return p;
  }, [groups, t]);

  // ---- state helpers
  const setG = (gid: string, patch: Partial<GroupD>) => setGroups((gs) => gs!.map((g) => (g.uid === gid ? { ...g, ...patch } : g)));
  const setI = (gid: string, iid: string, patch: Partial<ItemD>) => setGroups((gs) => gs!.map((g) => (g.uid === gid ? { ...g, items: g.items.map((i) => (i.uid === iid ? { ...i, ...patch } : i)) } : g)));
  const addGroup = () => setGroups((gs) => [...gs!, { uid: uid(), titleAr: '', titleEn: '', isActive: true, items: [] }]);
  const addItem = (gid: string) => setGroups((gs) => gs!.map((g) => (g.uid === gid ? { ...g, items: [...g.items, { uid: uid(), titleAr: '', titleEn: '', url: '/', isActive: true, newTab: false }] } : g)));
  const delGroup = (gid: string) => setGroups((gs) => gs!.filter((g) => g.uid !== gid));
  const delItem = (gid: string, iid: string) => setGroups((gs) => gs!.map((g) => (g.uid === gid ? { ...g, items: g.items.filter((i) => i.uid !== iid) } : g)));

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
      const fresh = fromApi(await api<Api>('/admin/nav', { method: 'PUT', body: toBody(groups) }));
      setGroups(fresh);
      setSaved(JSON.stringify(toBody(fresh)));
      toast(t('nv.saved'));
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setBusy(false); }
  };

  const total = groups?.reduce((n, g) => n + g.items.length, 0) ?? 0;

  return (
    <RequirePerm any={['nav.read']}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('nv.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{t('nv.subtitle')}</p>
        </div>
        {edit && groups && <Button onClick={addGroup}>＋ {t('nv.addGroup')}</Button>}
      </div>

      {!groups ? <Center><Spinner /></Center> : (
        <>
          {/* live preview of the navbar */}
          <section className="mb-6 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
            <div className="border-b border-line bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">{t('nv.preview')}</div>
            <div className="flex flex-wrap items-center gap-1 px-4 py-3 text-sm font-semibold text-ink/80">
              <span className="rounded-full px-3.5 py-1.5">{t('site.home')}</span>
              {groups.map((g) => (
                <span key={g.uid} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 ${g.isActive && g.items.some((i) => i.isActive) ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400 line-through'}`}>
                  {g.titleAr.trim() || '—'}
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 6 5 5 5-5" /></svg>
                </span>
              ))}
              <span className="rounded-full px-3.5 py-1.5">{t('contact.title')}</span>
            </div>
            <div className="border-t border-line px-4 py-2 text-xs text-gray-500">{groups.length} · {total} {t('nv.links')} — {t('nv.maxHint')}</div>
          </section>

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
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1.5 pt-1">
                      <Switch on={g.isActive} onChange={(v) => setG(g.uid, { isActive: v })} label={t('nv.visible')} disabled={!edit} />
                      <span className="text-[10px] text-gray-500">{t(g.isActive ? 'nv.visible' : 'nv.hidden')}</span>
                    </div>
                    {edit && (
                      <div className="flex shrink-0 items-center">
                        <IconBtn label={t('nv.up')} onClick={() => shiftGroup(g.uid, -1)} disabled={gi === 0}>↑</IconBtn>
                        <IconBtn label={t('nv.down')} onClick={() => shiftGroup(g.uid, 1)} disabled={gi === groups.length - 1}>↓</IconBtn>
                        <IconBtn label={t('nv.deleteGroup')} danger onClick={() => (g.items.length ? setConfirm(g.uid) : delGroup(g.uid))}>✕</IconBtn>
                      </div>
                    )}
                  </header>

                  {/* links: drop here to append */}
                  <div className={`space-y-2 p-3 transition ${over?.gid === g.uid && !over.iid && drag.current?.kind === 'item' ? 'bg-primary/5' : ''}`} onDragOver={allow('item', { gid: g.uid })} onDrop={dropItem(g.uid, null)}>
                    {g.items.length === 0 && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-gray-500">{t('nv.empty')}</p>}
                    {g.items.map((it, ii) => {
                      const tp = problems.get(it.uid + ':t'), up = problems.get(it.uid + ':u');
                      const target = over?.iid === it.uid && drag.current?.kind === 'item';
                      return (
                        <div
                          key={it.uid}
                          data-row
                          onDragOver={allow('item', { gid: g.uid, iid: it.uid })}
                          onDrop={dropItem(g.uid, it.uid)}
                          className={`rounded-xl border bg-white p-2 transition ${target ? 'border-primary border-t-4' : 'border-line'} ${it.isActive ? '' : 'bg-gray-50 opacity-70'}`}
                        >
                          <div className="flex items-start gap-2">
                            {edit && <Grip draggable onDragStart={(e) => startDrag({ kind: 'item', gid: g.uid, iid: it.uid }, (e.currentTarget as HTMLElement).closest('[data-row]'))(e)} onDragEnd={endDrag} title={t('nv.drag')} />}
                            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                              <div>
                                <input value={it.titleAr} disabled={!edit} dir="rtl" maxLength={150} placeholder={t('nv.linkAr')} aria-label={t('nv.linkAr')} onChange={(e) => setI(g.uid, it.uid, { titleAr: e.target.value })} className={`${inputCls} ${tp ? 'border-red-400' : ''}`} />
                                {tp && <span className="mt-1 block text-xs text-red-600">{tp}</span>}
                              </div>
                              <input value={it.titleEn} disabled={!edit} dir="ltr" maxLength={150} placeholder={t('nv.linkEn')} aria-label={t('nv.linkEn')} onChange={(e) => setI(g.uid, it.uid, { titleEn: e.target.value })} className={inputCls} />
                              <div className="sm:col-span-2">
                                <input value={it.url} disabled={!edit} dir="ltr" maxLength={500} list="nav-known-urls" placeholder="/news" aria-label={t('nv.url')} onChange={(e) => setI(g.uid, it.uid, { url: e.target.value })} className={`${inputCls} font-mono text-xs ${up ? 'border-red-400' : ''}`} />
                                {up ? <span className="mt-1 block text-xs text-red-600">{up}</span> : <span className="mt-1 block text-[11px] text-gray-500">{t('nv.urlHint')}</span>}
                              </div>
                            </div>
                            {edit && (
                              <div className="flex shrink-0 flex-col items-center">
                                <IconBtn label={t('nv.up')} onClick={() => shiftItem(g.uid, it.uid, -1)} disabled={ii === 0}>↑</IconBtn>
                                <IconBtn label={t('nv.down')} onClick={() => shiftItem(g.uid, it.uid, 1)} disabled={ii === g.items.length - 1}>↓</IconBtn>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 ps-8 text-xs text-gray-600">
                            <label className="flex items-center gap-2"><Switch on={it.isActive} onChange={(v) => setI(g.uid, it.uid, { isActive: v })} label={t('nv.visible')} disabled={!edit} />{t('nv.visible')}</label>
                            <label className="flex items-center gap-1.5"><input type="checkbox" disabled={!edit} checked={it.newTab} onChange={(e) => setI(g.uid, it.uid, { newTab: e.target.checked })} className="accent-primary" />{t('nv.newTab')}</label>
                            {edit && groups.length > 1 && (
                              <label className="flex items-center gap-1.5">{t('nv.moveTo')}
                                <select value={g.uid} onChange={(e) => moveItem(g.uid, it.uid, e.target.value, null)} className="rounded-lg border border-line bg-white px-2 py-1 text-xs outline-none focus:border-primary">
                                  {groups.map((x) => <option key={x.uid} value={x.uid}>{x.titleAr.trim() || '—'}</option>)}
                                </select>
                              </label>
                            )}
                            {edit && <button type="button" onClick={() => delItem(g.uid, it.uid)} className="ms-auto rounded-lg px-2 py-1 text-red-600 transition hover:bg-red-50">✕ {t('nv.delete')}</button>}
                          </div>
                        </div>
                      );
                    })}
                    {edit && <button type="button" onClick={() => addItem(g.uid)} className="w-full rounded-xl border border-dashed border-primary/40 px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5">＋ {t('nv.addLink')}</button>}
                  </div>
                </section>
              );
            })}
          </div>

          <datalist id="nav-known-urls">{KNOWN.map((u) => <option key={u} value={u} />)}</datalist>

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

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={t('nv.deleteGroup')}>
        <p className="mb-5">{t('nv.deleteGroupMsg')}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirm(null)}>{t('app.cancel')}</Button>
          <Button type="button" variant="danger" onClick={() => { if (confirm) delGroup(confirm); setConfirm(null); }}>{t('app.delete')}</Button>
        </div>
      </Modal>
    </RequirePerm>
  );
}
