'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { Thumb } from '@/components/site/cards';
import { ContactForm } from '@/components/site/contact-form';
import { useSite } from '@/components/site/site-context';
import { PublicService } from '@/components/site/services-shared';

interface Faq { id: number; question: string; answer: string }

const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the visitor's timezone

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-card ring-1 ring-line ${className}`}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-secondary"><span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />{title}</h2>
      {children}
    </section>
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
  const [inquiry, setInquiry] = useState(false);

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

  // opening hours + notice (the notice shows only inside its date range; with no dates it always shows)
  const hours = loc('one_stop', 'hours'), days = loc('one_stop', 'days'), notice = loc('one_stop', 'notice');
  const from = String(s('one_stop', 'notice_from') ?? ''), to = String(s('one_stop', 'notice_to') ?? '');
  const noticeOn = !!notice && (!from || today() >= from) && (!to || today() <= to);

  const phone = s('contact', 'phone'), email = s('contact', 'email'), map = s('contact', 'map_url');

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold text-secondary md:text-3xl">{t('os.title')}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">{t('os.subtitle')}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
      </header>

      {/* search + filters */}
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

      {/* service cards */}
      {!items ? <Center><Spinner /></Center> : items.length === 0 ? <Center>{t('os.noServices')}</Center> : shown.length === 0 ? <Center>{t('os.empty')}</Center> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((x) => (
            <Link key={x.id} href={href(`/services/view?id=${x.id}`)} className="group overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent">
              <Thumb src={x.imageUrl} alt="" className="h-36 w-full" />
              <div className="p-4">
                <h3 className="font-extrabold text-secondary group-hover:text-primary">{x.name}</h3>
                <p className="mt-1 text-xs leading-6 text-gray-500">{[x.department, x.duration, x.fee].filter(Boolean).join(' · ')}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* hours / fees / contact */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title={t('os.hours')}>
          {hours || days ? (
            <div className="space-y-1 text-sm leading-7 text-gray-700">
              {hours && <p>{t('os.hoursLine')}: {hours}</p>}
              {days && <p>{t('os.daysLine')}: {days}</p>}
            </div>
          ) : <p className="text-sm text-gray-500">{t('os.hoursEmpty')}</p>}
          {noticeOn && <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">{notice}</p>}
        </Panel>

        <Panel title={t('os.fees')}>
          {shown.length === 0 ? <p className="text-sm text-gray-500">{t('os.empty')}</p> : (
            <div className="max-h-60 overflow-auto">
              <table className="w-full text-start text-sm">
                <thead><tr className="text-xs text-gray-500"><th className="pb-1 text-start font-semibold">{t('os.feeService')}</th><th className="pb-1 text-start font-semibold">{t('os.feeAmount')}</th></tr></thead>
                <tbody>
                  {shown.map((x) => (
                    <tr key={x.id} className="border-t border-line">
                      <td className="py-1.5 pe-2"><Link href={href(`/services/view?id=${x.id}`)} className="hover:text-primary">{x.name}</Link><span className="block text-[11px] text-gray-400">{t(`svc.kind.${x.kind}`)}</span></td>
                      <td className="py-1.5 align-top">{x.fee || <span className="text-gray-400">{t('os.noFee')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title={t('os.contact')}>
          <ul className="space-y-1 text-sm text-gray-700">
            {phone && <li>{t('site.phone')}: <bdi dir="ltr">{String(phone)}</bdi></li>}
            {email && <li>{t('contact.email')}: <bdi dir="ltr">{String(email)}</bdi></li>}
            {map && <li><a href={String(map)} target="_blank" rel="noopener noreferrer" className="text-primary underline">{t('site.map')}</a></li>}
          </ul>
          <Button type="button" className="mt-4" onClick={() => setInquiry(true)}>{t('os.inquiry')}</Button>
        </Panel>
      </div>

      {/* FAQs */}
      {faqs.length > 0 && (
        <Panel title={t('os.faq')}>
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

      <p className="rounded-2xl border border-dashed border-accent/70 px-4 py-3 text-center text-sm text-gray-600">{t('os.future')}</p>

      <Modal open={inquiry} onClose={() => setInquiry(false)} title={t('os.inquiryTitle')}>
        <ContactForm subjectPrefix={t('os.inquiryPrefix')} />
      </Modal>
    </div>
  );
}
