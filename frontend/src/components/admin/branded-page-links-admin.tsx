'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { isValidBrandedLink, readBrandedPageLinks, type BrandedPageLink, type BrandedPageLinks } from '@/lib/branded-page-links';

interface SettingRow { id: number; key: string; value: BrandedPageLinks | null }
interface LinkDraft extends BrandedPageLink { uid: number }
interface Draft { navigation: LinkDraft[]; footer: LinkDraft[] }

let nextUid = 1;
const withIds = (links: BrandedPageLinks): Draft => ({
  navigation: links.navigation.map((link) => ({ ...link, uid: nextUid++ })),
  footer: links.footer.map((link) => ({ ...link, uid: nextUid++ })),
});

export function BrandedPageLinksAdmin({ page }: { page: 'expo' | 'women' }) {
  const { can } = useAuth();
  const { lang } = useI18n();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [settingId, setSettingId] = useState<number | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ar = lang === 'ar';
  const editable = can('settings.update');

  useEffect(() => {
    let active = true;
    setDraft(null);
    setSettingId(null);
    setLoadErr('');
    api<{ data: SettingRow[] }>('/admin/settings', { params: { category: page, limit: 'all' }, cache: 'no-store' })
      .then(({ data }) => {
        const row = data.find((item) => item.key === 'page_links');
        if (!row) throw new Error(`Missing ${page}.page_links setting; run the site settings migration.`);
        if (!active) return;
        setSettingId(row.id);
        setDraft(withIds(readBrandedPageLinks(row.value, page)));
      })
      .catch((error: unknown) => {
        if (active) setLoadErr(error instanceof Error ? error.message : String(error));
      });
    return () => { active = false; };
  }, [page]);

  const updateLink = (section: keyof Draft, uid: number, patch: Partial<BrandedPageLink>) => {
    setDraft((current) => current && ({
      ...current,
      [section]: current[section].map((link) => link.uid === uid ? { ...link, ...patch } : link),
    }));
  };
  const addLink = (section: keyof Draft) => {
    setDraft((current) => current && ({
      ...current,
      [section]: [...current[section], { uid: ++nextUid, labelAr: '', labelEn: '', href: '/' }],
    }));
  };
  const removeLink = (section: keyof Draft, uid: number) => {
    setDraft((current) => current && ({ ...current, [section]: current[section].filter((link) => link.uid !== uid) }));
  };
  const moveLink = (section: keyof Draft, uid: number, offset: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current;
      const links = [...current[section]];
      const index = links.findIndex((link) => link.uid === uid);
      const next = index + offset;
      if (index < 0 || next < 0 || next >= links.length) return current;
      [links[index], links[next]] = [links[next], links[index]];
      return { ...current, [section]: links };
    });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || settingId === null || !editable || busy) return;
    const links: BrandedPageLinks = {
      navigation: draft.navigation.map(({ uid: _uid, ...link }) => link),
      footer: draft.footer.map(({ uid: _uid, ...link }) => link),
    };
    if ([...links.navigation, ...links.footer].some((link) => !isValidBrandedLink(link))) {
      toast(ar ? 'أدخل اسماً بالعربية أو الإنجليزية ورابطاً داخلياً يبدأ بـ / لكل رابط.' : 'Each link needs a label and an internal path starting with /.', 'err');
      return;
    }
    setBusy(true);
    try {
      await api(`/admin/settings/${settingId}`, { method: 'PATCH', body: { value: links } });
      toast(ar ? 'تم حفظ روابط الصفحة' : 'Page links saved');
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : String(error), 'err');
    } finally {
      setBusy(false);
    }
  };

  const section = (key: keyof Draft, title: string) => (
    <section className="space-y-3 rounded-xl border border-line p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-secondary">{title}</h2>
        {editable && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => addLink(key)}>{ar ? 'إضافة رابط' : 'Add link'}</Button>}
      </header>
      {draft?.[key].map((link, index) => (
        <div key={link.uid} className="grid gap-3 rounded-lg bg-gray-50 p-3 md:grid-cols-[1fr_1fr_minmax(10rem,1.2fr)_auto]">
          <Field label={ar ? 'الاسم بالعربية' : 'Arabic label'}>
            <input maxLength={150} dir="rtl" className={inputCls} value={link.labelAr} disabled={!editable || busy} onChange={(event) => updateLink(key, link.uid, { labelAr: event.target.value })} />
          </Field>
          <Field label={ar ? 'الاسم بالإنجليزية' : 'English label'}>
            <input maxLength={150} dir="ltr" className={inputCls} value={link.labelEn} disabled={!editable || busy} onChange={(event) => updateLink(key, link.uid, { labelEn: event.target.value })} />
          </Field>
          <Field label={ar ? 'الرابط الداخلي' : 'Internal path'}>
            <input maxLength={500} dir="ltr" className={inputCls} value={link.href} disabled={!editable || busy} placeholder="/page or /page#section" onChange={(event) => updateLink(key, link.uid, { href: event.target.value })} />
          </Field>
          {editable && (
            <div className="flex items-end gap-1">
              <Button type="button" size="sm" variant="outline" disabled={busy || index === 0} aria-label={ar ? 'تحريك لأعلى' : 'Move up'} onClick={() => moveLink(key, link.uid, -1)}>↑</Button>
              <Button type="button" size="sm" variant="outline" disabled={busy || index === draft[key].length - 1} aria-label={ar ? 'تحريك لأسفل' : 'Move down'} onClick={() => moveLink(key, link.uid, 1)}>↓</Button>
              <Button type="button" size="sm" variant="danger" disabled={busy} aria-label={ar ? 'حذف الرابط' : 'Remove link'} onClick={() => removeLink(key, link.uid)}>×</Button>
            </div>
          )}
        </div>
      ))}
      {!draft?.[key].length && <p className="text-sm text-gray-500">{ar ? 'لا توجد روابط' : 'No links configured.'}</p>}
    </section>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{ar ? 'القائمة والتذييل' : 'Navigation & footer links'}</h1>
      {loadErr ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadErr}</p> : !draft ? (
        <p role="status" className="py-8 text-center text-sm text-gray-500">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>
      ) : (
        <form onSubmit={save} className="space-y-4">
          {section('navigation', ar ? 'روابط القائمة العلوية' : 'Header navigation')}
          {section('footer', ar ? 'روابط التذييل' : 'Footer links')}
          {editable && <div className="flex justify-end"><Button disabled={busy}>{ar ? 'حفظ الروابط' : 'Save links'}</Button></div>}
          {!editable && <p className="text-sm text-gray-500">{ar ? 'تحتاج إلى صلاحية تعديل الإعدادات لتغيير هذه الروابط.' : 'Settings update permission is required to edit these links.'}</p>}
        </form>
      )}
    </div>
  );
}
