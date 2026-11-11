'use client';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, onSiteChange } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { paginate } from '@/lib/list';
import { Button, Center, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { Thumb } from '@/components/site/cards';
import { ContactIcon } from '@/components/site/icons';
import { telHref } from '@/lib/utils';
import { ContactForm } from '@/components/site/contact-form';
import { ConfirmDelete, ItemActions, ManageBtn, PageManageBar } from '@/components/site/page-manage-bar';
import { Pager } from '@/components/site/pager';
import { useSite } from '@/components/site/site-context';
import { PublicService } from '@/components/site/services-shared';
import { FaqDialog } from '@/components/admin/faqs-admin';
import { ScheduleAdmin } from '@/components/admin/schedule-admin';
import { ServiceDialog } from '@/components/admin/services-admin';
import { dayInfo, dayName, fmtDay, fmtTime, readSchedule, ymd } from '@/lib/one-stop-schedule';

interface Faq { id: number; question: string; answer: string }

/** The tabs of the window: each one is its own page (`?tab=`), not a scroll to a section. The services tab opens by default. */
const TABS = ['services', 'hours', 'fees', 'faq', 'contact', 'eservices'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { services: 'os.nav.services', hours: 'os.nav.hours', fees: 'os.nav.fees', faq: 'os.nav.faq', contact: 'os.nav.contact', eservices: 'os.nav.eservices' };
const SERVICES_PER_PAGE = 9, FEES_PER_PAGE = 10, FAQS_PER_PAGE = 8;

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the visitor's timezone

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-card ring-1 ring-line ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-secondary"><span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />{title}</h2>
      {children}
    </section>
  );
}

/** Opening hours: today's status, the week, and the holidays / temporary changes that are coming. Falls back to the plain-text settings when no schedule is set. */
function HoursPanel() {
  const { lang, t } = useI18n();
  const { s, loc } = useSite();
  const sc = readSchedule(s('one_stop', 'schedule'));
  const hours = loc('one_stop', 'hours'), days = loc('one_stop', 'days'), notice = loc('one_stop', 'notice');
  const from = String(s('one_stop', 'notice_from') ?? ''), to = String(s('one_stop', 'notice_to') ?? '');
  const noticeOn = !!notice && (!from || today() >= from) && (!to || today() <= to);
  const range = (a: string, b: string) => `${fmtTime(a, lang)} – ${fmtTime(b, lang)}`;

  const now = new Date();
  const info = sc ? dayInfo(sc, now, lang) : null;
  const week = sc ? [0, 1, 2, 3, 4, 5, 6].map((d) => {
    // the next date of each weekday inside the coming week, so holidays / changes show on the right row
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((d - now.getDay() + 7) % 7));
    return { d, date, i: dayInfo(sc, date, lang) };
  }) : [];
  const startKey = ymd(now);
  const upcoming = sc ? [
    ...sc.holidays.filter((h) => (h.to || h.from) >= startKey).map((h) => ({ from: h.from, to: h.to, text: lang === 'en' ? h.labelEn || h.labelAr : h.labelAr || h.labelEn, tag: t('os.holiday'), tone: 'red' as const })),
    ...sc.changes.filter((c) => (c.to || c.from) >= startKey).map((c) => ({ from: c.from, to: c.to, text: [c.closed ? t('os.closed') : range(c.hoursFrom, c.hoursTo), lang === 'en' ? c.noteEn || c.noteAr : c.noteAr || c.noteEn].filter(Boolean).join(' · '), tag: t('os.changedHours'), tone: 'amber' as const })),
  ].sort((a, b) => a.from.localeCompare(b.from)).slice(0, 8) : [];

  return (
    <Panel title={t('os.hours')}>
      {sc && info ? (
        <>
          <div className={`mb-4 flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${info.open ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
            <span>{info.open ? t('os.openNow') : t('os.closedToday')}</span>
            {info.open && <span className="font-semibold">{range(info.from, info.to)}</span>}
            {info.note && <span className="font-semibold">· {info.note}</span>}
          </div>
          <table className="w-full text-sm">
            <caption className="sr-only">{t('os.receptionHours')}</caption>
            <tbody>
              {week.map(({ d, date, i }) => {
                const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth();
                return (
                  <tr key={d} className={`border-t border-line ${isToday ? 'bg-primary/5 font-bold' : ''}`}>
                    <td className="px-2 py-2">{dayName(d, lang)}{isToday && <span className="ms-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">{t('os.today')}</span>}</td>
                    <td className="px-2 py-2 text-start">
                      {i.open ? <span>{range(i.from, i.to)}</span> : <span className="text-gray-500">{t('os.closed')}</span>}
                      {i.kind !== 'week' && <span className={`ms-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${i.kind === 'holiday' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{i.kind === 'holiday' ? t('os.holiday') : t('os.changedHours')}{i.note ? `: ${i.note}` : ''}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {upcoming.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-extrabold text-secondary">{t('os.upcoming')}</h3>
              <ul className="space-y-1.5 text-sm">
                {upcoming.map((u, i) => (
                  <li key={i} className={`rounded-lg px-3 py-2 ${u.tone === 'red' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
                    <span className="font-bold">{u.from === u.to || !u.to ? fmtDay(u.from, lang) : `${fmtDay(u.from, lang)} → ${fmtDay(u.to, lang)}`}</span> <span className="opacity-80">({u.tag})</span>{u.text && <span className="block text-xs">{u.text}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : hours || days ? (
        <div className="space-y-1 text-sm leading-7 text-gray-700">
          {hours && <p>{t('os.hoursLine')}: {hours}</p>}
          {days && <p>{t('os.daysLine')}: {days}</p>}
        </div>
      ) : <p className="text-sm text-gray-500">{t('os.hoursEmpty')}</p>}
      {noticeOn && <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">{notice}</p>}
    </Panel>
  );
}

/** Services tab: search + type chips + filters, then the service cards (paged). */
function ServicesTab({ items, tools, onPageChange }: { items: PublicService[] | null; tools: (x: PublicService) => React.ReactNode; onPageChange: () => void }) {
  const { lang, t, href } = useI18n();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [dept, setDept] = useState('');
  const [page, setPage] = useState(1);

  const kinds = useMemo(() => [...new Set((items ?? []).map((x) => x.kind))], [items]);
  const depts = useMemo(() => [...new Set((items ?? []).map((x) => x.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, lang)), [items, lang]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((x) => (!kind || x.kind === kind) && (!dept || x.department === dept) && (!needle || `${x.name} ${x.description}`.toLowerCase().includes(needle)));
  }, [items, q, kind, dept]);
  const filtered = !!(q.trim() || kind || dept);
  const kindCount = (k: string) => (items ?? []).filter((x) => x.kind === k).length;
  const pg = paginate(shown, page, SERVICES_PER_PAGE);
  useEffect(() => { setPage(1); }, [q, kind, dept]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row">
        <input type="search" className={`${inputCls} md:flex-1`} maxLength={100} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('os.search')} aria-label={t('os.search')} />
        <select className={`${inputCls} md:w-48`} value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t('os.type')}>
          <option value="">{t('os.allTypes')}</option>
          {kinds.map((k) => <option key={k} value={k}>{t(`svc.kind.${k}`)}</option>)}
        </select>
        <select className={`${inputCls} md:w-48`} value={dept} onChange={(e) => setDept(e.target.value)} aria-label={t('os.department')}>
          <option value="">{t('os.allDepartments')}</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {filtered && <Button type="button" variant="outline" onClick={() => { setQ(''); setKind(''); setDept(''); }}>{t('os.clear')}</Button>}
      </div>

      {kinds.length > 1 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('os.typeCount')}>
          <button type="button" aria-pressed={!kind} onClick={() => setKind('')} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${!kind ? 'bg-secondary text-white shadow-card' : 'bg-primary/10 text-ink/80 hover:bg-primary/20'}`}>{t('os.allTypes')} ({(items ?? []).length})</button>
          {kinds.map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(kind === k ? '' : k)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${kind === k ? 'bg-secondary text-white shadow-card' : 'bg-primary/10 text-ink/80 hover:bg-primary/20'}`}>{t(`svc.kind.${k}`)} ({kindCount(k)})</button>)}
        </div>
      )}

      {!items ? <Center><Spinner /></Center> : items.length === 0 ? <Center>{t('os.noServices')}</Center> : shown.length === 0 ? <Center>{t('os.empty')}</Center> : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pg.rows.map((x) => (
              <div key={x.id} className="flex flex-col gap-2">
                <Link href={href(`/services/view?id=${x.id}`)} className="group flex-1 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent">
                  <Thumb src={x.imageUrl} alt="" className="h-36 w-full" />
                  <div className="p-4">
                    <h3 className="font-extrabold text-secondary group-hover:text-primary">{x.name}</h3>
                    <span className="mt-1 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{t(`svc.kind.${x.kind}`)}</span>
                    {x.description && <p className="mt-2 line-clamp-2 text-xs leading-6 text-gray-600">{x.description}</p>}
                    <p className="mt-2 text-xs leading-6 text-gray-500">{[x.department, x.duration, x.fee].filter(Boolean).join(' · ')}</p>
                  </div>
                </Link>
                {tools(x)}
              </div>
            ))}
          </div>
          <Pager page={pg.page} totalPages={pg.totalPages} onPage={(p) => { setPage(p); onPageChange(); }} />
        </>
      )}
    </div>
  );
}

/** Fees tab: every service with its type, department, duration and fee (paged). */
function FeesTab({ items, onPageChange }: { items: PublicService[] | null; onPageChange: () => void }) {
  const { t, href } = useI18n();
  const { loc } = useSite();
  const [page, setPage] = useState(1);
  const feesNote = loc('one_stop', 'fees_note');
  const pg = paginate(items ?? [], page, FEES_PER_PAGE);
  return (
    <Panel title={t('os.feesTitle')}>
      {!items ? <Center><Spinner /></Center> : items.length === 0 ? <p className="text-sm text-gray-500">{t('os.empty')}</p> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-start text-sm">
              <thead><tr className="bg-primary/5 text-xs text-gray-600"><th className="px-3 py-2 text-start font-semibold">{t('os.feeService')}</th><th className="px-3 py-2 text-start font-semibold">{t('os.typeCount')}</th><th className="px-3 py-2 text-start font-semibold">{t('os.colDepartment')}</th><th className="px-3 py-2 text-start font-semibold">{t('os.colDuration')}</th><th className="px-3 py-2 text-start font-semibold">{t('os.feeAmount')}</th></tr></thead>
              <tbody>
                {pg.rows.map((x) => (
                  <tr key={x.id} className="border-t border-line">
                    <td className="px-3 py-2"><Link href={href(`/services/view?id=${x.id}`)} className="font-semibold text-secondary hover:text-primary">{x.name}</Link></td>
                    <td className="px-3 py-2 text-gray-600">{t(`svc.kind.${x.kind}`)}</td>
                    <td className="px-3 py-2 text-gray-600">{x.department || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{x.duration || '—'}</td>
                    <td className="px-3 py-2 font-bold text-secondary">{x.fee || <span className="font-normal text-gray-400">{t('os.noFee')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={pg.page} totalPages={pg.totalPages} onPage={(p) => { setPage(p); onPageChange(); }} />
        </>
      )}
      {feesNote && <p className="mt-3 text-xs leading-6 text-gray-500">{feesNote}</p>}
    </Panel>
  );
}

/** FAQ tab: the questions of the window as an accordion (paged). */
function FaqTab({ faqs, tools, onPageChange }: { faqs: Faq[]; tools: (f: Faq) => React.ReactNode; onPageChange: () => void }) {
  const { t } = useI18n();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pg = paginate(faqs, page, FAQS_PER_PAGE);
  return (
    <Panel title={t('os.faq')}>
      {faqs.length === 0 ? <p className="text-sm text-gray-500">{t('os.noFaqs')}</p> : (
        <>
          <div className="space-y-2">
            {pg.rows.map((f) => {
              const on = openFaq === f.id;
              return (
                <div key={f.id}>
                  <div className="overflow-hidden rounded-xl ring-1 ring-line">
                    <button type="button" aria-expanded={on} onClick={() => setOpenFaq(on ? null : f.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start font-bold text-secondary">
                      <span>{f.question}</span><span className={`shrink-0 text-accent transition-transform ${on ? 'rotate-45' : ''}`} aria-hidden="true">＋</span>
                    </button>
                    {on && <div className="whitespace-pre-line border-t border-line px-4 py-3 text-sm leading-7 text-gray-700">{f.answer}</div>}
                  </div>
                  <div className="mt-1.5">{tools(f)}</div>
                </div>
              );
            })}
          </div>
          <Pager page={pg.page} totalPages={pg.totalPages} onPage={(p) => { setPage(p); onPageChange(); }} />
        </>
      )}
    </Panel>
  );
}

/** Contact tab: the window's phone / e-mail / address / map (same icon rows as the main Contact page) and the inquiry form. */
function ContactTab() {
  const { t } = useI18n();
  const { s, loc } = useSite();
  const [mapOpen, setMapOpen] = useState(false);
  // the window's own contact details, falling back to the chamber's general ones
  const phone = s('one_stop', 'contact_phone') || s('contact', 'phone'), email = s('one_stop', 'contact_email') || s('contact', 'email'), map = s('one_stop', 'contact_map_url') || s('contact', 'map_url');
  const address = loc('one_stop', 'contact_address');
  type Row = { label: string; value: string | null; icon: 'phone' | 'email' | 'address'; ltr: boolean; link?: string };
  const rows: Row[] = [
    { label: t('site.phone'), value: phone ? String(phone) : null, icon: 'phone', ltr: true, link: phone ? telHref(String(phone)) : undefined },
    { label: t('site.email'), value: email ? String(email) : null, icon: 'email', ltr: true, link: email ? `mailto:${String(email)}` : undefined },
    { label: t('os.address'), value: address || null, icon: 'address', ltr: false },
  ];
  return (
    <Panel title={t('os.contact')}>
      <div className="grid items-start gap-5 md:grid-cols-[1fr,1.2fr]">
        <div>
          <ul className="divide-y divide-line">
            {rows.filter((r) => r.value).map((r) => {
              const text = r.ltr ? <bdi dir="ltr">{r.value}</bdi> : r.value;
              return (
                <li key={r.icon} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ContactIcon name={r.icon} size={16} /></span>
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500">{r.label}</div>
                    <div className="break-words text-sm font-medium">{r.link ? <a href={r.link} className="hover:text-primary hover:underline">{text}</a> : text}</div>
                  </div>
                </li>
              );
            })}
          </ul>
          {map && (
            <button type="button" onClick={() => setMapOpen(true)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 active:scale-[0.97]">
              <ContactIcon name="address" size={16} />{t('site.showMap')}
            </button>
          )}
        </div>
        <div>
          <p className="mb-3 text-sm font-bold text-secondary">{t('os.inquiryTitle')}</p>
          <ContactForm subjectPrefix={t('os.inquiryPrefix')} />
        </div>
      </div>
      {map && (
        <Modal open={mapOpen} onClose={() => setMapOpen(false)} title={t('site.map')} wide>
          <iframe src={String(map)} title={t('site.map')} loading="lazy" className="h-[60vh] w-full rounded-lg border-0" />
        </Modal>
      )}
    </Panel>
  );
}

/** E-services tab: the "coming soon" notice. */
function EservicesTab() {
  const { t } = useI18n();
  const { loc } = useSite();
  const eservices = loc('one_stop', 'eservices');
  return (
    <section className="rounded-2xl border border-dashed border-accent/70 bg-white/60 p-5 text-center">
      <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-secondary">{t('os.soon')}</span>
      <h2 className="mt-2 text-lg font-extrabold text-secondary">{t('os.eservices')}</h2>
      <p className="mx-auto mt-1 max-w-2xl text-sm leading-7 text-gray-600">{eservices || t('os.future')}</p>
    </section>
  );
}

/**
 * One-Stop window (wireframe page 8) as one page with tabs: services (opens first), opening hours, fees, FAQs, contact, e-services.
 * Each tab is its own view (`?tab=`), not a scroll to a section. People who may manage the window get a control bar on top:
 * add a service / question, edit the opening hours, and edit / delete buttons under every card (all hidden from visitors).
 */
function OneStop() {
  const { lang, t, href } = useI18n();
  const router = useRouter();
  const raw = useSearchParams().get('tab');
  const toast = useToast();
  const { can } = useAuth();
  const [items, setItems] = useState<PublicService[] | null>(null);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const topRef = useRef<HTMLDivElement>(null);
  // manager tools: the open add / edit window, the hours window, and the item waiting for the delete confirmation
  const [dialog, setDialog] = useState<{ type: 'service' | 'faq'; id?: number } | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [ask, setAsk] = useState<{ type: 'service' | 'faq'; id: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback((quiet = false) => {
    if (!quiet) setItems(null);
    api<PublicService[]>('/public/services', { params: { lang }, cache: 'no-store' }).then(setItems).catch(() => { if (!quiet) setItems([]); });
    api<Faq[]>('/public/faqs', { params: { lang, scope: 'one_stop' }, cache: 'no-store' }).then(setFaqs).catch(() => { if (!quiet) setFaqs([]); });
  }, [lang]);
  useEffect(() => { load(); }, [load]);
  // a change made in the windows below (or in another browser tab) shows up at once
  useEffect(() => onSiteChange(() => load(true)), [load]);

  const mayAddService = can('services.create'), mayEditService = can('services.update') && can('services.read'), mayDeleteService = can('services.delete');
  const mayAddFaq = can('faqs.create'), mayEditFaq = can('faqs.update') && can('faqs.read'), mayDeleteFaq = can('faqs.delete');
  const mayHours = can('settings.update') && can('settings.read');
  const maySettings = can('settings.read');

  const remove = async () => {
    if (!ask) return;
    setBusy(true);
    try {
      await api(`/admin/${ask.type === 'service' ? 'services' : 'faqs'}/${ask.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      setAsk(null);
      load(true);
    } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };

  // the FAQ tab is shown to visitors only when there are questions; managers always see it (to add the first one)
  const tabs = TABS.filter((k) => k !== 'faq' || faqs.length > 0 || mayAddFaq || mayEditFaq);
  const tab: Tab = (tabs as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'services';
  const toTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold text-secondary md:text-3xl">{t('os.title')}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">{t('os.subtitle')}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
      </header>

      {/* control buttons: only for people holding the matching permissions */}
      <PageManageBar show={mayAddService || mayAddFaq || mayHours || mayEditService || mayDeleteService || mayEditFaq || mayDeleteFaq} settingsUrl={can('services.read') ? '/admin/settings?page=services&tab=services' : undefined}>
        {mayAddService && <ManageBtn onClick={() => setDialog({ type: 'service' })}>＋ {t('svc.add')}</ManageBtn>}
        {mayAddFaq && <ManageBtn tone="ghost" onClick={() => setDialog({ type: 'faq' })}>＋ {t('faq.add')}</ManageBtn>}
        {mayHours && <ManageBtn tone="ghost" onClick={() => setHoursOpen(true)}>🕘 {t('os.mg.hours')}</ManageBtn>}
        {maySettings && <ManageBtn tone="ghost" onClick={() => router.push(href('/admin/settings?page=services&tab=settings'))}>⚙ {t('os.mg.texts')}</ManageBtn>}
      </PageManageBar>

      {dialog?.type === 'service' && <ServiceDialog key={dialog.id ?? 'new'} id={dialog.id} onClose={() => setDialog(null)} onSaved={() => load(true)} />}
      {dialog?.type === 'faq' && <FaqDialog key={dialog.id ?? 'new'} id={dialog.id} scope="one_stop" onClose={() => setDialog(null)} onSaved={() => load(true)} />}
      {hoursOpen && <Modal open onClose={() => setHoursOpen(false)} title={t('os.mg.hours')} wide><ScheduleAdmin /></Modal>}
      {ask && <ConfirmDelete busy={busy} onConfirm={remove} onClose={() => setAsk(null)} />}

      <div ref={topRef} className="scroll-mt-24">
        <nav aria-label={t('os.title')} role="tablist" className="sticky top-2 z-10 -mx-1 flex flex-wrap justify-center gap-2 rounded-2xl bg-canvas/90 p-1.5 backdrop-blur">
          {tabs.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => router.push(href(`/one-stop${k === 'services' ? '' : `?tab=${k}`}`), { scroll: false })}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-line transition ${tab === k ? 'bg-primary text-white' : 'bg-white text-secondary hover:bg-primary hover:text-white'}`}>{t(TAB_LABEL[k])}</button>
          ))}
        </nav>
      </div>

      <div role="tabpanel" className="space-y-6">
        {tab === 'services' && <ServicesTab items={items} onPageChange={toTop} tools={(x) => <ItemActions onEdit={mayEditService ? () => setDialog({ type: 'service', id: x.id }) : undefined} onDelete={mayDeleteService ? () => setAsk({ type: 'service', id: x.id }) : undefined} />} />}
        {tab === 'hours' && <HoursPanel />}
        {tab === 'fees' && <FeesTab items={items} onPageChange={toTop} />}
        {tab === 'faq' && <FaqTab faqs={faqs} onPageChange={toTop} tools={(f) => <ItemActions onEdit={mayEditFaq ? () => setDialog({ type: 'faq', id: f.id }) : undefined} onDelete={mayDeleteFaq ? () => setAsk({ type: 'faq', id: f.id }) : undefined} />} />}
        {tab === 'contact' && <ContactTab />}
        {tab === 'eservices' && <EservicesTab />}
      </div>
    </div>
  );
}

export default function OneStopPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><OneStop /></Suspense>;
}
