'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { FormBySlug } from '@/components/site/dynamic-form';
import { useSite } from '@/components/site/site-context';
import { readBrandedPageLinks } from '@/lib/branded-page-links';
import { EMAIL_RE, PHONE_RE } from '@/components/site/training-shared';

export interface ExpoBase { id: number; name: string; description: string; website: string | null; logoUrl: string | null }
export interface ExpoExhibitor extends ExpoBase { sector: string; booth: string; mapX: number | null; mapY: number | null }
export interface ExpoSponsor extends ExpoBase { tier: string }
export interface ExpoSession extends ExpoBase { type: string; startsAt: string | null; endsAt: string | null; hall: string; speaker: string }
export interface ExpoData { exhibitors: ExpoExhibitor[]; sponsors: ExpoSponsor[]; sessions: ExpoSession[]; sectors: string[] }

export const SPONSOR_TIERS = ['strategic', 'gold', 'silver', 'partner'] as const;
export const SESSION_TYPES = ['keynote', 'seminar', 'workshop', 'b2b', 'event', 'meeting', 'activity', 'other'] as const;

/** label of a programme type (older types have dictionary keys, the new ones are inline) */
export const sessionTypeLabel = (type: string, ar: boolean) => ({ event: ['فعالية', 'Event'], meeting: ['لقاء', 'Meeting'], activity: ['نشاط مصاحب', 'Accompanying activity'] } as Record<string, [string, string]>)[type]?.[ar ? 0 : 1];
export const APPLICATION_KINDS = ['exhibitor', 'visitor', 'info'] as const;
export const APPLICATION_STATUSES = ['new', 'in_review', 'approved', 'rejected'] as const;

/** Exhibitors, sponsors and programme in one request (the lists are small). */
export function useExpoData() {
  const { lang } = useI18n();
  const [data, setData] = useState<ExpoData | null>(null);
  useEffect(() => {
    setData(null);
    api<ExpoData>('/public/expo', { params: { lang }, cache: 'no-store' }).then(setData).catch(() => setData({ exhibitors: [], sponsors: [], sessions: [], sectors: [] }));
  }, [lang]);
  return data;
}

/** Event info lives in the "expo" settings category; every text falls back to Arabic when the English one is empty. */
export function useExpoInfo() {
  const { lang } = useI18n();
  const { s, loc, img } = useSite();
  const L = (key: string) => loc('expo', key) || String(s('expo', `${key}_ar`) ?? '');
  const lines = (key: string) => L(key).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const start = String(s('expo', 'start_date') ?? '');
  const end = String(s('expo', 'end_date') ?? '') || start;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Damascus' });
  const daysLeft = start ? Math.round((Date.parse(`${start}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : null;
  const phase: 'upcoming' | 'live' | 'ended' | 'unknown' = !start ? 'unknown' : today < start ? 'upcoming' : today <= end ? 'live' : 'ended';
  return {
    lang, L, lines, start, end, daysLeft, phase,
    name: L('name') || 'DCC EXPO', tagline: L('tagline'), venue: L('venue'),
    logo: img('expo', 'logo'), hero: img('expo', 'hero_image'),
    floorPlan: L('floor_plan'), footerText: L('footer_text'),
    pageLinks: readBrandedPageLinks(s('expo', 'page_links'), 'expo'),
    email: String(s('expo', 'contact_email') ?? ''), phone: String(s('expo', 'contact_phone') ?? ''), website: String(s('expo', 'contact_website') ?? ''), address: L('contact_address'), mapUrl: String(s('expo', 'contact_map_url') ?? ''),
    floorPlanImage: img('expo', 'floor_plan_image'), social: (key: string) => String(s('expo', `social_${key}`) ?? ''),
    newsTopic: L('news_topic'), registerOpen: s('expo', 'register_open') !== false && s('expo', 'register_open') !== 'false',
  };
}

export const BOOTH_TYPES = ['equipped', 'space', 'collective', 'sponsor', 'other'] as const;
export const VISIT_INTERESTS = ['sourcing', 'partnerships', 'products', 'programme', 'other'] as const;
export const INQUIRY_TYPES = ['general', 'exhibitor', 'visitor', 'sponsorship', 'media', 'other'] as const;
const OPTIONS: Record<string, Record<string, [string, string]>> = {
  participationType: { equipped: ['جناح مجهّز', 'Equipped stand'], space: ['مساحة فقط', 'Space only'], collective: ['مشاركة جماعية', 'Collective participation'], sponsor: ['رعاية', 'Sponsorship'], other: ['أخرى', 'Other'] },
  interest: { sourcing: ['البحث عن موردين ومنتجات', 'Sourcing suppliers and products'], partnerships: ['شراكات وفرص أعمال', 'Partnerships and business'], products: ['الاطلاع على المنتجات والخدمات', 'Discovering products and services'], programme: ['حضور الندوات والفعاليات', 'Seminars and events'], other: ['أخرى', 'Other'] },
  inquiryType: { general: ['استفسار عام', 'General inquiry'], exhibitor: ['المشاركة كعارض', 'Taking part as exhibitor'], visitor: ['زيارة المعرض', 'Visiting the expo'], sponsorship: ['الرعاية والشراكة', 'Sponsorship and partnership'], media: ['الإعلام والتغطية', 'Media and coverage'], other: ['أخرى', 'Other'] },
};
/** label of a stored option (shared with the admin) */
export const expoOption = (field: 'participationType' | 'interest' | 'inquiryType', value: string, ar: boolean) => OPTIONS[field][value]?.[ar ? 0 : 1] ?? value;

type FieldKey = 'name' | 'company' | 'jobTitle' | 'email' | 'phone' | 'country' | 'city' | 'sector' | 'products' | 'area' | 'participationType' | 'interest' | 'inquiryType' | 'message';
type V = Record<FieldKey, string>;
const EMPTY: V = { name: '', company: '', jobTitle: '', email: '', phone: '', country: '', city: '', sector: '', products: '', area: '', participationType: '', interest: '', inquiryType: '', message: '' };
const REQUIRED: Record<(typeof APPLICATION_KINDS)[number], FieldKey[]> = {
  exhibitor: ['company', 'name', 'jobTitle', 'phone', 'email', 'country', 'city', 'sector', 'products', 'area', 'participationType'],
  visitor: ['name', 'jobTitle', 'phone', 'email', 'country', 'city', 'sector', 'interest'],
  info: ['name', 'phone', 'email', 'inquiryType', 'message'],
};
const MAX_PROFILE = 10 * 1024 * 1024;

/**
 * The three EXPO request forms (exhibitor / visitor / information) are dashboard forms: "expo-exhibitor", "expo-visitor", "expo-info" (Forms → Forms).
 * `sectors` (suggestions) is no longer used: the sector is a normal text field of the form.
 */
export function ApplyForm({ kind }: { kind: (typeof APPLICATION_KINDS)[number]; sectors?: string[] }) {
  return <FormBySlug key={kind} slug={`expo-${kind}`} />;
}

export function Heading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <header className="mb-6 text-center">
      <h2 className="text-2xl font-extrabold text-primary md:text-3xl">{children}</h2>
      {sub && <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">{sub}</p>}
      <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-accent" /><span className="h-1 w-2 rounded-full bg-accent/50" /><span className="h-1 w-1 rounded-full bg-accent/25" /></div>
    </header>
  );
}

/** A titled white block of the EXPO pages. Shown only when it has content. */
export function Block({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-6 shadow-card ring-1 ring-line ${className}`}>
      <h3 className="mb-3 text-lg font-extrabold text-primary">{title}</h3>
      {children}
    </section>
  );
}

/** One item per line, shown as a diamond list */
export function Bullets({ items }: { items: string[] }) {
  return <ul className="space-y-2 text-sm leading-7 text-gray-700">{items.map((w, i) => <li key={i} className="flex gap-2"><span className="mt-1 text-accent">◆</span><span>{w}</span></li>)}</ul>;
}

/** Sponsors and partners grouped by tier (home page and the sponsors page) */
export function SponsorTiers({ sponsors }: { sponsors: ExpoSponsor[] }) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      {SPONSOR_TIERS.map((tier) => {
        const list = sponsors.filter((s) => ((SPONSOR_TIERS as readonly string[]).includes(s.tier) ? s.tier : 'partner') === tier);
        if (!list.length) return null;
        return (
          <div key={tier}>
            <div className="mb-2 text-center text-xs font-extrabold tracking-wider text-accent">{t(`ex.tier.${tier}`)}</div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {list.map((s) => {
                const inner = s.logoUrl ? <img src={s.logoUrl} alt={s.name} className="h-12 max-w-[9rem] object-contain" /> : <span className="font-bold text-secondary">{s.name}</span>;
                return s.website ? <a key={s.id} href={s.website} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white px-5 py-3 shadow-card ring-1 ring-line transition hover:ring-accent">{inner}</a> : <span key={s.id} className="rounded-xl bg-white px-5 py-3 shadow-card ring-1 ring-line">{inner}</span>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Floor plan image with a clickable pin for every exhibitor that has a position on it (set in the exhibitor's form). */
export function FloorPlanMap({ image, exhibitors }: { image: string; exhibitors: ExpoExhibitor[] }) {
  const { lang } = useI18n();
  const ar = lang === 'ar';
  const [picked, setPicked] = useState<number | null>(null);
  const pins = exhibitors.filter((e) => e.mapX != null && e.mapY != null);
  const sel = pins.find((e) => e.id === picked);
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
        <img src={image} alt={ar ? 'مخطط المعرض' : 'Floor plan'} className="block w-full" />
        {pins.map((e) => (
          <button key={e.id} type="button" onClick={() => setPicked(e.id === picked ? null : e.id)} aria-label={e.name} aria-pressed={e.id === picked}
            style={{ left: `${e.mapX}%`, top: `${e.mapY}%` }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white px-2 py-0.5 text-[11px] font-extrabold shadow-lg transition hover:scale-110 ${e.id === picked ? 'z-10 scale-110 bg-accent text-secondary' : 'bg-primary text-white'}`}>
            {e.booth || e.name.slice(0, 2)}
          </button>
        ))}
      </div>
      {pins.length > 0 && (
        <div className="mt-3 min-h-16 rounded-2xl bg-white p-4 text-sm shadow-card ring-1 ring-line" aria-live="polite">
          {sel ? (
            <div className="flex items-center gap-3">
              {sel.logoUrl ? <img src={sel.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" /> : <span className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-lg font-extrabold text-primary">{sel.name.slice(0, 1)}</span>}
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-secondary">{sel.name}</div>
                <div className="text-xs text-gray-600">{[sel.sector, sel.booth && `${ar ? 'الجناح' : 'Stand'} ${sel.booth}`].filter(Boolean).join(' · ')}</div>
              </div>
              {sel.website && <a href={sel.website} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold text-primary hover:underline">{ar ? 'زيارة الموقع' : 'Website'} ↗</a>}
            </div>
          ) : <p className="text-gray-500">{ar ? 'اضغط على أي جناح لمعرفة العارض.' : 'Select a stand to see the exhibitor.'}</p>}
        </div>
      )}
    </div>
  );
}
