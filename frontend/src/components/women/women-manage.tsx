'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/components/ui/toast';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { RichEditor } from '@/components/admin/rich-editor';
import { createContext, useContext } from 'react';
import { womenPageHref } from '@/lib/women-menu';
import { useSite } from '@/components/site/site-context';
import { parseYoutubeId } from '@/lib/youtube';

/** the committee being edited and what to do after a change (set by the committee page) */
const AdminCtx = createContext<{ id: number; reload: () => void }>({ id: 0, reload: () => {} });
export const WomenAdminProvider = AdminCtx.Provider;
const useWomen = () => { const { id, reload } = useContext(AdminCtx); return { data: id ? { id } : null, reload }; };
/** tr('عربي', 'English'): the text of the current language */
export function useTr() {
  const { lang } = useI18n();
  return (ar: string, en: string) => (lang === 'ar' ? ar : en);
}

/** Everything on the women site that can be edited in place. Shown only to users who may edit committees (the API checks it again). */
export const useCanManage = () => useAuth().can('committees.update');

interface FullAct {
  id: number; kind: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; eventDate: string | null; endDate: string | null; subtitleAr: string; subtitleEn: string;
  goalsAr: string; goalsEn: string; resultsAr: string; resultsEn: string; eventType: string | null; archived: boolean; imageUrl: string | null;
}
interface FullMember { id: number; role: string; nameAr: string; nameEn: string; titleAr: string; titleEn: string; photoUrl: string | null; sortOrder: number }
interface Full { id: number; members: FullMember[]; activities: FullAct[]; [k: string]: any }

const loadFull = (id: number) => api<Full>(`/admin/committees/${id}/full`);

function Tabs({ lang, setLang }: { lang: 'ar' | 'en'; setLang: (l: 'ar' | 'en') => void }) {
  return (
    <div className="mb-3 inline-flex rounded-full bg-primary/10 p-1 text-xs font-bold">
      {(['ar', 'en'] as const).map((l) => <button key={l} type="button" onClick={() => setLang(l)} className={`rounded-full px-4 py-1 ${lang === l ? 'bg-primary text-white' : 'text-primary'}`}>{l === 'ar' ? 'العربية' : 'English'}</button>)}
    </div>
  );
}

function ImagePick({ current, file, setFile, remove, setRemove, label }: { current: string | null; file: File | null; setFile: (f: File | null) => void; remove: boolean; setRemove: (b: boolean) => void; label: string }) {
  const tr = useTr();
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  const shown = preview || (!remove && current ? fileUrl(current) : null);
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {shown ? <img src={shown} alt="" className="h-16 w-24 rounded-lg object-cover ring-1 ring-line" /> : <span className="grid h-16 w-24 place-items-center rounded-lg bg-primary/10 text-primary">🖼</span>}
        <div className="space-y-1 text-xs">
          <input type="file" accept="image/*" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemove(false); }} />
          {(current || file) && !remove && <button type="button" onClick={() => { setFile(null); setRemove(true); }} className="block text-red-600 hover:underline">{tr('إزالة الصورة', 'Remove picture')}</button>}
        </div>
      </div>
    </Field>
  );
}

// ---------------------------------------------------------------- activities: initiatives, activities & events, success stories
export type ActGroup = 'initiative' | 'activity' | 'success';
const GROUP_KINDS: Record<ActGroup, string[]> = { initiative: ['initiative'], activity: ['meeting', 'visit', 'event'], success: ['success'] };
const EMPTY_ACT = { kind: 'event', eventType: '', titleAr: '', titleEn: '', subtitleAr: '', subtitleEn: '', eventDate: '', endDate: '', bodyAr: '', bodyEn: '', goalsAr: '', goalsEn: '', resultsAr: '', resultsEn: '', archived: false };

/** today as yyyy-mm-dd in the visitor's own time zone (what a person means by "today" when picking a date) */
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayCount = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000) + 1;

/** Add (no `editId`) or edit one initiative / activity / success story, in a window over the page. */
export function ActivityDialog({ group, editId, defaultKind, onClose }: { group: ActGroup; editId?: number; defaultKind?: string; onClose: () => void }) {
  const tr = useTr();
  const toast = useToast();
  const { data, reload } = useWomen();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const kinds = GROUP_KINDS[group];
  const [f, setF] = useState({ ...EMPTY_ACT, kind: defaultKind && kinds.includes(defaultKind) ? defaultKind : kinds[0], eventDate: !editId && group !== 'success' ? localToday() : '' }); // a new initiative / activity starts today by default
  const [loaded, setLoaded] = useState(!editId);
  const [image, setImage] = useState<File | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [dropImage, setDropImage] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editId || !data) return;
    loadFull(data.id).then((full) => {
      const a = full.activities.find((x) => x.id === editId);
      if (!a) { toast(tr('العنصر غير موجود', 'Item not found'), 'err'); onClose(); return; }
      setF({ kind: a.kind, eventType: a.eventType ?? '', titleAr: a.titleAr, titleEn: a.titleEn ?? '', subtitleAr: a.subtitleAr ?? '', subtitleEn: a.subtitleEn ?? '', eventDate: a.eventDate ?? '', endDate: a.endDate ?? '', bodyAr: a.bodyAr ?? '', bodyEn: a.bodyEn ?? '', goalsAr: a.goalsAr ?? '', goalsEn: a.goalsEn ?? '', resultsAr: a.resultsAr ?? '', resultsEn: a.resultsEn ?? '', archived: a.archived });
      setCurrent(a.imageUrl);
      setLoaded(true);
    }).catch((e) => { toast(e.message, 'err'); onClose(); });
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof EMPTY_ACT, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const L = (k: string) => `${k}${lang === 'ar' ? 'Ar' : 'En'}` as keyof typeof EMPTY_ACT;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const isInit = group === 'initiative';
  const isStory = group === 'success';

  const save = async () => {
    if (!data) return;
    if (!f.titleAr.trim()) { setLang('ar'); toast(tr('العنوان بالعربية مطلوب', 'The Arabic title is required'), 'err'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('kind', f.kind);
      for (const k of ['titleAr', 'titleEn', 'subtitleAr', 'subtitleEn', 'bodyAr', 'bodyEn', 'goalsAr', 'goalsEn', 'resultsAr', 'resultsEn'] as const) fd.set(k, f[k]);
      const start = isStory && f.eventDate > new Date().toISOString().slice(0, 10) ? '' : f.eventDate;
      const end = isStory ? '' : f.endDate;
      if (end && !start) { toast(tr('أدخلي تاريخ البدء قبل تاريخ الانتهاء', 'Enter the start date before the end date'), 'err'); setBusy(false); return; }
      if (end && end < start) { toast(tr('تاريخ الانتهاء لا يمكن أن يسبق تاريخ البدء', 'The end date cannot be before the start date'), 'err'); setBusy(false); return; }
      fd.set('eventDate', start);
      fd.set('endDate', end);
      fd.set('eventType', f.kind === 'event' ? f.eventType : '');
      fd.set('archived', String(f.archived));
      if (image) fd.set('image', image);
      if (dropImage) fd.set('removeImage', 'true');
      if (editId) await api(`/admin/committees/activities/${editId}`, { method: 'PATCH', form: fd });
      else await api(`/admin/committees/${data.id}/activities`, { method: 'POST', form: fd });
      toast(tr('تم الحفظ', 'Saved'));
      reload();
      onClose();
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  };

  const title = editId ? tr('تعديل', 'Edit') : isInit ? tr('إضافة مبادرة أو مشروع', 'Add an initiative or project') : isStory ? tr('إضافة قصة نجاح', 'Add a success story') : tr('إضافة نشاط أو فعالية', 'Add an activity or event');
  return (
    <Modal open onClose={onClose} title={title} wide brand>
      {!loaded ? <p className="py-8 text-center text-sm text-gray-500">…</p> : (
        <div className="space-y-4">
          <Tabs lang={lang} setLang={setLang} />
          <div className="grid gap-3 sm:grid-cols-2">
            {group === 'activity' && (
              <Field label={tr('النوع', 'Type')}>
                <select className={inputCls} value={f.kind === 'event' ? `event:${f.eventType}` : f.kind} onChange={(e) => { const [k, ty] = e.target.value.split(':'); setF((s) => ({ ...s, kind: k, eventType: ty ?? '' })); }}>
                  <option value="meeting">{tr('اجتماع', 'Meeting')}</option>
                  <option value="visit">{tr('زيارة', 'Visit')}</option>
                  <option value="event:gathering">{tr('لقاء', 'Gathering')}</option>
                  <option value="event:workshop">{tr('ورشة عمل', 'Workshop')}</option>
                  <option value="event:expo">{tr('مشاركة في معرض', 'Exhibition participation')}</option>
                  <option value="event:">{tr('فعالية أخرى', 'Other event')}</option>
                </select>
              </Field>
            )}
            {isStory
              ? <Field label={tr('التاريخ (اختياري، لا يمكن أن يكون في المستقبل)', 'Date (optional, cannot be in the future)')}><input type="date" className={inputCls} value={f.eventDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set('eventDate', e.target.value)} /></Field>
              : <>
                <Field label={tr('تاريخ البدء', 'Start date')}><input type="date" className={inputCls} value={f.eventDate} onChange={(e) => setF((s) => ({ ...s, eventDate: e.target.value, endDate: s.endDate && e.target.value && s.endDate < e.target.value ? '' : s.endDate }))} /></Field>
                <Field label={tr('تاريخ الانتهاء (اختياري)', 'End date (optional)')}>
                  <input type="date" className={inputCls} value={f.endDate} min={f.eventDate || undefined} disabled={!f.eventDate} onChange={(e) => set('endDate', e.target.value)} />
                  <span className={`mt-1.5 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs leading-5 ${f.endDate ? 'bg-emerald-50 text-emerald-800' : 'bg-primary/10 text-secondary'}`}>
                    <span aria-hidden="true">{f.endDate ? '📆' : 'ℹ️'}</span>
                    <span>{!f.eventDate
                      ? tr('اختاري تاريخ البدء أولاً.', 'Pick the start date first.')
                      : f.endDate
                        ? tr(`المدة ${dayCount(f.eventDate, f.endDate) === 1 ? 'يوم واحد' : `${dayCount(f.eventDate, f.endDate)} يوماً`}. بعد آخر يوم ينتقل تلقائياً إلى الأرشيف.`, `Runs for ${dayCount(f.eventDate, f.endDate)} ${dayCount(f.eventDate, f.endDate) === 1 ? 'day' : 'days'}. After the last day it moves to the archive by itself.`)
                        : tr('إن لم تضيفي تاريخ انتهاء فسيُعتبر ليوم واحد فقط.', 'If you do not add an end date, it counts as a one-day item.')}</span>
                  </span>
                </Field>
              </>}
          </div>
          <Field label={`${tr('العنوان', 'Title')} (${lang === 'ar' ? 'العربية' : 'English'})`}><input dir={dir} className={inputCls} value={f[L('title')] as string} onChange={(e) => set(L('title'), e.target.value)} /></Field>
          {(isInit || isStory) && <Field label={`${isStory ? tr('صاحبة التجربة / المشروع', 'Woman / project') : tr('الجهة أو الشريك (اختياري)', 'Partner (optional)')} (${lang === 'ar' ? 'العربية' : 'English'})`}><input dir={dir} className={inputCls} value={f[L('subtitle')] as string} onChange={(e) => set(L('subtitle'), e.target.value)} /></Field>}
          <Field label={isStory ? tr('القصة', 'The story') : tr('التفاصيل', 'Details')}><RichEditor key={`b-${lang}`} dir={dir} value={f[L('body')] as string} onChange={(v) => set(L('body'), v)} /></Field>
          {isInit && (
            <>
              <Field label={tr('الأهداف', 'Goals')}><RichEditor key={`g-${lang}`} dir={dir} value={f[L('goals')] as string} onChange={(v) => set(L('goals'), v)} /></Field>
              <Field label={tr('النتائج', 'Results')}><RichEditor key={`r-${lang}`} dir={dir} value={f[L('results')] as string} onChange={(v) => set(L('results'), v)} /></Field>
            </>
          )}
          <ImagePick current={current} file={image} setFile={setImage} remove={dropImage} setRemove={setDropImage} label={tr('صورة (اختياري)', 'Picture (optional)')} />
          {!isStory && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.archived} onChange={(e) => set('archived', e.target.checked)} />{tr('في الأرشيف (يبقى ظاهراً في قسم الأرشيف)', 'Archived (stays visible in the archive part)')}</label>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>{tr('إلغاء', 'Cancel')}</Button>
            <Button onClick={save} disabled={busy}>{busy ? '…' : tr('حفظ', 'Save')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- members
const ROLE_KEYS = ['chair', 'vice', 'secretary', 'member'] as const;
export function MemberDialog({ editId, defaultRole, onClose }: { editId?: number; defaultRole?: string; onClose: () => void }) {
  const tr = useTr();
  const toast = useToast();
  const { data, reload } = useWomen();
  const [f, setF] = useState({ role: defaultRole ?? 'member', nameAr: '', nameEn: '', titleAr: '', titleEn: '' });
  const [loaded, setLoaded] = useState(!editId);
  const [photo, setPhoto] = useState<File | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [drop, setDrop] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!editId || !data) return;
    loadFull(data.id).then((full) => {
      const m = full.members.find((x) => x.id === editId);
      if (!m) { onClose(); return; }
      setF({ role: m.role, nameAr: m.nameAr, nameEn: m.nameEn ?? '', titleAr: m.titleAr ?? '', titleEn: m.titleEn ?? '' });
      setCurrent(m.photoUrl);
      setLoaded(true);
    }).catch((e) => { toast(e.message, 'err'); onClose(); });
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps
  const roleName: Record<string, string> = { chair: tr('رئيسة اللجنة', 'Chair'), vice: tr('نائبة الرئيسة', 'Vice chair'), secretary: tr('أمينة السر', 'Secretary'), member: tr('عضوة', 'Member') };
  const save = async () => {
    if (!data) return;
    if (!f.nameAr.trim()) { toast(tr('الاسم بالعربية مطلوب', 'The Arabic name is required'), 'err'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => fd.set(k, v));
      if (photo) fd.set('photo', photo);
      if (drop) fd.set('removePhoto', 'true');
      if (editId) await api(`/admin/committees/members/${editId}`, { method: 'PATCH', form: fd });
      else await api(`/admin/committees/${data.id}/members`, { method: 'POST', form: fd });
      toast(tr('تم الحفظ', 'Saved'));
      reload();
      onClose();
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={editId ? tr('تعديل عضوة', 'Edit member') : tr('إضافة عضوة', 'Add a member')} brand>
      {!loaded ? <p className="py-8 text-center text-sm text-gray-500">…</p> : (
        <div className="space-y-3">
          <Field label={tr('الصفة التنظيمية', 'Role')}><select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLE_KEYS.map((r) => <option key={r} value={r}>{roleName[r]}</option>)}</select></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr('الاسم (عربي)', 'Name (Arabic)')}><input dir="rtl" className={inputCls} value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} /></Field>
            <Field label={tr('الاسم (إنجليزي)', 'Name (English)')}><input dir="ltr" className={inputCls} value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} /></Field>
            <Field label={tr('المهام / المسمى (عربي)', 'Tasks / title (Arabic)')}><input dir="rtl" className={inputCls} value={f.titleAr} onChange={(e) => setF({ ...f, titleAr: e.target.value })} /></Field>
            <Field label={tr('المهام / المسمى (إنجليزي)', 'Tasks / title (English)')}><input dir="ltr" className={inputCls} value={f.titleEn} onChange={(e) => setF({ ...f, titleEn: e.target.value })} /></Field>
          </div>
          <ImagePick current={current} file={photo} setFile={setPhoto} remove={drop} setRemove={setDrop} label={tr('الصورة الشخصية', 'Photo')} />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>{tr('إلغاء', 'Cancel')}</Button>
            <Button onClick={save} disabled={busy}>{busy ? '…' : tr('حفظ', 'Save')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- the committee's own texts (about / structure)
// `where`: "committee" = a field of the committee record, "setting" = a setting of the women site (Settings -> women)
type TextField = { key: string; where: 'committee' | 'setting'; ar: string; en: string; kind: 'text' | 'area' | 'rich' };
const FIELDS: Record<'about' | 'structure', TextField[]> = {
  about: [
    { key: 'summary', where: 'committee', ar: 'تعريف باللجنة', en: 'About the committee', kind: 'area' },
    { key: 'vision', where: 'setting', ar: 'الرؤية', en: 'Vision', kind: 'area' },
    { key: 'mission', where: 'setting', ar: 'الرسالة', en: 'Mission', kind: 'area' },
    { key: 'goals', where: 'setting', ar: 'الأهداف (كل هدف في سطر)', en: 'Goals (one per line)', kind: 'area' },
  ],
  structure: [
    { key: 'chairName', where: 'committee', ar: 'اسم رئيسة اللجنة', en: 'Chair name', kind: 'text' },
    { key: 'structure', where: 'setting', ar: 'الصفات والمهام التنظيمية (نص حر أو كل صفة في سطر)', en: 'Organisational characteristics & tasks', kind: 'area' },
    { key: 'duties', where: 'committee', ar: 'الاختصاصات والمهام', en: 'Terms of reference and tasks', kind: 'rich' },
  ],
};

export function TextsDialog({ part, onClose }: { part: 'about' | 'structure'; onClose: () => void }) {
  const tr = useTr();
  const toast = useToast();
  const { data, reload } = useWomen();
  const fields = FIELDS[part];
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [v, setV] = useState<Record<string, string> | null>(null);
  const [orig, setOrig] = useState<Record<string, string>>({});
  const [ids, setIds] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    Promise.all([loadFull(data.id), api<{ data: { id: number; key: string; value: unknown }[] }>('/admin/settings', { params: { category: 'women', limit: 100 } }).catch(() => ({ data: [] }))]).then(([full, st]) => {
      const o: Record<string, string> = {};
      const sid: Record<string, number> = {};
      const byKey = new Map(st.data.map((r) => [r.key, r]));
      for (const fl of fields) for (const l of ['Ar', 'En']) {
        const k = `${fl.key}${l}`;
        if (fl.where === 'committee') o[k] = String(full[k] ?? '');
        else { const r = byKey.get(`${fl.key}_${l.toLowerCase()}`); o[k] = r?.value == null ? '' : String(r.value); if (r) sid[k] = r.id; }
      }
      setV(o); setOrig(o); setIds(sid);
    }).catch((e) => { toast(e.message, 'err'); onClose(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!data || !v) return;
    setBusy(true);
    try {
      const fd = new FormData();
      let committeeChanged = false;
      for (const fl of fields) for (const l of ['Ar', 'En']) {
        const k = `${fl.key}${l}`;
        if (v[k] === orig[k]) continue;
        if (fl.where === 'committee') { fd.set(k, v[k]); committeeChanged = true; }
        else if (ids[k]) await api(`/admin/settings/${ids[k]}`, { method: 'PATCH', body: { value: v[k] } });
        else { toast(tr('هذا الإعداد غير موجود، شغّل التحديثات (migrations) أولاً', 'This setting does not exist yet, run the migrations first'), 'err'); setBusy(false); return; }
      }
      if (committeeChanged) await api(`/admin/committees/${data.id}`, { method: 'PATCH', form: fd });
      toast(tr('تم الحفظ', 'Saved'));
      reload();
      onClose();
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const sfx = lang === 'ar' ? 'Ar' : 'En';
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  return (
    <Modal open onClose={onClose} title={part === 'about' ? tr('تعديل «عن اللجنة»', 'Edit "About the committee"') : tr('تعديل الهيكلية التنظيمية', 'Edit the organisational structure')} wide brand>
      {!v ? <p className="py-8 text-center text-sm text-gray-500">…</p> : (
        <div className="space-y-4">
          <Tabs lang={lang} setLang={setLang} />
          {fields.map((fl) => (
            <Field key={fl.key} label={lang === 'ar' ? fl.ar : fl.en}>
              {fl.kind === 'rich'
                ? <RichEditor key={`${fl.key}-${lang}`} dir={dir} value={v[`${fl.key}${sfx}`]} onChange={(h) => setV((s) => ({ ...s!, [`${fl.key}${sfx}`]: h }))} />
                : fl.kind === 'text'
                  ? <input dir={dir} className={inputCls} value={v[`${fl.key}${sfx}`]} onChange={(e) => setV({ ...v, [`${fl.key}${sfx}`]: e.target.value })} />
                  : <textarea dir={dir} rows={5} className={inputCls} value={v[`${fl.key}${sfx}`]} onChange={(e) => setV({ ...v, [`${fl.key}${sfx}`]: e.target.value })} />}
            </Field>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>{tr('إلغاء', 'Cancel')}</Button>
            <Button onClick={save} disabled={busy}>{busy ? '…' : tr('حفظ', 'Save')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- add a news item, in a window over the women page
const NEWS_CATEGORY_FALLBACK = { ar: 'سيدات الأعمال', en: 'Businesswomen' } as const;
const MAX_NEWS_IMAGE = 5 * 1024 * 1024;
const MAX_NEWS_PDF = 25 * 1024 * 1024;
const MAX_NEWS_PDFS = 10;

/**
 * "Add a news item" without leaving the women site. The news gets the committee's own main category (Settings -> women -> news category)
 * so it shows on this page straight away. Same rules as the news form of the main site; every error is shown under its field.
 */
export function NewsDialog({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  const toast = useToast();
  const { lang } = useI18n();
  const { can } = useAuth();
  const { s } = useSite();
  const { reload } = useWomen();
  const mayPublish = can('news.publish');
  const mayFeature = can('news.feature');
  const [f, setF] = useState({ title: '', subject: '', language: lang as 'ar' | 'en', visibility: 'public', status: 'published', publishAt: '', youtubeUrl: '', body: '', isFeatured: false });
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const set = (k: keyof typeof f, v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => (e[k] ? { ...e, [k]: '' } : e)); };
  const category = String(s('women', `news_category_${f.language}`) || NEWS_CATEGORY_FALLBACK[f.language]);
  const ytId = parseYoutubeId(f.youtubeUrl);

  const addImages = (list: FileList | null) => {
    if (!list) return;
    const picked = [...list];
    const ok = picked.filter((x) => /^image\/(jpeg|png|webp|gif)$/.test(x.type) && x.size <= MAX_NEWS_IMAGE);
    const next = ok.map((file) => { const url = URL.createObjectURL(file); urls.current.push(url); return { file, url }; });
    setImages((x) => [...x, ...next]);
    setErrors((e) => ({ ...e, images: ok.length !== picked.length ? tr('بعض الصور مرفوضة: الأنواع المسموحة JPG/PNG/WEBP/GIF وحتى 5 ميغابايت للصورة', 'Some pictures were rejected: JPG/PNG/WEBP/GIF up to 5 MB each') : '' }));
  };
  const addPdfs = (list: FileList | null) => {
    if (!list) return;
    const picked = [...list];
    const ok = picked.filter((x) => (x.type === 'application/pdf' || /\.pdf$/i.test(x.name)) && x.size <= MAX_NEWS_PDF && !pdfs.some((y) => y.name === x.name && y.size === x.size));
    const room = MAX_NEWS_PDFS - pdfs.length;
    setPdfs((x) => [...x, ...ok.slice(0, Math.max(room, 0))]);
    setErrors((e) => ({ ...e, pdfs: ok.length !== picked.length || ok.length > room ? tr('بعض الملفات مرفوضة: PDF فقط، حتى 25 ميغابايت للملف و10 ملفات', 'Some files were rejected: PDF only, up to 25 MB each and 10 files') : '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = tr('العنوان مطلوب', 'The title is required');
    else if (f.title.trim().length > 255) e.title = tr('العنوان أطول من 255 حرفاً', 'The title is longer than 255 characters');
    if (f.subject.length > 500) e.subject = tr('الموضوع أطول من 500 حرف', 'The subject is longer than 500 characters');
    if (!f.body.replace(/<[^>]*>/g, '').trim()) e.body = tr('نص الخبر مطلوب', 'The news text is required');
    if (f.youtubeUrl.trim() && !ytId) e.youtubeUrl = tr('رابط يوتيوب غير صالح', 'Not a valid YouTube link');
    if (mayPublish && f.status === 'scheduled') {
      if (!f.publishAt) e.publishAt = tr('وقت النشر مطلوب للخبر المجدول', 'The publish time is required for a scheduled item');
      else if (new Date(f.publishAt).getTime() <= Date.now()) e.publishAt = tr('وقت الجدولة يجب أن يكون في المستقبل', 'The scheduled time must be in the future');
    }
    if (mayPublish && f.status === 'published' && f.publishAt && new Date(f.publishAt).getTime() > Date.now() + 60_000) e.publishAt = tr('لنشر في وقت مستقبلي اختاري الحالة «مجدولة»', 'To publish later, choose the status "Scheduled"');
    return e;
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors((old) => ({ images: old.images ?? '', pdfs: old.pdfs ?? '', ...e }));
    if (Object.values(e).some(Boolean)) { toast(tr('راجعي الحقول المظللة أسفل كل حقل', 'Please check the messages under the fields'), 'err'); return; }
    const fd = new FormData();
    fd.set('title', f.title.trim());
    fd.set('subject', f.subject.trim());
    fd.set('mainCategory', category);
    fd.set('language', f.language);
    fd.set('visibility', f.visibility);
    fd.set('body', f.body);
    if (f.youtubeUrl.trim()) fd.set('youtubeUrl', f.youtubeUrl.trim());
    if (mayFeature) fd.set('isFeatured', String(f.isFeatured));
    if (mayPublish) {
      fd.set('status', f.status);
      fd.set('publishAt', f.publishAt ? new Date(f.publishAt).toISOString() : '');
    }
    images.forEach((i) => fd.append('images', i.file));
    pdfs.forEach((p) => fd.append('pdf', p));
    setBusy(true);
    try {
      await api('/admin/news', { method: 'POST', form: fd });
      toast(tr('تمت إضافة الخبر', 'The news item was added'));
      reload();
      onClose();
    } catch (err: any) { toast(err.message, 'err'); } finally { setBusy(false); }
  };

  const dir = f.language === 'ar' ? 'rtl' : 'ltr';
  return (
    <Modal open onClose={onClose} title={tr('إضافة خبر', 'Add a news item')} wide brand>
      <form onSubmit={save} noValidate className="space-y-4">
        <p className="rounded-xl bg-primary/10 px-3 py-2 text-xs leading-5 text-secondary">
          {tr(`سيظهر الخبر في هذه الصفحة تلقائياً ضمن التصنيف «${category}».`, `The news item will appear on this page automatically under the category "${category}".`)}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label={tr('العنوان', 'Title')} error={errors.title}><input maxLength={255} dir={dir} className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field label={tr('الموضوع / ملخص قصير (اختياري)', 'Subject / short summary (optional)')} error={errors.subject}><input maxLength={500} dir={dir} className={inputCls} value={f.subject} onChange={(e) => set('subject', e.target.value)} /></Field></div>
          <Field label={tr('لغة الخبر', 'News language')} hint={tr('يظهر الخبر في الصفحة بنفس لغته', 'It shows on the page in its own language')}>
            <select className={inputCls} value={f.language} onChange={(e) => set('language', e.target.value)}><option value="ar">العربية</option><option value="en">English</option></select>
          </Field>
          <Field label={tr('من يراه؟', 'Who can see it?')}>
            <select className={inputCls} value={f.visibility} onChange={(e) => set('visibility', e.target.value)}><option value="public">{tr('الجميع', 'Everyone')}</option><option value="members">{tr('الأعضاء المسجلون فقط', 'Registered members only')}</option></select>
          </Field>
          {mayPublish && (
            <>
              <Field label={tr('الحالة', 'Status')}>
                <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}><option value="published">{tr('منشور', 'Published')}</option><option value="scheduled">{tr('مجدول', 'Scheduled')}</option></select>
              </Field>
              <Field label={tr('وقت النشر', 'Publish time')} hint={f.status === 'published' ? tr('اتركيه فارغاً للنشر الآن', 'Leave empty to publish now') : undefined} error={errors.publishAt}>
                <input type="datetime-local" className={inputCls} value={f.publishAt} onChange={(e) => set('publishAt', e.target.value)} />
              </Field>
            </>
          )}
          {mayFeature && <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={f.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} />{tr('خبر مميز', 'Featured')}</label>}
        </div>

        <Field label={tr('نص الخبر', 'News text')} error={errors.body}><RichEditor key={f.language} dir={dir} value={f.body} onChange={(h) => set('body', h)} /></Field>

        <Field label={tr('رابط فيديو يوتيوب (اختياري)', 'YouTube video link (optional)')} error={errors.youtubeUrl}>
          <input type="url" dir="ltr" maxLength={255} placeholder="https://www.youtube.com/watch?v=..." className={inputCls} value={f.youtubeUrl} onChange={(e) => set('youtubeUrl', e.target.value)} />
        </Field>

        <Field label={tr('الصور (اختياري)', 'Pictures (optional)')} hint={tr('JPG / PNG / WEBP / GIF، حتى 5 ميغابايت للصورة؛ الأولى هي صورة الخبر', 'JPG / PNG / WEBP / GIF, up to 5 MB each; the first one is the cover')} error={errors.images}>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className={inputCls} onChange={(e) => { addImages(e.target.files); e.target.value = ''; }} />
        </Field>
        {images.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {images.map((i, k) => (
              <div key={i.url} className="relative">
                <img src={i.url} alt="" className="h-20 w-20 rounded-lg object-cover ring-1 ring-line" />
                <button type="button" aria-label={tr('إزالة', 'Remove')} onClick={() => { URL.revokeObjectURL(i.url); setImages(images.filter((_, j) => j !== k)); }} className="absolute -end-2 -top-2 rounded-full bg-red-600 px-1.5 text-xs text-white">✕</button>
              </div>
            ))}
          </div>
        )}

        <Field label={tr('ملفات PDF (اختياري)', 'PDF files (optional)')} hint={tr('حتى 10 ملفات، 25 ميغابايت للملف', 'Up to 10 files, 25 MB each')} error={errors.pdfs}>
          <input type="file" multiple accept="application/pdf,.pdf" className={inputCls} onChange={(e) => { addPdfs(e.target.files); e.target.value = ''; }} />
        </Field>
        {pdfs.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {pdfs.map((p, k) => (
              <li key={`${p.name}-${p.size}`} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-1.5">
                <span className="min-w-0 truncate" dir="ltr">📄 {p.name} <span className="text-xs text-gray-500">({(p.size / 1048576).toFixed(1)} MB)</span></span>
                <button type="button" aria-label={tr('إزالة', 'Remove')} onClick={() => setPdfs(pdfs.filter((_, j) => j !== k))} className="shrink-0 rounded-full bg-red-600 px-1.5 text-xs text-white">✕</button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>{tr('إلغاء', 'Cancel')}</Button>
          <Button disabled={busy}>{busy ? '…' : tr('نشر الخبر', 'Add the news item')}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- small controls used by the pages
export type DialogState = { type: 'activity'; group: ActGroup; editId?: number; defaultKind?: string } | { type: 'member'; editId?: number; defaultRole?: string } | { type: 'texts'; part: 'about' | 'structure' } | { type: 'news' } | null;

export function Dialogs({ state, close }: { state: DialogState; close: () => void }) {
  if (!state) return null;
  if (state.type === 'activity') return <ActivityDialog group={state.group} editId={state.editId} defaultKind={state.defaultKind} onClose={close} />;
  if (state.type === 'member') return <MemberDialog editId={state.editId} defaultRole={state.defaultRole} onClose={close} />;
  if (state.type === 'news') return <NewsDialog onClose={close} />;
  return <TextsDialog part={state.part} onClose={close} />;
}

/** "+ add" style button for managers (nothing is rendered for other visitors) */
export function ManageButton({ onClick, children, tone = 'primary' }: { onClick: () => void; children: React.ReactNode; tone?: 'primary' | 'ghost' }) {
  const can = useCanManage();
  if (!can) return null;
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold shadow-sm transition ${tone === 'primary' ? 'bg-primary text-white hover:brightness-110' : 'border border-primary/40 bg-white text-primary hover:bg-primary/5'}`}>{children}</button>;
}

/**
 * Bar at the top of the committee's main page and "About" page, only for people who may manage the page
 * (the same permissions as the "Manage page" entry of the avatar menu). `children` = extra buttons of the page.
 */
export function WomenManageBar({ quickAdd = false, children }: { quickAdd?: boolean; children?: React.ReactNode }) {
  const tr = useTr();
  const { href } = useI18n();
  const { can } = useAuth();
  if (!can('committees.read', 'settings.read')) return null;
  const adminUrl = can('committees.read') ? '/admin/settings?page=women&tab=content' : '/admin/settings?page=women&tab=settings';
  const chip = 'inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-white px-4 py-2 text-sm font-bold text-primary shadow-sm transition hover:bg-primary/10';
  const quick = [
    { slug: 'initiatives', add: 'initiative', label: tr('＋ مبادرة / مشروع', '＋ Initiative / project') },
    { slug: 'activities', add: 'activity', label: tr('＋ نشاط / فعالية', '＋ Activity / event') },
    { slug: 'success', add: 'success', label: tr('＋ قصة نجاح', '＋ Success story') },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-accent/40">
      <span className="flex items-center gap-2 text-sm font-bold text-secondary">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10" aria-hidden="true">⚙</span>
        {tr('أدوات إدارة الصفحة', 'Page controls')}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {quickAdd && can('committees.update') && quick.map((x) => <Link key={x.add} href={href(`${womenPageHref(x.slug)}&add=${x.add}`)} className={chip}>{x.label}</Link>)}
        {quickAdd && can('news.create') && <Link href={href(`${womenPageHref('news')}&add=news`)} className={chip}>{tr('＋ خبر', '＋ News item')}</Link>}
        <Link href={href(adminUrl)} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-bold text-white shadow-sm ring-1 ring-accent/50 transition hover:brightness-110">⚙ {tr('إدارة الصفحة', 'Manage page')}</Link>
      </div>
    </div>
  );
}

/** edit / archive / delete for one initiative, activity, story or member */
export function ItemTools({ kind, id, archived, onEdit, canArchive = true }: { kind: 'activity' | 'member'; id: number; archived?: boolean; onEdit: () => void; canArchive?: boolean }) {
  const can = useCanManage();
  const tr = useTr();
  const toast = useToast();
  const { reload } = useWomen();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!can) return null;
  const base = kind === 'member' ? `/admin/committees/members/${id}` : `/admin/committees/activities/${id}`;
  const toggleArchive = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('archived', String(!archived));
      await api(base, { method: 'PATCH', form: fd });
      toast(archived ? tr('أُعيد إلى القائمة الحالية', 'Moved back to the current list') : tr('نُقل إلى الأرشيف', 'Moved to the archive'));
      reload();
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api(base, { method: 'DELETE' });
      toast(tr('تم الحذف', 'Deleted'));
      setAsk(false);
      reload();
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const b = 'rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold shadow-sm transition hover:border-primary hover:text-primary disabled:opacity-50';
  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-1.5" data-manage>
        <button type="button" className={b} onClick={onEdit}>✎ {tr('تعديل', 'Edit')}</button>
        {canArchive && kind === 'activity' && <button type="button" className={b} disabled={busy} onClick={toggleArchive}>{archived ? `↩ ${tr('إخراج من الأرشيف', 'Unarchive')}` : `🗄 ${tr('أرشفة', 'Archive')}`}</button>}
        <button type="button" className={`${b} text-red-600 hover:border-red-400 hover:text-red-600`} onClick={() => setAsk(true)}>🗑 {tr('حذف', 'Delete')}</button>
      </span>
      <Modal open={ask} onClose={() => setAsk(false)} title={tr('تأكيد الحذف', 'Confirm deletion')} brand>
        <p className="text-sm">{tr('سيُحذف هذا العنصر نهائياً. هل تريد المتابعة؟', 'This item will be deleted for good. Continue?')}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAsk(false)}>{tr('إلغاء', 'Cancel')}</Button>
          <Button variant="danger" onClick={remove} disabled={busy}>{tr('حذف', 'Delete')}</Button>
        </div>
      </Modal>
    </>
  );
}
