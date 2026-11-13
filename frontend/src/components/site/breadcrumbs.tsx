'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import { useI18n } from '@/lib/i18n';

type Label = [ar: string, en: string];

/** Name of each page, by its path inside the site (without the language). `link` sends the crumb to another page; `null` = a path that is not a page itself. */
const SITE: Record<string, Label | null> = {
  agenda: ['الأجندة', 'Agenda'], board: ['مجلس الإدارة', 'Board'], committees: ['اللجان والقطاعات', 'Committees & sectors'],
  contact: ['اتصل بنا', 'Contact us'], documents: ['القرارات والتعاميم', 'Decisions & circulars'], faq: ['الأسئلة الشائعة', 'FAQ'],
  'forgot-password': ['نسيت كلمة المرور', 'Forgot password'], gallery: ['معرض الصور', 'Image gallery'], incubator: ['حاضنة الأعمال', 'Business incubator'],
  library: ['المكتبة والأرشيف الرقمي', 'Library & digital archive'], login: ['تسجيل الدخول', 'Sign in'], media: ['المركز الإعلامي', 'Media center'],
  membership: ['الخدمات', 'Services'], news: ['الأخبار', 'News'], occasions: ['الفعاليات', 'Events'],
  'occasions/current': ['الفعاليات الحالية', 'Current events'], 'occasions/exhibitions': ['المعارض', 'Exhibitions'],
  'occasions/previous': ['الفعاليات السابقة', 'Previous events'], 'occasions/upcoming': ['الفعاليات القادمة', 'Upcoming events'],
  'one-stop': ['النافذة الواحدة', 'One-stop window'], privacy: ['سياسة الخصوصية', 'Privacy policy'], profile: ['حسابي', 'My profile'],
  register: ['إنشاء حساب', 'Create account'], 'reset-password': ['إعادة تعيين كلمة المرور', 'Reset password'], search: ['البحث', 'Search'],
  services: ['الخدمات', 'Services'], sitemap: ['خريطة الموقع', 'Sitemap'], subscribe: ['النشرة البريدية', 'Newsletter'],
  'subscribe/preferences': ['إدارة الاشتراك', 'Manage subscription'], 'subscribe/unsubscribe': ['إلغاء الاشتراك', 'Unsubscribe'],
  'subscribe/verify': ['تأكيد الاشتراك', 'Confirm subscription'], terms: ['الشروط والأحكام', 'Terms & conditions'], training: ['مركز التدريب', 'Training center'],
  'training/trainer-apply': ['التقدّم كمدرّب', 'Apply as a trainer'], pages: null,
  // businesswomen pages live under /committees: Home > Committees > Businesswomen
  'committees/women': ['سيدات الأعمال', 'Businesswomen'], 'committees/women/section': ['القسم', 'Section'],
};
const LINK: Record<string, string> = { services: 'membership' };
const EXPO: Record<string, Label> = {
  expo: ['DCC EXPO', 'DCC EXPO'], about: ['عن المعرض', 'About'], contact: ['اتصل بنا', 'Contact us'], exhibitors: ['العارضون', 'Exhibitors'],
  faq: ['الأسئلة الشائعة', 'FAQ'], info: ['معلومات', 'Information'], news: ['الأخبار', 'News'], programme: ['البرنامج', 'Programme'],
  register: ['التسجيل', 'Register'], sectors: ['القطاعات', 'Sectors'], sponsors: ['الرعاة', 'Sponsors'],
};
const DETAILS: Label = ['التفاصيل', 'Details'];

// A detail page gives its own name (the news title, the committee name...) for the last crumb through useCrumbTitle().
let customTitle = '';
const listeners = new Set<() => void>();
const setCustom = (v: string) => { if (customTitle !== v) { customTitle = v; listeners.forEach((l) => l()); } };
export function useCrumbTitle(title?: string | null) {
  useEffect(() => { setCustom((title ?? '').trim()); return () => setCustom(''); }, [title]);
}

export interface Crumb { label: string; to?: string }

/** The path of the page as a trail. `scope` tells which part of the site the page belongs to. */
function trail(path: string, scope: 'site' | 'expo' | 'women', ar: boolean, custom: string, homeLabel: string): Crumb[] {
  const segs = path.split('/').filter(Boolean).slice(1); // [0] is the language
  if (segs.length === 0) return [];
  const pick = (l: Label) => (ar ? l[0] : l[1]);
  const out: Crumb[] = [{ label: homeLabel, to: '/' }];
  if (scope === 'expo') {
    segs.forEach((s, i) => {
      const l = EXPO[s];
      if (l) out.push({ label: pick(l), to: i === segs.length - 1 ? undefined : `/${segs.slice(0, i + 1).join('/')}` });
    });
    // an unknown deeper page (a single exhibitor, ...) ends with its own name
    if (custom && segs.length > 1) out.push({ label: custom });
    return out.length > 1 ? out : [];
  }
  if (scope === 'women') out.push({ label: pick(SITE.committees as Label), to: '/committees' });
  let viewed = false;
  for (let i = scope === 'women' ? 1 : 0; i < segs.length; i++) {
    const key = segs.slice(0, i + 1).join('/');
    const last = i === segs.length - 1;
    if (segs[i] === 'view') { out.push({ label: custom || pick(DETAILS) }); viewed = true; continue; }
    if (!(key in SITE)) continue;
    const l = SITE[key];
    if (!l) continue;
    // a page that names something inside itself (a decisions section, ...) stays a link and the name comes after it
    out.push({ label: pick(l), to: last && !custom ? undefined : `/${LINK[key] ?? key}` });
  }
  if (custom && !viewed) out.push({ label: custom });
  return out.length > 1 ? out : [];
}

/**
 * The breadcrumb of every page: Home › section › page. The site, DCC EXPO and the businesswomen pages each render their own
 * (`scope`), in their own layout. get2trade draws its own because it is a mini-site with tabs.
 */
export function Breadcrumbs({ scope = 'site', className = '' }: { scope?: 'site' | 'expo' | 'women'; className?: string }) {
  const { lang, t, href } = useI18n();
  const pathname = usePathname() ?? '';
  const custom = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => customTitle, () => '');
  if (/^\/(ar|en)\/get2trade(\/|$)/.test(pathname) || /^\/(ar|en)\/admin(\/|$)/.test(pathname)) return null;
  const items = trail(pathname, scope, lang === 'ar', custom, t('site.home'));
  if (items.length === 0) return null;
  return (
    <nav aria-label="breadcrumb" className={`mx-auto max-w-6xl px-4 pt-4 text-sm text-gray-500 ${className}`}>
      <ol className="flex flex-wrap items-center gap-y-1">
        {items.map((c, i) => (
          <li key={i} className="flex items-center">
            {i > 0 && <span aria-hidden="true" className="mx-1.5">›</span>}
            {c.to ? <Link href={href(c.to)} className="hover:text-primary">{c.label}</Link> : <span aria-current="page" className="max-w-[60vw] truncate text-ink">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
