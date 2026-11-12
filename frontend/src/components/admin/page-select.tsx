'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { inputCls } from '@/components/ui/ui';

interface Opt { url: string; titleAr: string; titleEn: string; group: { ar: string; en: string } | null }

// one request shared by every select on the screen
let cache: Promise<Opt[]> | null = null;
const loadOptions = () => (cache ??= api<Opt[]>('/admin/settings/page-options', { cache: 'no-store' }).catch(() => { cache = null; return [] as Opt[]; }));

/**
 * Picks one of the site's pages (the same list as the menu and the quick links) instead of typing a link. "Another link…" keeps the way to type
 * an address on another website, and a value that is not in the list (an old typed link) is shown that way so nothing is lost.
 */
export function PageSelect({ value, onChange, allowCustom = true, label }: { value: string; onChange: (v: string) => void; allowCustom?: boolean; label?: string }) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [opts, setOpts] = useState<Opt[]>([]);
  const [custom, setCustom] = useState(false);
  useEffect(() => { let live = true; loadOptions().then((o) => { if (live) setOpts(o); }); return () => { live = false; }; }, []);
  const known = opts.some((o) => o.url === value);
  const isCustom = allowCustom && (custom || (!!value && !known));
  const groups = useMemo(() => {
    const m = new Map<string, Opt[]>();
    for (const o of opts) {
      const g = o.group ? (ar ? o.group.ar : o.group.en) : ar ? 'صفحات أخرى' : 'Other pages';
      m.set(g, [...(m.get(g) ?? []), o]);
    }
    return [...m.entries()];
  }, [opts, ar]);
  return (
    <div className="space-y-2">
      <select aria-label={label} className={inputCls} value={isCustom ? '__custom' : value} onChange={(e) => {
        const v = e.target.value;
        if (v === '__custom') { setCustom(true); if (known) onChange(''); } else { setCustom(false); onChange(v); }
      }}>
        <option value="">{ar ? '— بدون رابط —' : '— no link —'}</option>
        {groups.map(([g, list]) => <optgroup key={g} label={g}>{list.map((x) => <option key={x.url} value={x.url}>{ar ? x.titleAr : x.titleEn}</option>)}</optgroup>)}
        {allowCustom && <option value="__custom">{ar ? 'رابط آخر (موقع خارجي)…' : 'Another link (other website)…'}</option>}
      </select>
      {isCustom && <input dir="ltr" maxLength={500} className={inputCls} placeholder="https://" aria-label={ar ? 'الرابط' : 'Link'} value={value} onChange={(e) => onChange(e.target.value.trim())} />}
    </div>
  );
}
