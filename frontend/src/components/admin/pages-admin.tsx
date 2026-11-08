'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { RequirePerm } from '@/components/admin/guard';
import { RichEditor } from '@/components/admin/rich-editor';

type StaticSlug = 'about' | 'privacy' | 'terms';
interface PageRow { id: number; slug: string; titleAr: string; titleEn: string; bodyAr: string; bodyEn: string }
interface SettingRow { id: number; key: string; value: { title?: string; body?: string } | null }
interface Draft { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string }

const EMPTY: Draft = { titleAr: '', titleEn: '', bodyAr: '', bodyEn: '' };
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

  useEffect(() => {
    let active = true;
    setLoadErr('');
    setLoading(true);
    setDraft(EMPTY);
    if (slug === 'about') {
      api<{ data: PageRow[] }>('/admin/pages', { params: { limit: 'all' }, cache: 'no-store' }).then((result) => {
        if (!active) return;
        const found = result.data.find((row) => row.slug === slug);
        if (!found) throw new Error('The About page has not been initialized.');
        setPage(found);
        setDraft({ titleAr: found.titleAr, titleEn: found.titleEn, bodyAr: found.bodyAr, bodyEn: found.bodyEn });
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
        setDraft({ titleAr: a.title ?? TITLES[slug][0], titleEn: e.title ?? TITLES[slug][1], bodyAr: a.body ?? '', bodyEn: e.body ?? '' });
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
        await api(`/admin/pages/${page.id}`, {
          method: 'PATCH',
          body: {
            titleAr: draft.titleAr.trim(),
            titleEn: draft.titleEn.trim(),
            bodyAr: draft.bodyAr,
            bodyEn: draft.bodyEn,
            isActive: !!(draft.bodyAr.trim() || draft.bodyEn.trim()),
          },
        });
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
          <Field label={t('pg.bodyAr')}>{slug === 'about'
            ? <RichEditor value={draft.bodyAr} onChange={(bodyAr) => setDraft((current) => ({ ...current, bodyAr }))} dir="rtl" />
            : <textarea rows={12} maxLength={20000} dir="rtl" className={inputCls} value={draft.bodyAr} onChange={(e) => setDraft({ ...draft, bodyAr: e.target.value })} disabled={busy} />}</Field>
          <Field label={t('pg.bodyEn')}>{slug === 'about'
            ? <RichEditor value={draft.bodyEn} onChange={(bodyEn) => setDraft((current) => ({ ...current, bodyEn }))} dir="ltr" />
            : <textarea rows={12} maxLength={20000} dir="ltr" className={inputCls} value={draft.bodyEn} onChange={(e) => setDraft({ ...draft, bodyEn: e.target.value })} disabled={busy} />}</Field>
          {can('pages.update') && <div className="flex justify-end"><Button disabled={busy}>{t('app.save')}</Button></div>}
        </form>
      )}
    </RequirePerm>
  );
}
