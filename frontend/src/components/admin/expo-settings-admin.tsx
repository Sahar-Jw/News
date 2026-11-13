'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

type Section = 'about' | 'sectors' | 'info' | 'contact' | 'identity';
interface Row { id: number; key: string; valueType: string; value: unknown; fileUrl?: string }
type Kind = 'text' | 'area' | 'lines' | 'url' | 'color' | 'file' | 'bool' | 'date';
interface F { key: string; kind: Kind; ar: string; en: string; hintAr?: string; hintEn?: string; pair?: boolean }

const p = (key: string, kind: Kind, ar: string, en: string, hintAr?: string, hintEn?: string): F => ({ key, kind, ar, en, hintAr, hintEn, pair: true });
const one = (key: string, kind: Kind, ar: string, en: string, hintAr?: string, hintEn?: string): F => ({ key, kind, ar, en, hintAr, hintEn });
const LINES_AR = 'كل نقطة في سطر مستقل';
const LINES_EN = 'One item per line';

const SECTIONS: Record<Section, { titleAr: string; titleEn: string; hintAr: string; hintEn: string; fields: F[] }> = {
  about: {
    titleAr: 'التعريف بالمعرض', titleEn: 'About the expo', hintAr: 'صفحة «عن المعرض»: التعريف والفكرة والأهداف والقطاعات والفئات وأهمية المعرض والقيمة المقدمة.', hintEn: 'The "About" page: definition, idea, goals, sectors, participants, importance and the value offered.',
    fields: [
      p('about', 'area', 'التعريف بالمعرض', 'What is the expo'), p('idea', 'area', 'فكرة المعرض', 'The idea'),
      p('goals', 'lines', 'أهداف المعرض', 'Goals', LINES_AR, LINES_EN), p('target_sectors', 'lines', 'القطاعات المستهدفة', 'Targeted sectors', LINES_AR, LINES_EN),
      p('participants', 'lines', 'الفئات المشاركة', 'Who takes part', LINES_AR, LINES_EN), p('participation_nature', 'area', 'طبيعة المشاركة', 'Nature of participation'),
      p('importance', 'area', 'أهمية المعرض', 'Why it matters'), p('why_expo', 'area', 'قسم «لماذا EXPO؟» (شرح)', '"Why EXPO?" (explanation)'),
      p('why', 'lines', 'لماذا تشارك؟ (نقاط تظهر في الصفحة الرئيسية وتحت «لماذا EXPO»)', 'Why take part? (points)', LINES_AR, LINES_EN),
      p('value_exhibitors', 'lines', 'القيمة للعارضين', 'Value for exhibitors', LINES_AR, LINES_EN), p('value_visitors', 'lines', 'القيمة للزوار', 'Value for visitors', LINES_AR, LINES_EN),
      p('value_trade', 'lines', 'القيمة للقطاع التجاري', 'Value for the trade sector', LINES_AR, LINES_EN),
    ],
  },
  sectors: {
    titleAr: 'القطاعات المشاركة', titleEn: 'Participating sectors', hintAr: 'القطاعات والتخصصات التي يستهدفها المعرض. العارضون المسجلون وقطاعاتهم يظهرون تلقائياً.', hintEn: 'The sectors and specialities targeted by the expo. Registered exhibitors and their sectors appear automatically.',
    fields: [
      p('sectors_intro', 'area', 'مقدمة الصفحة', 'Page introduction'),
      p('sectors_list', 'lines', 'القطاعات', 'Sectors', 'كل قطاع في سطر بالشكل: الاسم | وصف قصير', 'One sector per line: Name | short description'),
    ],
  },
  info: {
    titleAr: 'المعلومات والتسجيل', titleEn: 'Information & registration', hintAr: 'معلومات هامة للعارض والزائر، نص صفحة التسجيل، ومخطط المعرض.', hintEn: 'Key information for exhibitors and visitors, registration page text and the floor plan.',
    fields: [
      one('register_open', 'bool', 'التسجيل مفتوح (عارضون وزوار)', 'Registration is open'),
      p('register_note', 'area', 'نص أعلى صفحة التسجيل', 'Text above the registration forms'),
      p('info_exhibitors', 'lines', 'معلومات هامة للعارضين', 'Key information for exhibitors', LINES_AR, LINES_EN), p('info_visitors', 'lines', 'معلومات هامة للزوار', 'Key information for visitors', LINES_AR, LINES_EN),
      one('floor_plan_image', 'file', 'صورة مخطط المعرض (تُبنى عليها الخريطة التفاعلية)', 'Floor plan image (the interactive map is built on it)', 'بعد رفعها حدّد موقع كل عارض على المخطط من نموذج العارض.', 'After uploading it, place every exhibitor on the plan from the exhibitor form.'),
      p('floor_plan', 'area', 'وصف المخطط والأجنحة (نص)', 'Floor plan description (text)'),
    ],
  },
  contact: {
    titleAr: 'التواصل والفريق', titleEn: 'Contact & team', hintAr: 'بيانات التواصل وفريق المعرض ووسائل التواصل الاجتماعي ووسوم الأخبار.', hintEn: 'Contact details, the expo team, social media and news topics.',
    fields: [
      one('contact_phone', 'text', 'هاتف المعرض', 'Phone'), one('contact_email', 'text', 'بريد المعرض (تصله الطلبات)', 'E-mail (receives the requests)'),
      one('contact_website', 'url', 'الموقع الإلكتروني', 'Website'), one('contact_map_url', 'url', 'رابط الموقع على الخريطة', 'Map link'),
      p('contact_address', 'text', 'العنوان', 'Address'),
      p('team', 'lines', 'فريق المعرض', 'Expo team', 'كل عضو في سطر بالشكل: الاسم | الصفة | الهاتف | البريد', 'One member per line: Name | Role | Phone | E-mail'),
      one('social_facebook_url', 'url', 'فيسبوك', 'Facebook'), one('social_x_url', 'url', 'إكس', 'X'), one('social_instagram_url', 'url', 'إنستغرام', 'Instagram'), one('social_linkedin_url', 'url', 'لينكدإن', 'LinkedIn'),
      one('social_youtube_url', 'url', 'يوتيوب', 'YouTube'), one('social_whatsapp_url', 'url', 'واتساب', 'WhatsApp'), one('social_telegram_url', 'url', 'تيليغرام', 'Telegram'),
      p('news_topic', 'text', 'وسم الأخبار', 'News topic', 'الأخبار التي تحمل هذا الوسم تظهر في تبويب «الأخبار»', 'News with this topic appear in the "News" tab'),
      p('coverage_topic', 'text', 'وسم التغطية الإعلامية', 'Media coverage topic', 'اتركه فارغاً لإخفاء التبويب', 'Leave empty to hide the tab'),
      p('interviews_topic', 'text', 'وسم اللقاءات والمقابلات', 'Interviews topic', 'اتركه فارغاً لإخفاء التبويب', 'Leave empty to hide the tab'),
      p('materials_topic', 'text', 'وسم المواد الإعلامية', 'Media materials topic', 'اتركه فارغاً لإخفاء التبويب', 'Leave empty to hide the tab'),
    ],
  },
  identity: {
    titleAr: 'الهوية والمظهر', titleEn: 'Identity & theme', hintAr: 'اسم المعرض وشعاره وألوانه وموعده والتذييل: هوية مستقلة كموقع منفصل.', hintEn: 'Name, logo, colours, dates and footer: a separate site identity.',
    fields: [
      p('name', 'text', 'اسم المعرض', 'Name'), p('tagline', 'text', 'الشعار النصي (العنوان الرئيسي)', 'Tagline (main headline)'),
      one('logo', 'file', 'شعار المعرض', 'Logo'), one('hero_image', 'file', 'صورة الواجهة', 'Hero image'),
      one('start_date', 'date', 'تاريخ البداية', 'Start date'), one('end_date', 'date', 'تاريخ النهاية', 'End date'), p('venue', 'text', 'مكان المعرض', 'Venue'),
      one('primary_color', 'color', 'اللون الأساسي', 'Primary colour'), one('accent_color', 'color', 'لون التمييز (الذهبي)', 'Accent colour'), one('header_color', 'color', 'لون شريط التنقل', 'Header colour'),
      one('footer_color', 'color', 'لون التذييل', 'Footer colour'), one('background_color', 'color', 'لون خلفية الصفحة', 'Page background'), one('text_color', 'color', 'لون النص', 'Text colour'),
      p('footer_text', 'area', 'ملخص عن المعرض (يظهر تحت الشعار في التذييل)', 'Summary (shown under the logo in the footer)'), p('rights', 'text', 'سطر الحقوق أسفل التذييل', 'Rights line'),
    ],
  },
};

export const EXPO_SECTIONS = Object.keys(SECTIONS) as Section[];

/** One page of the EXPO site settings (Settings → DCC EXPO): fields are grouped by what they change on the site; Arabic and English side by side; one Save. */
export function ExpoSettingsAdmin({ section }: { section: Section }) {
  const { lang } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const ar = lang === 'ar';
  const cfg = SECTIONS[section];
  const editable = can('settings.update');
  const [rows, setRows] = useState<Record<string, Row> | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, File | 'remove'>>({});
  const [loadErr, setLoadErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ data: Row[] }>('/admin/settings', { params: { category: 'expo', limit: 'all' }, cache: 'no-store' })
      .then(({ data }) => { setRows(Object.fromEntries(data.map((r) => [r.key, r]))); setDraft({}); setFiles({}); setLoadErr(''); })
      .catch((e: unknown) => setLoadErr(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => { setRows(null); load(); }, [load, section]);

  const keysOf = (f: F) => (f.pair ? [`${f.key}_ar`, `${f.key}_en`] : [f.key]);
  const value = (key: string) => (key in draft ? draft[key] : rows?.[key]?.value ?? '');
  const set = (key: string, v: unknown) => setDraft((d) => ({ ...d, [key]: v }));
  const dirty = Object.keys(draft).length + Object.keys(files).length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rows || busy || !dirty) return;
    setBusy(true);
    try {
      for (const [key, v] of Object.entries(draft)) {
        const row = rows[key];
        if (!row) continue;
        await api(`/admin/settings/${row.id}`, { method: 'PATCH', body: { value: row.valueType === 'boolean' ? v === true || v === 'true' : typeof v === 'string' && v.trim() === '' ? null : v } });
      }
      for (const [key, f] of Object.entries(files)) {
        const row = rows[key];
        if (!row) continue;
        if (f === 'remove') await api(`/admin/settings/${row.id}`, { method: 'PATCH', body: { value: null } });
        else { const fd = new FormData(); fd.set('file', f); await api(`/admin/settings/${row.id}/file`, { method: 'POST', form: fd }); }
      }
      toast(ar ? 'تم الحفظ' : 'Saved');
      load();
    } catch (err: unknown) { toast(err instanceof Error ? err.message : String(err), 'err'); }
    finally { setBusy(false); }
  };

  const input = (f: F, key: string, lbl: string, dir?: 'rtl' | 'ltr') => {
    const v = value(key);
    const common = { disabled: !editable || busy, dir, className: inputCls };
    if (f.kind === 'area' || f.kind === 'lines') return <textarea {...common} rows={f.kind === 'lines' ? 5 : 4} maxLength={20000} value={String(v ?? '')} onChange={(e) => set(key, e.target.value)} aria-label={lbl} />;
    if (f.kind === 'color') return <div className="flex items-center gap-2"><input type="color" disabled={!editable || busy} value={/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : '#000000'} onChange={(e) => set(key, e.target.value)} className="h-10 w-14 cursor-pointer rounded border border-line" aria-label={lbl} /><input {...common} dir="ltr" maxLength={7} value={String(v ?? '')} onChange={(e) => set(key, e.target.value)} placeholder="#rrggbb" /></div>;
    if (f.kind === 'bool') return <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" disabled={!editable || busy} checked={v === true || v === 'true'} onChange={(e) => set(key, e.target.checked)} />{ar ? 'نعم' : 'Yes'}</label>;
    if (f.kind === 'date') return <input {...common} type="date" dir="ltr" value={String(v ?? '')} onChange={(e) => set(key, e.target.value)} aria-label={lbl} />;
    if (f.kind === 'file') {
      const staged = files[key];
      const saved = rows?.[key]?.fileUrl && rows[key].value && staged !== 'remove' ? fileUrl(rows[key].fileUrl!) : '';
      const preview = staged && staged !== 'remove' ? URL.createObjectURL(staged) : saved;
      return (
        <div className="flex flex-wrap items-center gap-3">
          {preview ? <img src={preview} alt="" className="h-16 max-w-40 rounded border border-line bg-white object-contain p-0.5" /> : <span className="text-sm text-gray-400">—</span>}
          {editable && <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) setFiles((x) => ({ ...x, [key]: file })); }} aria-label={lbl} />}
          {editable && (preview || staged) && <Button type="button" size="sm" variant="outline" className="text-red-600" onClick={() => setFiles((x) => ({ ...x, [key]: 'remove' }))}>{ar ? 'حذف الصورة' : 'Remove'}</Button>}
        </div>
      );
    }
    return <input {...common} type={f.kind === 'url' ? 'url' : 'text'} dir={f.kind === 'url' ? 'ltr' : dir} maxLength={f.kind === 'url' ? 500 : 2000} value={String(v ?? '')} onChange={(e) => set(key, e.target.value)} aria-label={lbl} />;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{ar ? cfg.titleAr : cfg.titleEn}</h1>
        <p className="mt-1 text-sm text-gray-500">{ar ? cfg.hintAr : cfg.hintEn}</p>
      </div>
      {loadErr ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadErr}</p> : !rows ? <p role="status" className="py-8 text-center text-sm text-gray-500">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p> : (
        <form onSubmit={save} className="space-y-4">
          {cfg.fields.filter((f) => keysOf(f).every((k) => rows[k])).map((f) => (
            <section key={f.key} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
              <h2 className="text-sm font-bold text-secondary">{ar ? f.ar : f.en}</h2>
              {(ar ? f.hintAr : f.hintEn) && <p className="mb-2 text-xs text-gray-500">{ar ? f.hintAr : f.hintEn}</p>}
              {f.pair ? (
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <Field label="العربية">{input(f, `${f.key}_ar`, `${f.ar} (AR)`, 'rtl')}</Field>
                  <Field label="English">{input(f, `${f.key}_en`, `${f.en} (EN)`, 'ltr')}</Field>
                </div>
              ) : <div className="mt-2">{input(f, f.key, ar ? f.ar : f.en)}</div>}
            </section>
          ))}
          {cfg.fields.some((f) => !keysOf(f).every((k) => rows[k])) && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{ar ? 'بعض الحقول غير ظاهرة لأن قاعدة البيانات لم تُحدَّث بعد: شغّل الـ migration الجديدة.' : 'Some fields are hidden because the database is not updated yet: run the new migration.'}</p>}
          {editable ? <div className="sticky bottom-3 flex justify-end"><Button disabled={busy || !dirty}>{ar ? 'حفظ' : 'Save'}</Button></div> : <p className="text-sm text-gray-500">{ar ? 'تحتاج إلى صلاحية تعديل الإعدادات.' : 'Settings update permission is required.'}</p>}
        </form>
      )}
    </div>
  );
}
