'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { readWomenMenu, type WomenMenu, type WomenMenuEntry, type WomenMenuPage } from '@/lib/women-menu';

interface Row { id: number; key: string; value: unknown }
type Part = 'navigation' | 'footer';
type DragPage = { part: Part; slug: string };

const withSlug = (page: WomenMenuPage): WomenMenuPage => ({ ...page, slug: page.slug || `page-${Date.now()}` });
const clonePage = (page: WomenMenuPage) => ({ ...page });

export function WomenMenuAdmin() {
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const ar = lang === 'ar';
  const editable = can('settings.update');
  const [menu, setMenu] = useState<WomenMenu | null>(null);
  const [settingId, setSettingId] = useState<number | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<DragPage | null>(null);
  const [dropTarget, setDropTarget] = useState<{ part: Part; group?: string } | null>(null);

  useEffect(() => {
    let active = true;
    api<{ data: Row[] }>('/admin/settings', { params: { category: 'women', limit: 'all' }, cache: 'no-store' })
      .then(({ data }) => {
        const row = data.find((item) => item.key === 'page_links');
        if (!row) throw new Error('Missing women.page_links setting; apply the site settings migration.');
        if (!active) return;
        setSettingId(row.id);
        const loaded = readWomenMenu(row.value);
        setMenu({ navigation: addInitialIds(loaded.navigation), footer: addInitialIds(loaded.footer) });
      })
      .catch((error: unknown) => { if (active) setLoadErr(error instanceof Error ? error.message : String(error)); });
    return () => { active = false; };
  }, []);

  const setPart = (part: Part, entries: WomenMenuEntry[]) => setMenu((current) => current && ({ ...current, [part]: entries }));

  const addGroup = (part: Part) => {
    if (!menu) return;
    setPart(part, [...menu[part], { type: 'dropdown', titleAr: '', titleEn: '', isActive: true, items: [] }]);
  };

  const addPage = (part: Part, parent?: number) => {
    if (!menu) return;
    const allPages: WomenMenuPage[] = [];
    menu[part].forEach((entry) => {
      if (entry.type === 'page') allPages.push(entry);
      else allPages.push(...entry.items);
    });
    let number = allPages.length + 1;
    while (allPages.some((item) => item.slug === `page-${number}`)) number++;
    const page: WomenMenuPage = { type: 'page', slug: `page-${number}`, labelAr: '', labelEn: '', isActive: true, newTab: false, bodyAr: '', bodyEn: '' };
    if (parent === undefined) return setPart(part, [...menu[part], page]);
    setPart(part, menu[part].map((entry, index) => entry.type === 'dropdown' && index === parent
      ? { ...entry, items: [...entry.items, page] }
      : entry));
  };

  const changeGroup = (part: Part, index: number, patch: Partial<WomenMenuEntry>) => {
    if (!menu) return;
    setPart(part, menu[part].map((entry, i) => i === index && entry.type === 'dropdown' ? { ...entry, ...patch } as WomenMenuEntry : entry));
  };

  const changePage = (part: Part, slug: string, patch: Partial<WomenMenuPage>) => {
    if (!menu) return;
    setPart(part, menu[part].map((entry) => entry.type === 'page'
      ? entry.slug === slug ? { ...entry, ...patch } : entry
      : { ...entry, items: entry.items.map((page) => page.slug === slug ? { ...page, ...patch } : page) }));
  };

  const removePage = (part: Part, slug: string) => {
    if (!menu) return;
    const entries: WomenMenuEntry[] = [];
    menu[part].forEach((entry) => {
      if (entry.type === 'page') {
        if (entry.slug !== slug) entries.push(entry);
      } else {
        entries.push({ ...entry, items: entry.items.filter((page) => page.slug !== slug) });
      }
    });
    setPart(part, entries);
  };

  const removeGroup = (part: Part, index: number) => {
    if (!menu) return;
    const entries = [...menu[part]];
    const [removed] = entries.splice(index, 1);
    setPart(part, removed.type === 'dropdown' ? [...entries, ...removed.items] : entries);
  };

  const movePage = (part: Part, slug: string, targetGroup?: number, beforeSlug?: string) => {
    if (!menu) return;
    let moved: WomenMenuPage | undefined;
    let sourceRootIndex = -1;
    let sourceWasTopLevel = false;
    const without: WomenMenuEntry[] = [];
    menu[part].forEach((entry, index) => {
      if (entry.type === 'page') {
        if (entry.slug !== slug) {
          without.push(entry);
          return;
        }
        sourceRootIndex = index;
        sourceWasTopLevel = true;
        moved = entry;
        return;
      }
      const items: WomenMenuPage[] = [];
      entry.items.forEach((item) => {
        if (item.slug === slug) {
          sourceRootIndex = index;
          moved = item;
        } else items.push(item);
      });
      without.push({ ...entry, items });
    });
    if (!moved) return;
    if (!targetGroup) {
      const at = beforeSlug ? without.findIndex((entry) => entry.type === 'page' && entry.slug === beforeSlug) : -1;
      without.splice(at < 0 ? without.length : at, 0, moved);
    } else {
      const adjustedTarget = sourceWasTopLevel && sourceRootIndex < targetGroup ? targetGroup - 1 : targetGroup;
      const target = without[adjustedTarget];
      if (!target || target.type !== 'dropdown') return;
      const at = beforeSlug ? target.items.findIndex((item) => item.slug === beforeSlug) : -1;
      const items = [...target.items];
      items.splice(at < 0 ? items.length : at, 0, moved);
      target.items = items;
    }
    setPart(part, without);
  };

  const handleDrop = (event: React.DragEvent, part: Part, targetGroup?: number, beforeSlug?: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (!drag || drag.part !== part) return;
    movePage(part, drag.slug, targetGroup, beforeSlug);
    setDrag(null);
    setDropTarget(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!menu || settingId === null || !editable || busy) return;
    const normalized: WomenMenu = {
      navigation: menu.navigation.map(stripIds),
      footer: menu.footer.map(stripIds),
    };
    const pages = [...normalized.navigation, ...normalized.footer].flatMap((entry) => entry.type === 'page' ? [entry] : entry.items);
    if (pages.some((page) => !page.slug.trim() || !/^[a-z0-9-]{1,60}$/.test(page.slug) || !page.labelAr.trim() || !page.labelEn.trim())) {
      toast(ar ? 'أدخل اسماً بالعربية والإنجليزية لكل صفحة، ورابطاً مختصراً صالحاً.' : 'Every page needs Arabic and English names and a valid page slug.', 'err');
      return;
    }
    for (const part of ['navigation', 'footer'] as const) {
      const slugs = menu[part].flatMap((entry) => entry.type === 'page' ? [entry.slug] : entry.items.map((page) => page.slug));
      if (new Set(slugs).size !== slugs.length) {
        toast(ar ? 'لا يمكن تكرار الصفحة في القائمة نفسها.' : 'A page cannot appear more than once in the same list.', 'err');
        return;
      }
    }
    setBusy(true);
    try {
      await api(`/admin/settings/${settingId}`, { method: 'PATCH', body: { value: normalized } });
      toast(ar ? 'تم حفظ قائمة سيدات الأعمال' : "Women's page navigation saved");
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : String(error), 'err');
    } finally { setBusy(false); }
  };

  const renderPage = (part: Part, page: WomenMenuPage, parent?: number) => (
    <article key={page.slug} draggable={editable && !busy}
      onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', page.slug); setDrag({ part, slug: page.slug }); }}
      onDragEnd={() => { setDrag(null); setDropTarget(null); }}
      onDragOver={(event) => { if (drag?.part === part) event.preventDefault(); }}
      onDrop={(event) => handleDrop(event, part, parent, page.slug)}
      className="space-y-3 rounded-xl border border-line bg-gray-50 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={ar ? 'اسم الصفحة بالعربية' : 'Page name (Arabic)'}>
          <input maxLength={150} dir="rtl" className={inputCls} value={page.labelAr} disabled={!editable || busy} onChange={(event) => changePage(part, page.slug, { labelAr: event.target.value })} />
        </Field>
        <Field label={ar ? 'اسم الصفحة بالإنجليزية' : 'Page name (English)'}>
          <input maxLength={150} dir="ltr" className={inputCls} value={page.labelEn} disabled={!editable || busy} onChange={(event) => changePage(part, page.slug, { labelEn: event.target.value })} />
        </Field>
        <Field label={ar ? 'الرابط المختصر' : 'Page slug'}>
          <input maxLength={60} pattern="[a-z0-9-]+" dir="ltr" className={inputCls} value={page.slug} disabled={!editable || busy} onChange={(event) => changePage(part, page.slug, { slug: event.target.value })} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={page.isActive} disabled={!editable || busy} onChange={(event) => changePage(part, page.slug, { isActive: event.target.checked })} />{ar ? 'ظاهر في القائمة' : 'Visible in menu'}</label>
      </div>
      {(page.bodyAr !== undefined || page.bodyEn !== undefined) && <>
        <Field label={ar ? 'محتوى الصفحة بالعربية' : 'Page content (Arabic)'}>
          <textarea rows={4} maxLength={20000} dir="rtl" className={inputCls} value={page.bodyAr ?? ''} disabled={!editable || busy} onChange={(event) => changePage(part, page.slug, { bodyAr: event.target.value })} />
        </Field>
        <Field label={ar ? 'محتوى الصفحة بالإنجليزية' : 'Page content (English)'}>
          <textarea rows={4} maxLength={20000} dir="ltr" className={inputCls} value={page.bodyEn ?? ''} disabled={!editable || busy} onChange={(event) => changePage(part, page.slug, { bodyEn: event.target.value })} />
        </Field>
      </>}
      {editable && <div className="flex justify-end"><Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => removePage(part, page.slug)}>{ar ? 'حذف الصفحة' : 'Remove page'}</Button></div>}
    </article>
  );

  const renderPart = (part: Part, title: string) => (
    <section key={part} className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-secondary">{title}</h2>
        {editable && <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => addGroup(part)}>{ar ? '＋ قائمة منسدلة' : '＋ Add dropdown'}</Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => addPage(part)}>{ar ? '＋ صفحة مستقلة' : '＋ Add single page'}</Button>
        </div>}
      </header>
      <div className={`space-y-3 rounded-xl border-2 border-dashed p-3 ${dropTarget?.part === part && !dropTarget.group ? 'border-primary bg-primary/5' : 'border-transparent'}`}
        onDragOver={(event) => { if (drag?.part === part) { event.preventDefault(); setDropTarget({ part }); } }}
        onDrop={(event) => handleDrop(event, part)}>
        {menu?.[part].map((entry, index) => entry.type === 'page' ? renderPage(part, entry) : (
          <section key={`${part}-${index}-${entry.titleAr}`} className="space-y-3 rounded-xl border border-primary/25 p-3"
            onDragOver={(event) => { if (drag?.part === part) { event.preventDefault(); event.stopPropagation(); setDropTarget({ part, group: String(index) }); } }}
            onDrop={(event) => handleDrop(event, part, index)}>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={ar ? 'اسم القائمة المنسدلة بالعربية' : 'Dropdown name (Arabic)'}>
                <input maxLength={150} dir="rtl" className={inputCls} value={entry.titleAr} disabled={!editable || busy} onChange={(event) => changeGroup(part, index, { titleAr: event.target.value })} />
              </Field>
              <Field label={ar ? 'اسم القائمة المنسدلة بالإنجليزية' : 'Dropdown name (English)'}>
                <input maxLength={150} dir="ltr" className={inputCls} value={entry.titleEn} disabled={!editable || busy} onChange={(event) => changeGroup(part, index, { titleEn: event.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={entry.isActive} disabled={!editable || busy} onChange={(event) => changeGroup(part, index, { isActive: event.target.checked })} />{ar ? 'القائمة ظاهرة' : 'Dropdown visible'}</label>
            <div className={`space-y-2 rounded-lg border-2 border-dashed p-2 ${dropTarget?.part === part && dropTarget.group === String(index) ? 'border-primary bg-primary/5' : 'border-transparent'}`}
              onDragOver={(event) => { if (drag?.part === part) { event.preventDefault(); event.stopPropagation(); setDropTarget({ part, group: String(index) }); } }}
              onDrop={(event) => handleDrop(event, part, index)}>
              {entry.items.map((page) => renderPage(part, page, index))}
            </div>
            {editable && <div className="flex justify-between">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => addPage(part, index)}>{ar ? '＋ صفحة داخل القائمة' : '＋ Add page to dropdown'}</Button>
              <Button type="button" size="sm" variant="danger" disabled={busy} onClick={() => removeGroup(part, index)}>{ar ? 'حذف القائمة' : 'Remove dropdown'}</Button>
            </div>}
          </section>
        ))}
        {!menu?.[part].length && <p className="py-2 text-sm text-gray-500">{ar ? 'أضف صفحة أو قائمة منسدلة، أو اسحب صفحة إلى هنا.' : 'Add a page or dropdown, or drag a page here.'}</p>}
      </div>
    </section>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ar ? 'قائمة سيدات الأعمال وتذييلها' : "Women's navigation & footer"}</h1>
        <p className="mt-1 text-sm text-gray-500">{ar ? 'أضف صفحات مستقلة أو قوائم منسدلة، واسحب الصفحات بين القوائم. هذه الوجهات خاصة بصفحة سيدات الأعمال فقط.' : "Create standalone pages or dropdowns and drag pages between them. These destinations belong only to the Women's Business page."}</p>
      </div>
      {loadErr ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadErr}</p> : !menu ? (
        <p role="status" className="py-8 text-center text-sm text-gray-500">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>
      ) : (
        <form onSubmit={save} className="space-y-4">
          {renderPart('navigation', ar ? 'القائمة العلوية' : 'Header navigation')}
          {renderPart('footer', ar ? 'التذييل' : 'Footer')}
          {editable && <div className="flex justify-end"><Button disabled={busy}>{ar ? 'حفظ القائمة والتذييل' : 'Save navigation & footer'}</Button></div>}
          {!editable && <p className="text-sm text-gray-500">{ar ? 'تحتاج إلى صلاحية تعديل الإعدادات لتغيير هذه القائمة.' : 'Settings update permission is required to edit this menu.'}</p>}
        </form>
      )}
    </div>
  );
}

function stripIds(entry: WomenMenuEntry): WomenMenuEntry {
  if (entry.type === 'page') return withSlug(entry);
  return { ...entry, items: entry.items.map(clonePage) };
}

function addInitialIds(entries: WomenMenuEntry[]): WomenMenuEntry[] {
  return entries.map((entry) => entry.type === 'page'
    ? withSlug(entry)
    : { ...entry, items: entry.items.map(withSlug) });
}
