'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Spinner, inputCls } from '@/components/ui/ui';
import { Thumb } from '@/components/site/cards';
import { ContactForm } from '@/components/site/contact-form';
import { useSite } from '@/components/site/site-context';
import { PublicService } from '@/components/site/services-shared';
import { dayInfo, dayName, fmtDay, fmtTime, readSchedule, ymd } from '@/lib/one-stop-schedule';

interface Faq { id: number; question: string; answer: string }

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the visitor's timezone

function Panel({ title, children, className = '', id }: { title: string; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-2xl bg-white p-5 shadow-card ring-1 ring-line scroll-mt-28 ${className}`}>
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
    <Panel id="hours" title={t('os.hours')}>
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

/** One-Stop window (wireframe page 8): services with search/filters, opening hours + temporary notice, fees table, contact + inquiry form, FAQs. */
export default function OneStopPage() {
  const { lang, t, href } = useI18n();
  const { s, loc } = useSite();
  const [items, setItems] = useState<PublicService[] | null>(null);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [dept, setDept] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setItems(null);
    api<PublicService[]>('/public/services', { params: { lang }, cache: 'no-store' }).then(setItems).catch(() => setItems([]));
    api<Faq[]>('/public/faqs', { params: { lang, scope: 'one_stop' }, cache: 'no-store' }).then(setFaqs).catch(() => setFaqs([]));
  }, [lang]);

  const kinds = useMemo(() => [...new Set((items ?? []).map((x) => x.kind))], [items]);
  const depts = useMemo(() => [...new Set((items ?? []).map((x) => x.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, lang)), [items, lang]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((x) => (!kind || x.kind === kind) && (!dept || x.department === dept) && (!needle || `${x.name} ${x.description}`.toLowerCase().includes(needle)));
  }, [items, q, kind, dept]);
  const filtered = !!(q.trim() || kind || dept);

  // the window's own contact details, falling back to the chamber's general ones
  const phone = s('one_stop', 'contact_phone') || s('contact', 'phone'), email = s('one_stop', 'contact_email') || s('contact', 'email'), map = s('one_stop', 'contact_map_url') || s('contact', 'map_url');
  const address = loc('one_stop', 'contact_address');
  const feesNote = loc('one_stop', 'fees_note');
  const eservices = loc('one_stop', 'eservices');
  const kindCount = (k: string) => (items ?? []).filter((x) => x.kind === k).length;
  const sections = [['services', 'os.nav.services'], ['hours', 'os.nav.hours'], ['fees', 'os.nav.fees'], ['faq', 'os.nav.faq'], ['contact', 'os.nav.contact'], ['eservices', 'os.nav.eservices']].filter(([id]) => id !== 'faq' || faqs.length > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold text-secondary md:text-3xl">{t('os.title')}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">{t('os.subtitle')}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
      </header>

      <nav aria-label={t('os.title')} className="sticky top-2 z-10 -mx-1 flex flex-wrap justify-center gap-2 rounded-2xl bg-canvas/90 p-1.5 backdrop-blur">
        {sections.map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-secondary shadow-sm ring-1 ring-line transition hover:bg-primary hover:text-white">{t(label)}</a>)}
      </nav>

      {/* 1. services: search + type chips + filters */}
      <div id="services" className="scroll-mt-28 flex flex-col gap-3 md:flex-row">
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

      {/* service cards */}
      {!items ? <Center><Spinner /></Center> : items.length === 0 ? <Center>{t('os.noServices')}</Center> : shown.length === 0 ? <Center>{t('os.empty')}</Center> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((x) => (
            <Link key={x.id} href={href(`/services/view?id=${x.id}`)} className="group overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent">
              <Thumb src={x.imageUrl} alt="" className="h-36 w-full" />
              <div className="p-4">
                <h3 className="font-extrabold text-secondary group-hover:text-primary">{x.name}</h3>
                <span className="mt-1 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{t(`svc.kind.${x.kind}`)}</span>
                {x.description && <p className="mt-2 line-clamp-2 text-xs leading-6 text-gray-600">{x.description}</p>}
                <p className="mt-2 text-xs leading-6 text-gray-500">{[x.department, x.duration, x.fee].filter(Boolean).join(' · ')}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 2. opening hours */}
      <HoursPanel />

      {/* 3. fees */}
      <Panel id="fees" title={t('os.feesTitle')}>
        {shown.length === 0 ? <p className="text-sm text-gray-500">{t('os.empty')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-start text-sm">
              <thead><tr className="bg-primary/5 text-xs text-gray-600"><th className="px-3 py-2 text-start font-semibold">{t('os.feeService')}</th><th className="px-3 py-2 text-start font-semibold">{t('os.typeCount')}</th><th className="px-3 py-2 text-start font-semibold">{t('os.colDepartment')}</th><th className="px-3 py-2 text-start font-semibold">{t('os.colDuration')}</th><th className="px-3 py-2 text-start font-semibold">{t('os.feeAmount')}</th></tr></thead>
              <tbody>
                {shown.map((x) => (
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
        )}
        {feesNote && <p className="mt-3 text-xs leading-6 text-gray-500">{feesNote}</p>}
      </Panel>

      {/* FAQs */}
      {faqs.length > 0 && (
        <Panel id="faq" title={t('os.faq')}>
          <div className="space-y-2">
            {faqs.map((f) => {
              const on = openFaq === f.id;
              return (
                <div key={f.id} className="overflow-hidden rounded-xl ring-1 ring-line">
                  <button type="button" aria-expanded={on} onClick={() => setOpenFaq(on ? null : f.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start font-bold text-secondary">
                    <span>{f.question}</span><span className={`shrink-0 text-accent transition-transform ${on ? 'rotate-45' : ''}`} aria-hidden="true">＋</span>
                  </button>
                  {on && <div className="whitespace-pre-line border-t border-line px-4 py-3 text-sm leading-7 text-gray-700">{f.answer}</div>}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* 5. contact */}
      <Panel id="contact" title={t('os.contact')}>
        <div className="grid gap-5 md:grid-cols-[1fr,1.2fr]">
          <ul className="space-y-2 text-sm text-gray-700">
            {phone && <li className="flex items-center gap-2"><span aria-hidden="true">📞</span>{t('site.phone')}: <a href={`tel:${String(phone).replace(/[^\d+]/g, '')}`}><bdi dir="ltr">{String(phone)}</bdi></a></li>}
            {email && <li className="flex items-center gap-2"><span aria-hidden="true">✉️</span>{t('contact.email')}: <a href={`mailto:${String(email)}`}><bdi dir="ltr">{String(email)}</bdi></a></li>}
            {address && <li className="flex items-center gap-2"><span aria-hidden="true">📍</span>{t('os.address')}: {address}</li>}
            {map && <li><a href={String(map)} target="_blank" rel="noopener noreferrer" className="text-primary underline">{t('site.map')}</a></li>}
          </ul>
          <div>
            <p className="mb-3 text-sm font-bold text-secondary">{t('os.inquiryTitle')}</p>
            <ContactForm subjectPrefix={t('os.inquiryPrefix')} />
          </div>
        </div>
      </Panel>

      {/* 6. electronic services (coming) */}
      <section id="eservices" className="scroll-mt-28 rounded-2xl border border-dashed border-accent/70 bg-white/60 p-5 text-center">
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-bold text-secondary">{t('os.soon')}</span>
        <h2 className="mt-2 text-lg font-extrabold text-secondary">{t('os.eservices')}</h2>
        <p className="mx-auto mt-1 max-w-2xl text-sm leading-7 text-gray-600">{eservices || t('os.future')}</p>
      </section>

    </div>
  );
}
