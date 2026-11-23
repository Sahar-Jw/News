'use client';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { RequirePerm } from '@/components/admin/guard';
import { RichEditor } from '@/components/admin/rich-editor';

type StaticSlug = 'about' | 'privacy' | 'terms';
interface PageRow { id: number; slug: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; sideTextAr?: string; sideTextEn?: string; photoUrl?: string | null }
interface SettingRow { id: number; key: string; value: { title?: string; body?: string } | null }
interface Draft { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string; sideTextAr: string; sideTextEn: string }

const EMPTY: Draft = { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '', sideTextAr: '', sideTextEn: '' };
const TITLES: Record<StaticSlug, [string, string]> = {
  about: ['عن الغرفة', 'About the chamber'],
  privacy: ['سياسة الخصوصية', 'Privacy policy'],
  terms: ['الشروط والأحكام', 'Terms & conditions'],
};

/** Edits only the predefined public pages. Page creation and deletion are intentionally unavailable. */
export function PagesAdmin({ slug }: { slug: StaticSlug }) {
  const { t, lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [page, setPage] = useState<PageRow | null>(null);
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [dropPhoto, setDropPhoto] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadErr('');
    setLoading(true);
    setDraft(EMPTY);
    setPhoto(null);
    setDropPhoto(false);
    if (slug === 'about') {
      api<{ data: PageRow[] }>('/admin/pages', { params: { limit: 'all' }, cache: 'no-store' }).then((result) => {
        if (!active) return;
        const found = result.data.find((row) => row.slug === slug);
        if (!found) throw new Error('The About page has not been initialized.');
        setPage(found);
        setDraft({ titleAr: found.titleAr, titleEn: found.titleEn, bodyAr: found.bodyAr, bodyEn: found.bodyEn, sideTextAr: found.sideTextAr ?? '', sideTextEn: found.sideTextEn ?? '' });
      }).catch((error: unknown) => { if (active) setLoadErr(error instanceof Error ? error.message : String(error)); })
        .finally(() => { if (active) setLoading(false); });
    } else {
      api<{ data: SettingRow[] }>('/admin/settings', { params: { category: 'pages', limit: 'all' }, cache: 'no-store' }).then((result) => {
        if (!active) return;
        const ar = result.data.find((row) => row.key === `${slug}_ar`);
        const en = result.data.find((row) => row.key === `${slug}_en`);
        if (!ar || !en) throw new Error(`The ${slug} page settings have not been initialized.`);
        setSettings([ar, en]);
        const a = ar.value ?? {};
        const e = en.value ?? {};
        setDraft({ titleAr: a.title ?? TITLES[slug][0], titleEn: e.title ?? TITLES[slug][1], bodyAr: a.body ?? '', bodyEn: e.body ?? '', sideTextAr: '', sideTextEn: '' });
      }).catch((error: unknown) => { if (active) setLoadErr(error instanceof Error ? error.message : String(error)); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [slug]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || loadErr) return;
    setBusy(true);
    try {
      if (slug === 'about') {
        if (!page) throw new Error('The About page is not loaded.');
        // multipart: the picture travels with the texts
        const fd = new FormData();
        fd.set('titleAr', draft.titleAr.trim());
        fd.set('titleEn', draft.titleEn.trim());
        fd.set('bodyAr', draft.bodyAr);
        fd.set('bodyEn', draft.bodyEn);
        fd.set('sideTextAr', draft.sideTextAr);
        fd.set('sideTextEn', draft.sideTextEn);
        fd.set('isActive', String(!!(draft.bodyAr.trim() || draft.bodyEn.trim())));
        if (photo) fd.set('photo', photo);
        else if (dropPhoto) fd.set('removePhoto', 'true');
        const saved = await api<PageRow>(`/admin/pages/${page.id}`, { method: 'PATCH', form: fd });
        setPage(saved);
        setPhoto(null);
        setDropPhoto(false);
      } else {
        if (settings.length !== 2) throw new Error(`The ${slug} page settings are not loaded.`);
        const byKey = new Map(settings.map((row) => [row.key, row]));
        const ar = byKey.get(`${slug}_ar`);
        const en = byKey.get(`${slug}_en`);
        if (!ar || !en) throw new Error(`The ${slug} page settings are incomplete.`);
        await api(`/admin/settings/${ar.id}`, { method: 'PATCH', body: { value: { title: draft.titleAr.trim(), body: draft.bodyAr } } });
        await api(`/admin/settings/${en.id}`, { method: 'PATCH', body: { value: { title: draft.titleEn.trim(), body: draft.bodyEn } } });
      }
      toast(t('app.saved'));
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : String(error), 'err');
    } finally {
      setBusy(false);
    }
  };

  const ar = lang === 'ar';
  return (
    <RequirePerm any={['pages.read']}>
      <h1 className="mb-4 text-2xl font-bold">{ar ? TITLES[slug][0] : TITLES[slug][1]}</h1>
      {loadErr ? <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadErr}</p> : loading ? (
        <p role="status" className="rounded-2xl bg-white p-4 text-sm text-gray-500 shadow-card ring-1 ring-line">{t('app.loading')}</p>
      ) : (
        <form onSubmit={save} className="space-y-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line md:p-6">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label={t('pg.titleAr')}><input maxLength={255} required dir="rtl" className={inputCls} value={draft.titleAr} onChange={(e) => setDraft({ ...draft, titleAr: e.target.value })} disabled={busy} /></Field>
            <Field label={t('pg.titleEn')}><input maxLength={255} dir="ltr" className={inputCls} value={draft.titleEn} onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })} disabled={busy} /></Field>
          </div>
          <Field plain={slug === 'about'} label={t('pg.bodyAr')}>{slug === 'about'
            ? <RichEditor value={draft.bodyAr} onChange={(bodyAr) => setDraft((current) => ({ ...current, bodyAr }))} dir="rtl" />
            : <textarea rows={12} maxLength={20000} dir="rtl" className={`${inputCls} h-64 overflow-y-auto`} value={draft.bodyAr} onChange={(e) => setDraft({ ...draft, bodyAr: e.target.value })} disabled={busy} />}</Field>
          <Field plain={slug === 'about'} label={t('pg.bodyEn')}>{slug === 'about'
            ? <RichEditor value={draft.bodyEn} onChange={(bodyEn) => setDraft((current) => ({ ...current, bodyEn }))} dir="ltr" />
            : <textarea rows={12} maxLength={20000} dir="ltr" className={`${inputCls} h-64 overflow-y-auto`} value={draft.bodyEn} onChange={(e) => setDraft({ ...draft, bodyEn: e.target.value })} disabled={busy} />}</Field>
          {slug === 'about' && (
            <fieldset className="space-y-3 rounded-2xl border border-line p-4">
              <legend className="px-2 text-sm font-bold text-secondary">{t('pg.sideTitle')}</legend>
              <Field label={t('pg.sidePhoto')} hint={t('pg.sidePhotoHint')}>
                <input type="file" accept="image/jpeg,image/png,image/webp" className={inputCls} disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPhoto(f); setDropPhoto(false); } e.target.value = ''; }} />
              </Field>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {photo && <><span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">{photo.name}</span><button type="button" className="text-red-600 underline" onClick={() => setPhoto(null)}>{t('pg.sideRemove')}</button></>}
                {!photo && page?.photoUrl && !dropPhoto && (
                  <>
                    <img src={fileUrl(page.photoUrl)} alt="" className="h-20 w-32 rounded-lg object-cover" />
                    <button type="button" className="text-red-600 underline" onClick={() => setDropPhoto(true)}>{t('pg.sideRemove')}</button>
                  </>
                )}
                {dropPhoto && <span className="text-gray-500">{t('pg.sideRemoved')}</span>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label={t('pg.sideTextAr')}><textarea rows={5} maxLength={5000} dir="rtl" className={inputCls} value={draft.sideTextAr} onChange={(e) => setDraft({ ...draft, sideTextAr: e.target.value })} disabled={busy} /></Field>
                <Field label={t('pg.sideTextEn')}><textarea rows={5} maxLength={5000} dir="ltr" className={inputCls} value={draft.sideTextEn} onChange={(e) => setDraft({ ...draft, sideTextEn: e.target.value })} disabled={busy} /></Field>
              </div>
            </fieldset>
          )}
          {can('pages.update') && <div className="flex justify-end"><Button disabled={busy}>{t('app.save')}</Button></div>}
        </form>
      )}
    </RequirePerm>
  );
}
