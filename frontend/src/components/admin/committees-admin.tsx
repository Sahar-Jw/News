'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate, fmtDay } from '@/lib/utils';
import { Button, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Col, DataTable } from '@/components/admin/data-table';
import { RequirePerm } from '@/components/admin/guard';
import { RichEditor } from '@/components/admin/rich-editor';

interface Member { id: number; role: string; nameAr: string; nameEn: string; titleAr: string; titleEn: string; photoUrl: string | null; sortOrder: number }
interface Activity { id: number; kind: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; goalsAr: string; goalsEn: string; resultsAr: string; resultsEn: string; eventDate: string | null }
interface LinkedNews { id: number; title: string; publishAt: string | null }
export interface CommitteeRow { id: number; kind: string; nameAr: string; nameEn: string; summaryAr: string; summaryEn: string; dutiesAr: string; dutiesEn: string; chairNameAr: string; chairNameEn: string; activityTagsAr: string; activityTagsEn: string; logoUrl: string | null; sortOrder: number; isActive: boolean }
type Row = CommitteeRow;
interface Full extends Row { members: Member[]; activities: Activity[]; news: LinkedNews[] }
type Draft = Omit<Row, 'id' | 'sortOrder'> & { id?: number; sortOrder: string };

const ROLES = ['chair', 'secretary', 'vice', 'member'];
const ACTS = ['meeting', 'visit', 'recommendation', 'output', 'event', 'initiative', 'success'];
const EMPTY: Draft = { kind: 'sector', nameAr: '', nameEn: '', summaryAr: '', summaryEn: '', dutiesAr: '', dutiesEn: '', chairNameAr: '', chairNameEn: '', activityTagsAr: '', activityTagsEn: '', logoUrl: null, sortOrder: '0', isActive: true };
const EMPTY_MEMBER = { role: 'member', nameAr: '', nameEn: '', titleAr: '', titleEn: '', sortOrder: '0' };
const EMPTY_ACT = { kind: 'meeting', titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', goalsAr: '', goalsEn: '', resultsAr: '', resultsEn: '', eventDate: '' };

/**
 * The window of one committee: details, members, activities (meetings, visits, recommendations, initiatives ...) and linked news.
 * Used by the Settings table and by the public Committees pages (so a manager does not have to leave the page).
 * Give `row` (already loaded) or `id` (loaded here); with neither it adds a new committee. `onChanged` runs when the window closes after a change.
 */
export function CommitteeDialog({ row, id, kind = 'sector', initialTab, onClose, onChanged }: { row?: Row | null; id?: number; /** what a NEW committee is: a sector committee (default) or the businesswomen one; an existing record keeps its own kind */ kind?: 'sector' | 'women'; initialTab?: 'details' | 'members' | 'activities' | 'news'; onClose: () => void; onChanged: () => void }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<'details' | 'members' | 'activities' | 'news'>(initialTab ?? 'details');
  const [full, setFull] = useState<Full | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [dropLogo, setDropLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  // members
  const [mDraft, setMDraft] = useState<(typeof EMPTY_MEMBER & { id?: number; photoUrl?: string | null }) | null>(null);
  const [mPhoto, setMPhoto] = useState<File | null>(null);
  const [mDrop, setMDrop] = useState(false);
  // activities
  const [aDraft, setADraft] = useState<(typeof EMPTY_ACT & { id?: number }) | null>(null);
  // news
  const [nq, setNq] = useState('');
  const [found, setFound] = useState<LinkedNews[]>([]);

  const canUpdate = can('committees.update');
  const dirty = useRef(false); // something was saved: the page behind the window reloads when it closes
  const loadFull = async (cid: number) => {
    const f = await api<Full>(`/admin/committees/${cid}/full`);
    setFull(f);
    return f;
  };
  useEffect(() => {
    if (row) { setDraft({ ...row, sortOrder: String(row.sortOrder) }); loadFull(row.id).catch((err: any) => toast(err.message, 'err')); return; }
    if (id) { loadFull(id).then((f) => setDraft({ ...f, sortOrder: String(f.sortOrder) })).catch((err: any) => { toast(err.message, 'err'); onClose(); }); return; }
    setDraft({ ...EMPTY, kind });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { if (dirty.current) onChanged(); onClose(); };

  const pickImage = (f: File | undefined, set: (f: File) => void) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast(t('board.imageOnly'), 'err');
    if (f.size > 5 * 1024 * 1024) return toast('≤ 5MB', 'err');
    set(f);
  };

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const f = draft;
    const fd = new FormData();
    fd.set('kind', f.kind); fd.set('nameAr', f.nameAr.trim()); fd.set('nameEn', f.nameEn.trim());
    fd.set('summaryAr', f.summaryAr); fd.set('summaryEn', f.summaryEn); fd.set('dutiesAr', f.dutiesAr); fd.set('dutiesEn', f.dutiesEn);
    fd.set('chairNameAr', f.chairNameAr.trim()); fd.set('chairNameEn', f.chairNameEn.trim());
    fd.set('activityTagsAr', f.activityTagsAr); fd.set('activityTagsEn', f.activityTagsEn);
    fd.set('sortOrder', String(Number(f.sortOrder) || 0)); fd.set('isActive', String(f.isActive));
    if (logo) fd.set('logo', logo); else if (f.id && dropLogo) fd.set('removeLogo', 'true');
    setBusy(true);
    try {
      const saved = await api<Row>(f.id ? `/admin/committees/${f.id}` : '/admin/committees', { method: f.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      dirty.current = true;
      setLogo(null); setDropLogo(false);
      setDraft({ ...saved, sortOrder: String(saved.sortOrder) });
      await loadFull(saved.id);
      if (!f.id) toast(t('cm.addMore'));
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  const saveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mDraft || !draft?.id) return;
    const fd = new FormData();
    fd.set('role', mDraft.role); fd.set('nameAr', mDraft.nameAr.trim()); fd.set('nameEn', mDraft.nameEn.trim());
    fd.set('titleAr', mDraft.titleAr.trim()); fd.set('titleEn', mDraft.titleEn.trim()); fd.set('sortOrder', String(Number(mDraft.sortOrder) || 0));
    if (mPhoto) fd.set('photo', mPhoto); else if (mDraft.id && mDrop) fd.set('removePhoto', 'true');
    try {
      await api(mDraft.id ? `/admin/committees/members/${mDraft.id}` : `/admin/committees/${draft.id}/members`, { method: mDraft.id ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      dirty.current = true;
      setMDraft(null); setMPhoto(null); setMDrop(false);
      await loadFull(draft.id);
    } catch (err: any) { toast(err.message, 'err'); }
  };
  const removeMember = async (m: Member) => {
    if (!draft?.id || !confirm(t('tbl.confirmDelete'))) return;
    try { await api(`/admin/committees/members/${m.id}`, { method: 'DELETE' }); dirty.current = true; await loadFull(draft.id); } catch (err: any) { toast(err.message, 'err'); }
  };

  const saveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aDraft || !draft?.id) return;
    const body = {
      kind: aDraft.kind, titleAr: aDraft.titleAr.trim(), titleEn: aDraft.titleEn.trim() || null,
      bodyAr: aDraft.bodyAr || null, bodyEn: aDraft.bodyEn || null,
      goalsAr: aDraft.goalsAr || null, goalsEn: aDraft.goalsEn || null,
      resultsAr: aDraft.resultsAr || null, resultsEn: aDraft.resultsEn || null,
      eventDate: aDraft.eventDate || null,
    };
    try {
      await api(aDraft.id ? `/admin/committees/activities/${aDraft.id}` : `/admin/committees/${draft.id}/activities`, { method: aDraft.id ? 'PATCH' : 'POST', body });
      toast(t('app.saved'));
      dirty.current = true;
      setADraft(null);
      await loadFull(draft.id);
    } catch (err: any) { toast(err.message, 'err'); }
  };
  const removeActivity = async (a: Activity) => {
    if (!draft?.id || !confirm(t('tbl.confirmDelete'))) return;
    try { await api(`/admin/committees/activities/${a.id}`, { method: 'DELETE' }); dirty.current = true; await loadFull(draft.id); } catch (err: any) { toast(err.message, 'err'); }
  };

  const searchNews = async () => {
    if (!draft?.id) return;
    try { setFound(await api<LinkedNews[]>(`/admin/committees/${draft.id}/news-search`, { params: { q: nq } })); } catch (err: any) { toast(err.message, 'err'); }
  };
  const linkNews = async (n: LinkedNews) => {
    if (!draft?.id) return;
    try { await api(`/admin/committees/${draft.id}/news`, { method: 'POST', body: { newsIds: [n.id] } }); setFound((x) => x.filter((y) => y.id !== n.id)); dirty.current = true; await loadFull(draft.id); } catch (err: any) { toast(err.message, 'err'); }
  };
  const unlinkNews = async (n: LinkedNews) => {
    if (!draft?.id) return;
    try { await api(`/admin/committees/${draft.id}/news/unlink`, { method: 'POST', body: { newsIds: [n.id] } }); dirty.current = true; await loadFull(draft.id); } catch (err: any) { toast(err.message, 'err'); }
  };

  const tabBtn = (k: typeof tab, label: string, disabled = false) => (
    <button type="button" disabled={disabled} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-40 ${tab === k ? 'bg-secondary text-white' : 'bg-primary/10 text-ink/80 hover:bg-primary/20'}`}>{label}</button>
  );
  const hasId = !!draft?.id;

  return (
  <Modal open onClose={close} title={hasId ? t('cm.edit') : t('cm.add')} wide>
    {!draft ? <div className="flex justify-center py-10"><Spinner /></div> : (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabBtn('details', t('cm.manage.details'))}
          {tabBtn('members', t('cm.manage.members'), !hasId)}
          {tabBtn('activities', t('cm.manage.activities'), !hasId)}
          {tabBtn('news', t('cm.manage.news'), !hasId)}
        </div>
        {!hasId && <p className="text-xs text-gray-500">{t('cm.saveFirst')}</p>}

        {tab === 'details' && (
          <form onSubmit={saveDetails} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('faq.order')}><input type="number" min={0} max={100000} className={inputCls} value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })} /></Field>
              <Field label={t('pg.titleAr')}><input required maxLength={255} dir="rtl" className={inputCls} value={draft.nameAr} onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })} /></Field>
              <Field label={t('pg.titleEn')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.nameEn} onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} /></Field>
              <Field label={t('cm.chairAr')}><input maxLength={255} dir="rtl" className={inputCls} value={draft.chairNameAr} onChange={(e) => setDraft({ ...draft, chairNameAr: e.target.value })} /></Field>
              <Field label={t('cm.chairEn')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.chairNameEn} onChange={(e) => setDraft({ ...draft, chairNameEn: e.target.value })} /></Field>
              <Field label={t('cm.tagsAr')} hint={t('cm.tagsHint')}><textarea rows={2} maxLength={3000} dir="rtl" className={inputCls} value={draft.activityTagsAr} onChange={(e) => setDraft({ ...draft, activityTagsAr: e.target.value })} /></Field>
              <Field label={t('cm.tagsEn')} hint={t('cm.tagsHint')}><textarea rows={2} maxLength={3000} dir="ltr" className={inputCls} value={draft.activityTagsEn} onChange={(e) => setDraft({ ...draft, activityTagsEn: e.target.value })} /></Field>
              <Field label={t('cm.summaryAr')}><textarea rows={3} maxLength={5000} dir="rtl" className={inputCls} value={draft.summaryAr} onChange={(e) => setDraft({ ...draft, summaryAr: e.target.value })} /></Field>
              <Field label={t('cm.summaryEn')}><textarea rows={3} maxLength={5000} dir="ltr" className={inputCls} value={draft.summaryEn} onChange={(e) => setDraft({ ...draft, summaryEn: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} />{t('faq.active')}</label>
            </div>
            <Field label={t('cm.logo')} hint={t('board.photoHint')}>
              <input type="file" accept="image/jpeg,image/png,image/webp" className={inputCls} onChange={(e) => { pickImage(e.target.files?.[0], (f) => { setLogo(f); setDropLogo(false); }); e.target.value = ''; }} />
            </Field>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {logo && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{logo.name}</span>}
              {!logo && draft.logoUrl && !dropLogo && (<><img src={fileUrl(draft.logoUrl)} alt="" className="h-16 w-16 rounded object-contain" /><button type="button" className="text-red-600 underline" onClick={() => setDropLogo(true)}>{t('board.removePhoto')}</button></>)}
              {dropLogo && <span className="text-gray-500">{t('board.photoRemoved')}</span>}
            </div>
            <Field label={t('cm.dutiesAr')}><RichEditor key={`da-${draft.id ?? 'new'}`} value={draft.dutiesAr} onChange={(h) => setDraft((d) => (d ? { ...d, dutiesAr: h } : d))} dir="rtl" /></Field>
            <Field label={t('cm.dutiesEn')} hint={t('faq.hint')}><RichEditor key={`de-${draft.id ?? 'new'}`} value={draft.dutiesEn} onChange={(h) => setDraft((d) => (d ? { ...d, dutiesEn: h } : d))} dir="ltr" /></Field>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{t('app.cancel')}</Button><Button disabled={busy}>{t('app.save')}</Button></div>
          </form>
        )}

        {tab === 'members' && hasId && (
          <div className="space-y-3">
            {!mDraft && canUpdate && <Button size="sm" onClick={() => { setMDraft({ ...EMPTY_MEMBER }); setMPhoto(null); setMDrop(false); }}>＋ {t('cm.addMember')}</Button>}
            {mDraft && (
              <form onSubmit={saveMember} className="space-y-3 rounded-xl border border-line p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t('board.position')}><select className={inputCls} value={mDraft.role} onChange={(e) => setMDraft({ ...mDraft, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{t(`cm.role.${r}`)}</option>)}</select></Field>
                  <Field label={t('faq.order')}><input type="number" min={0} className={inputCls} value={mDraft.sortOrder} onChange={(e) => setMDraft({ ...mDraft, sortOrder: e.target.value })} /></Field>
                  <Field label={t('pg.titleAr')}><input required maxLength={255} dir="rtl" className={inputCls} value={mDraft.nameAr} onChange={(e) => setMDraft({ ...mDraft, nameAr: e.target.value })} /></Field>
                  <Field label={t('pg.titleEn')}><input maxLength={255} dir="ltr" className={inputCls} value={mDraft.nameEn} onChange={(e) => setMDraft({ ...mDraft, nameEn: e.target.value })} /></Field>
                  <Field label={t('board.jobTitleAr')}><input maxLength={255} dir="rtl" className={inputCls} value={mDraft.titleAr} onChange={(e) => setMDraft({ ...mDraft, titleAr: e.target.value })} /></Field>
                  <Field label={t('board.jobTitleEn')}><input maxLength={255} dir="ltr" className={inputCls} value={mDraft.titleEn} onChange={(e) => setMDraft({ ...mDraft, titleEn: e.target.value })} /></Field>
                </div>
                <Field label={t('board.photo')} hint={t('board.photoHint')}><input type="file" accept="image/jpeg,image/png,image/webp" className={inputCls} onChange={(e) => { pickImage(e.target.files?.[0], (f) => { setMPhoto(f); setMDrop(false); }); e.target.value = ''; }} /></Field>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {mPhoto && <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{mPhoto.name}</span>}
                  {!mPhoto && mDraft.photoUrl && !mDrop && (<><img src={fileUrl(mDraft.photoUrl)} alt="" className="h-12 w-12 rounded-full object-cover" /><button type="button" className="text-red-600 underline" onClick={() => setMDrop(true)}>{t('board.removePhoto')}</button></>)}
                </div>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMDraft(null)}>{t('app.cancel')}</Button><Button>{t('app.save')}</Button></div>
              </form>
            )}
            <ul className="divide-y divide-line rounded-xl border border-line">
              {(full?.members ?? []).length === 0 && <li className="p-3 text-sm text-gray-500">{t('cm.noMembers')}</li>}
              {(full?.members ?? []).map((m) => (
                <li key={m.id} className="flex items-center gap-3 p-3 text-sm">
                  {m.photoUrl ? <img src={fileUrl(m.photoUrl)} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">👤</span>}
                  <span className="min-w-0 flex-1"><b>{m.nameAr}</b> <span className="text-xs text-primary">{t(`cm.role.${m.role}`)}</span><span className="block truncate text-xs text-gray-500">{m.titleAr}</span></span>
                  {canUpdate && <><Button size="sm" variant="outline" onClick={() => { setMDraft({ ...m, sortOrder: String(m.sortOrder) }); setMPhoto(null); setMDrop(false); }}>{t('app.edit')}</Button><Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => removeMember(m)}>✕</Button></>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'activities' && hasId && (
          <div className="space-y-3">
            {!aDraft && canUpdate && <Button size="sm" onClick={() => setADraft({ ...EMPTY_ACT })}>＋ {t('cm.addActivity')}</Button>}
            {aDraft && (
              <form onSubmit={saveActivity} className="space-y-3 rounded-xl border border-line p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label={t('cm.actKind')}><select className={inputCls} value={aDraft.kind} onChange={(e) => setADraft({ ...aDraft, kind: e.target.value })}>{ACTS.filter((k) => (k !== 'initiative' && k !== 'success') || draft.kind === 'women').map((k) => <option key={k} value={k}>{t(`cm.act.${k}`)}</option>)}</select></Field>
                  <Field label={t('cm.date')}><input type="date" className={inputCls} value={aDraft.eventDate ?? ''} onChange={(e) => setADraft({ ...aDraft, eventDate: e.target.value })} /></Field>
                  <Field label={t('pg.titleAr')}><input required maxLength={255} dir="rtl" className={inputCls} value={aDraft.titleAr} onChange={(e) => setADraft({ ...aDraft, titleAr: e.target.value })} /></Field>
                  <Field label={t('pg.titleEn')}><input maxLength={255} dir="ltr" className={inputCls} value={aDraft.titleEn} onChange={(e) => setADraft({ ...aDraft, titleEn: e.target.value })} /></Field>
                </div>
                <Field label={t('cm.bodyAr')}><RichEditor key={`aa-${aDraft.id ?? 'new'}`} value={aDraft.bodyAr} onChange={(h) => setADraft((d) => (d ? { ...d, bodyAr: h } : d))} dir="rtl" /></Field>
                <Field label={t('cm.bodyEn')} hint={t('faq.hint')}><RichEditor key={`ae-${aDraft.id ?? 'new'}`} value={aDraft.bodyEn} onChange={(h) => setADraft((d) => (d ? { ...d, bodyEn: h } : d))} dir="ltr" /></Field>
                {(aDraft.kind === 'initiative' || aDraft.kind === 'success') && <>
                  <Field label={t('women.goals')}><RichEditor key={`ag-${aDraft.id ?? 'new'}`} value={aDraft.goalsAr} onChange={(h) => setADraft((d) => (d ? { ...d, goalsAr: h } : d))} dir="rtl" /></Field>
                  <Field label={t('women.goalsEn')}><RichEditor key={`age-${aDraft.id ?? 'new'}`} value={aDraft.goalsEn} onChange={(h) => setADraft((d) => (d ? { ...d, goalsEn: h } : d))} dir="ltr" /></Field>
                  <Field label={t('women.results')}><RichEditor key={`ar-${aDraft.id ?? 'new'}`} value={aDraft.resultsAr} onChange={(h) => setADraft((d) => (d ? { ...d, resultsAr: h } : d))} dir="rtl" /></Field>
                  <Field label={t('women.resultsEn')}><RichEditor key={`are-${aDraft.id ?? 'new'}`} value={aDraft.resultsEn} onChange={(h) => setADraft((d) => (d ? { ...d, resultsEn: h } : d))} dir="ltr" /></Field>
                </>}
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setADraft(null)}>{t('app.cancel')}</Button><Button>{t('app.save')}</Button></div>
              </form>
            )}
            <ul className="divide-y divide-line rounded-xl border border-line">
              {(full?.activities ?? []).length === 0 && <li className="p-3 text-sm text-gray-500">{t('cm.noActivities')}</li>}
              {(full?.activities ?? []).map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-3 text-sm">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t(`cm.act.${a.kind}`)}</span>
                  <span className="min-w-0 flex-1 truncate">{a.titleAr}</span>
                  <span className="text-xs text-gray-500">{a.eventDate ? fmtDay('ar', a.eventDate) : ''}</span>
                  {canUpdate && <><Button size="sm" variant="outline" onClick={() => setADraft({ ...a, eventDate: a.eventDate ?? '' })}>{t('app.edit')}</Button><Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => removeActivity(a)}>✕</Button></>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'news' && hasId && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('cm.newsHint')}</p>
            <div className="flex gap-2">
              <input value={nq} onChange={(e) => setNq(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchNews(); } }} placeholder={t('cm.searchNews')} className={inputCls} />
              <Button type="button" onClick={searchNews}>{t('app.search')}</Button>
            </div>
            {found.length > 0 && (
              <ul className="divide-y divide-line rounded-xl border border-line">
                {found.map((n) => (
                  <li key={n.id} className="flex items-center gap-3 p-3 text-sm"><span className="min-w-0 flex-1 truncate">{n.title}</span><span className="text-xs text-gray-500">{fmtDate('ar', n.publishAt)}</span><Button size="sm" onClick={() => linkNews(n)}>{t('cm.linkNews')}</Button></li>
                ))}
              </ul>
            )}
            <h3 className="text-sm font-bold">{t('cm.linkedNews')}</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {(full?.news ?? []).length === 0 && <li className="p-3 text-sm text-gray-500">{t('cm.noContent')}</li>}
              {(full?.news ?? []).map((n) => (
                <li key={n.id} className="flex items-center gap-3 p-3 text-sm"><span className="min-w-0 flex-1 truncate">{n.title}</span><span className="text-xs text-gray-500">{fmtDate('ar', n.publishAt)}</span><Button size="sm" variant="ghost" className="text-red-600" onClick={() => unlinkNews(n)}>{t('cm.unlink')}</Button></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )}
  </Modal>
  );
}

/** Committees (sector + businesswomen): the table of Settings; the window of a committee is `CommitteeDialog`. */
/** `kind` picks the table: sector committees (Committees settings, the default) or the businesswomen committee (Women settings). */
export function CommitteesAdmin({ kind = 'sector' }: { kind?: 'sector' | 'women' } = {}) {
  const { t, href } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ row?: Row } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ row: Row; reload: () => void } | null>(null);
  const [key, setKey] = useState(0);
  const canUpdate = can('committees.update');
  // the businesswomen committee: one only, so its table offers "add" only while there is none
  const [womenCount, setWomenCount] = useState<number | null>(null);
  useEffect(() => {
    if (kind !== 'women') return;
    api<{ meta: { total: number } }>('/admin/committees', { params: { kind: 'women', limit: 1 } }).then((r) => setWomenCount(r.meta.total)).catch(() => setWomenCount(null));
  }, [kind, key]);

  const yn = (on: boolean) => <span className={`rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(on ? 'sub.yes' : 'sub.no')}</span>;
  const cols: Col<Row>[] = [
    { key: 'nameAr', label: t('pg.titleAr'), render: (r) => <span className="flex items-center gap-2">{r.logoUrl && <img src={fileUrl(r.logoUrl)} alt="" className="h-8 w-8 rounded object-contain" />}{r.nameAr}</span>, text: (r) => r.nameAr },
    { key: 'nameEn', label: t('pg.titleEn') },
    { key: 'chairNameAr', label: t('cm.chair') },
    { key: 'sortOrder', searchable: false, label: t('faq.order'), render: (r) => r.sortOrder, text: (r) => String(r.sortOrder) },
    { key: 'isActive', searchable: false, label: t('faq.active'), render: (r) => yn(r.isActive), text: (r) => t(r.isActive ? 'sub.yes' : 'sub.no') },
  ];

  const removeCommittee = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/admin/committees/${deleteTarget.row.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      deleteTarget.reload();
      setDeleteTarget(null);
    } catch (err: any) { toast(err.message, 'err'); }
  };

  return (
    <RequirePerm any={['committees.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.committees')}</h1>
      <DataTable<Row>
        endpoint="/admin/committees"
        baseParams={{ kind }}
        columns={cols}
        refreshKey={key}
        exportable={false}
        bulkDelete={{ path: '/admin/committees/bulk-delete', can: can('committees.delete') }}
        toolbar={(kind === 'women' ? womenCount === 0 : true) && can('committees.create') && <Button onClick={() => setDialog({})}>＋ {t('cm.add')}</Button>}
        rowActions={(r, reload) => (
          <div className="flex gap-1">
            <Link href={href(r.kind === 'women' ? '/committees/women' : `/committees/view?id=${r.id}`)} target="_blank" className="rounded-lg border px-2.5 py-1 text-xs hover:bg-gray-50">{t('pg.view')}</Link>
            {canUpdate && <Button size="sm" variant="outline" onClick={() => setDialog({ row: r })}>{t('app.edit')}</Button>}
            {can('committees.delete') && <Button size="sm" variant="ghost" className="text-red-600" aria-label={t('app.delete')} onClick={() => setDeleteTarget({ row: r, reload })}>✕</Button>}
          </div>
        )}
      />


      {dialog && <CommitteeDialog key={dialog.row?.id ?? 'new'} row={dialog.row} kind={kind} onClose={() => setDialog(null)} onChanged={() => setKey((k) => k + 1)} />}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('app.confirm')}>
        <p className="mb-5">{t('tbl.confirmDelete')}</p>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('app.cancel')}</Button><Button type="button" variant="danger" onClick={removeCommittee}>{t('app.delete')}</Button></div>
      </Modal>
    </RequirePerm>
  );
}
