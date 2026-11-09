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

const clonePage = (page: WomenMenuPage) => ({ ...page });

function VisibilitySwitch({ checked, label, disabled, onChange }: { checked: boolean; label: string; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-gray-300'} disabled:opacity-50`}>
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'start-[1.125rem]' : 'start-0.5'}`} />
    </button>
  );
}

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

  const removeGroup = (part: Part, index: number) => {
    if (!menu) return;
    const entries = [...menu[part]];
    if (entries[index]?.type !== 'dropdown' || entries[index].items.length > 0) return;
    entries.splice(index, 1);
    setPart(part, entries);
  };

  const reorderGroup = (part: Part, index: number, offset: -1 | 1) => {
    if (!menu) return;
    const entries = [...menu[part]];
    const target = index + offset;
    if (target < 0 || target >= entries.length) return;
    [entries[index], entries[target]] = [entries[target], entries[index]];
    setPart(part, entries);
  };

  const movePage = (part: Part, slug: string, targetGroup?: number, beforeSlug?: string) => {
    if (!menu) return;
    if (slug === beforeSlug) return;
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
    if (targetGroup === undefined) {
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
    for (const part of ['navigation', 'footer'] as const) {
      if (menu[part].some((entry) => entry.type === 'dropdown' && (!entry.titleAr.trim() || !entry.titleEn.trim()))) {
        toast(ar ? 'أدخل اسم كل قائمة منسدلة بالعربية والإنجليزية.' : 'Every dropdown needs Arabic and English names.', 'err');
        return;
      }
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
    <article key={page.slug}
      onDragOver={(event) => { if (drag?.part === part) event.preventDefault(); }}
      onDrop={(event) => handleDrop(event, part, parent, page.slug)}
      className={`flex items-center gap-3 rounded-xl border bg-white p-2 transition ${page.isActive ? 'border-line' : 'border-line bg-gray-50 opacity-70'} ${dropTarget?.part === part && dropTarget.group === String(parent ?? '') ? 'border-primary' : ''}`}>
      {editable && <span draggable={!busy}
        onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', page.slug); setDrag({ part, slug: page.slug }); }}
        onDragEnd={() => { setDrag(null); setDropTarget(null); }}
        className="flex h-8 w-6 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-lg text-gray-400 hover:bg-primary/10 hover:text-primary active:cursor-grabbing"
        title={ar ? 'اسحب لترتيب الصفحة' : 'Drag to move this page'} aria-hidden="true">⠿</span>}
      {part === 'footer' ? <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
        <Field label={ar ? 'اسم رابط التذييل بالعربية' : 'Footer link name (Arabic)'}>
          <input maxLength={150} dir="rtl" className={`${inputCls} py-1.5 text-sm`} value={page.labelAr} disabled={!editable || busy} onChange={(event) => changePage(part, page.slug, { labelAr: event.target.value })} />
        </Field>
        <Field label={ar ? 'اسم رابط التذييل بالإنجليزية' : 'Footer link name (English)'}>
          <input maxLength={150} dir="ltr" className={`${inputCls} py-1.5 text-sm`} value={page.labelEn} disabled={!editable || busy} onChange={(event) => changePage(part, page.slug, { labelEn: event.target.value })} />
        </Field>
      </div> : <span className="min-w-0 flex-1 text-sm font-medium text-secondary">{ar ? page.labelAr : page.labelEn}</span>}
      {editable && <select aria-label={ar ? 'نقل الصفحة إلى قائمة' : 'Move page to dropdown'} className={`${inputCls} w-auto max-w-48 py-1.5 text-xs`} value={parent === undefined ? 'single' : String(parent)} disabled={busy}
        onChange={(event) => movePage(part, page.slug, event.target.value === 'single' ? undefined : Number(event.target.value))}>
        <option value="single">{ar ? 'رابط مستقل' : 'Standalone link'}</option>
        {menu?.[part].map((entry, index) => entry.type === 'dropdown' && <option key={`group-option-${index}`} value={index}>{ar ? entry.titleAr || 'قائمة منسدلة' : entry.titleEn || 'Dropdown'}</option>)}
      </select>}
      <div className="flex shrink-0 items-center gap-2 text-xs text-gray-600">
        <VisibilitySwitch checked={page.isActive} label={ar ? 'إظهار الصفحة' : 'Show page'} disabled={!editable || busy} onChange={(value) => changePage(part, page.slug, { isActive: value })} />
        {ar ? 'ظاهر' : 'Active'}
      </div>
    </article>
  );

  const renderPart = (part: Part, title: string) => (
    <section key={part} className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-secondary">{title}</h2>
        {editable && <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => addGroup(part)}>{ar ? '＋ قائمة منسدلة' : '＋ Add dropdown'}</Button>
        </div>}
      </header>
      <div className={`grid items-start gap-5 xl:grid-cols-2 ${dropTarget?.part === part && dropTarget.group === undefined ? 'rounded-xl bg-primary/5' : ''}`}
        onDragOver={(event) => { if (drag?.part === part) { event.preventDefault(); setDropTarget({ part }); } }}
        onDrop={(event) => handleDrop(event, part)}>
        {menu?.[part].some((entry) => entry.type === 'page') && <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
          <header className="border-b border-line bg-gradient-to-l from-primary/5 to-transparent px-3 py-2 text-sm font-bold text-secondary">{ar ? 'روابط مستقلة' : 'Standalone links'}</header>
          <div className="space-y-2 p-3" onDragOver={(event) => { if (drag?.part === part) { event.preventDefault(); event.stopPropagation(); setDropTarget({ part }); } }} onDrop={(event) => handleDrop(event, part)}>
            {menu[part].filter((entry): entry is WomenMenuPage => entry.type === 'page').map((page) => renderPage(part, page))}
          </div>
        </section>}
        {menu?.[part].map((entry, index) => entry.type === 'dropdown' && (
          <section key={`${part}-${index}-${entry.titleAr}`} className={`overflow-hidden rounded-2xl bg-white shadow-card ring-1 transition ${dropTarget?.part === part && dropTarget.group === String(index) ? 'ring-2 ring-primary' : 'ring-line'} ${entry.isActive ? '' : 'opacity-75'}`}
            onDragOver={(event) => { if (drag?.part === part) { event.preventDefault(); event.stopPropagation(); setDropTarget({ part, group: String(index) }); } }}
            onDrop={(event) => handleDrop(event, part, index)}>
            <header className="flex items-start gap-2 border-b border-line bg-gradient-to-l from-primary/5 to-transparent p-3">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <Field label={ar ? 'اسم القائمة بالعربية' : 'Dropdown name (Arabic)'}>
                  <input maxLength={150} dir="rtl" className={`${inputCls} font-bold`} value={entry.titleAr} disabled={!editable || busy} onChange={(event) => changeGroup(part, index, { titleAr: event.target.value })} />
                </Field>
                <Field label={ar ? 'اسم القائمة بالإنجليزية' : 'Dropdown name (English)'}>
                  <input maxLength={150} dir="ltr" className={`${inputCls} font-bold`} value={entry.titleEn} disabled={!editable || busy} onChange={(event) => changeGroup(part, index, { titleEn: event.target.value })} />
                </Field>
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
                <VisibilitySwitch checked={entry.isActive} label={ar ? 'إظهار القائمة' : 'Show dropdown'} disabled={!editable || busy} onChange={(value) => changeGroup(part, index, { isActive: value })} />
                <span className="text-[10px] text-gray-500">{ar ? 'ظاهر' : 'Active'}</span>
              </div>
              {editable && <div className="flex shrink-0 items-center">
                <Button type="button" size="sm" variant="outline" disabled={busy || index === 0} aria-label={ar ? 'تحريك لأعلى' : 'Move up'} onClick={() => reorderGroup(part, index, -1)}>↑</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy || index === menu[part].length - 1} aria-label={ar ? 'تحريك لأسفل' : 'Move down'} onClick={() => reorderGroup(part, index, 1)}>↓</Button>
                <Button type="button" size="sm" variant="danger" disabled={busy || entry.items.length > 0} aria-label={ar ? 'حذف القائمة' : 'Delete dropdown'} onClick={() => removeGroup(part, index)}>✕</Button>
              </div>}
            </header>
            <div className={`space-y-2 p-3 ${dropTarget?.part === part && dropTarget.group === String(index) ? 'bg-primary/5' : ''}`}
              onDragOver={(event) => { if (drag?.part === part) { event.preventDefault(); event.stopPropagation(); setDropTarget({ part, group: String(index) }); } }}
              onDrop={(event) => handleDrop(event, part, index)}>
              {entry.items.map((page) => renderPage(part, page, index))}
              {!entry.items.length && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-gray-500">{ar ? 'اسحب صفحة موجودة هنا أو اختر القائمة من خيار نقل الصفحة.' : 'Drag an existing page here or choose this dropdown in the page move menu.'}</p>}
            </div>
          </section>
        ))}
      </div>
    </section>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ar ? 'قائمة سيدات الأعمال وتذييلها' : "Women's navigation & footer"}</h1>
        <p className="mt-1 text-sm text-gray-500">{ar ? 'رتّب صفحات سيدات الأعمال الموجودة في روابط مستقلة أو قوائم منسدلة، واسحبها بين القوائم أو استخدم خيار النقل. لا يمكن إنشاء صفحات جديدة؛ يمكنك إظهارها أو إخفاؤها.' : "Arrange existing Women's pages as standalone links or in dropdowns. Drag pages between groups or use the move selector. Pages cannot be added or deleted; you can show or hide them."}</p>
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
  if (entry.type === 'page') return clonePage(entry);
  return { ...entry, items: entry.items.map(clonePage) };
}

function addInitialIds(entries: WomenMenuEntry[]): WomenMenuEntry[] {
  return entries.map((entry) => entry.type === 'page'
    ? clonePage(entry)
    : { ...entry, items: entry.items.map(clonePage) });
}
