'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { Card, NewsCard, Thumb } from '@/components/site/cards';

interface Space { id: number; kind: string; name: string; description: string; capacity: number | null; areaSqm: number | null; price: string; isAvailable: boolean; imageUrl: string | null }
interface Pack { id: number; name: string; features: string[]; price: string }
interface Page { isOpen: boolean; about: string; services: string; newsTopic: string; packages: Pack[]; spaces: Space[] }
interface Paged<T> { data: T[]; meta: { totalPages: number; total: number } }
type Kind = 'booking' | 'inquiry';
type V = { name: string; company: string; email: string; phone: string; spaceId: string; packageId: string; spaceKind: string; startDate: string; durationValue: string; durationUnit: string; people: string; extraServices: string; message: string };
type Errors = Partial<Record<keyof V, string>>;

const EMPTY: V = { name: '', company: '', email: '', phone: '', spaceId: '', packageId: '', spaceKind: '', startDate: '', durationValue: '', durationUnit: 'month', people: '', extraServices: '', message: '' };
const KINDS = ['office', 'coworking', 'meeting_room', 'other'];
const UNITS = ['day', 'week', 'month', 'year'];
const SECTIONS = [['about', 'gt.about'], ['services', 'gt.services'], ['packages', 'gt.packages'], ['spaces', 'gt.spaces'], ['news', 'gt.news']] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+0-9()\-\s]{6,30}$/;
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the visitor's timezone

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
    <h2 className="mb-3 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{title}</h2>
    {children}
  </section>
);

/** Get2Trade (flexible offices): about, services, packages, spaces with photos, company news and the booking / inquiry form. */
export default function Get2TradePage() {
  const { lang, t, href } = useI18n();
  const [page, setPage] = useState<Page | null>(null);
  const [news, setNews] = useState<Paged<Card> | null>(null);
  const [form, setForm] = useState<{ kind: Kind; spaceId?: number } | null>(null);
  const [v, setV] = useState<V>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setPage(null);
    api<Page>('/public/get2trade', { params: { lang }, cache: 'no-store' }).then(setPage).catch(() => setPage({ isOpen: true, about: '', services: '', newsTopic: '', packages: [], spaces: [] }));
  }, [lang]);

  useEffect(() => {
    if (!page?.newsTopic) { setNews(page ? { data: [], meta: { totalPages: 1, total: 0 } } : null); return; }
    api<Paged<Card>>('/public/news', { params: { lang, topics: page.newsTopic, limit: 3 } }).then(setNews).catch(() => setNews({ data: [], meta: { totalPages: 1, total: 0 } }));
  }, [page, lang]);

  const openForm = (kind: Kind, spaceId?: number) => { setV({ ...EMPTY, spaceId: spaceId ? String(spaceId) : '' }); setErrors({}); setServerError(''); setDone(null); setForm({ kind, spaceId }); };
  const close = () => { setForm(null); setDone(null); };
  const set = (k: keyof V, val: string) => { setV((p) => ({ ...p, [k]: val })); setErrors((p) => ({ ...p, [k]: undefined })); setServerError(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const err: Errors = {};
    if (v.name.trim().length < 2) err.name = t('gt.nameRequired');
    else if (form.kind === 'booking' && v.name.trim().split(/\s+/).length < 3) err.name = t('gt.nameThree');
    if (!EMAIL_RE.test(v.email.trim())) err.email = t('gt.emailInvalid');
    if (!PHONE_RE.test(v.phone.trim())) err.phone = t('gt.phoneInvalid');
    if (v.startDate && v.startDate < today()) err.startDate = t('gt.dateInvalid');
    if (v.people.trim() && !(/^\d+$/.test(v.people.trim()) && Number(v.people) >= 1 && Number(v.people) <= 500)) err.people = t('gt.peopleInvalid');
    if (v.durationValue.trim() && !(/^\d+$/.test(v.durationValue.trim()) && Number(v.durationValue) >= 1 && Number(v.durationValue) <= 120)) err.durationValue = t('gt.durationInvalid');
    if (form.kind === 'inquiry' && v.message.trim().length < 5) err.message = t('gt.messageRequired');
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    setServerError('');
    try {
      const r = await api<{ reference: string }>('/public/get2trade/bookings', {
        method: 'POST',
        body: { kind: form.kind, name: v.name.trim(), company: v.company.trim(), email: v.email.trim(), phone: v.phone.trim(), spaceId: v.spaceId, packageId: v.packageId, spaceKind: v.spaceId ? '' : v.spaceKind, startDate: v.startDate, durationValue: v.durationValue.trim(), durationUnit: v.durationValue.trim() ? v.durationUnit : '', people: v.people.trim(), extraServices: v.extraServices.trim(), message: v.message.trim() },
      });
      setDone(r.reference);
    } catch (e2: any) { setServerError(e2.message); }
    finally { setBusy(false); }
  };

  if (!page) return <Center><Spinner /></Center>;
  const html = (h: string) => (h ? <div className="prose-news" dangerouslySetInnerHTML={{ __html: h }} /> : <p className="text-sm text-gray-500">{t('gt.soon')}</p>);
  const cls = (bad?: string) => `${inputCls} ${bad ? 'border-red-500' : ''}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <nav aria-label="breadcrumb" className="text-sm text-gray-500"><Link href={href('/')} className="hover:text-primary">{t('site.home')}</Link><span className="mx-1.5">›</span><span className="text-ink">{t('gt.title')}</span></nav>

      <header className="rounded-3xl bg-gradient-to-l from-secondary to-primary p-6 text-white shadow-lift md:p-10">
        <h1 className="text-2xl font-extrabold md:text-3xl">{t('gt.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-white/85">{t('gt.subtitle')}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {page.isOpen && <button type="button" onClick={() => openForm('booking')} className="rounded-full bg-accent px-6 py-2.5 font-bold text-white shadow-card transition hover:-translate-y-px hover:shadow-lift">{t('gt.bookNow')}</button>}
          <button type="button" onClick={() => openForm('inquiry')} className="rounded-full border border-white/70 px-6 py-2.5 font-semibold text-white transition hover:bg-white/10">{t('gt.inquire')}</button>
        </div>
        {!page.isOpen && <p role="status" className="mt-4 inline-block rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">{t('gt.closed')}</p>}
      </header>

      <nav aria-label={t('gt.title')} className="sticky top-0 z-10 -mx-1 flex gap-2 overflow-x-auto rounded-full bg-white/90 px-2 py-1.5 shadow-card ring-1 ring-line backdrop-blur">
        {SECTIONS.map(([id, key]) => <a key={id} href={`#${id}`} className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold text-secondary transition hover:bg-primary/10 hover:text-primary">{t(key)}</a>)}
      </nav>

      <div className="grid gap-5 md:grid-cols-2">
        <Section id="about" title={t('gt.about')}>{html(page.about)}</Section>
        <Section id="services" title={t('gt.services')}>{page.services ? html(page.services) : <ul className="list-disc space-y-1 ps-5 text-sm leading-7 text-gray-700">{['flexible', 'coworking', 'office', 'meeting', 'business'].map((k) => <li key={k}>{t(`gt.svc.${k}`)}</li>)}</ul>}</Section>
      </div>

      <Section id="packages" title={t('gt.packages')}>
        {page.packages.length === 0 ? <p className="text-sm text-gray-500">{t('gt.noPackages')}</p> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {page.packages.map((p) => (
              <article key={p.id} className="flex flex-col rounded-2xl border border-line p-5">
                <h3 className="text-lg font-extrabold text-secondary">{p.name}</h3>
                <p className={`mt-1 text-sm font-bold ${p.price ? 'text-primary' : 'text-gray-400'}`}>{p.price || t('gt.priceSoon')}</p>
                {p.features.length > 0 && <ul className="mt-3 flex-1 list-disc space-y-1 ps-5 text-sm leading-7 text-gray-700">{p.features.map((f, i) => <li key={i}>{f}</li>)}</ul>}
                <Button type="button" variant="outline" className="mt-4" onClick={() => { openForm(page.isOpen ? 'booking' : 'inquiry'); setV((x) => ({ ...x, packageId: String(p.id) })); }}>{t(page.isOpen ? 'gt.book' : 'gt.inquire')}</Button>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section id="spaces" title={t('gt.spaces')}>
        {page.spaces.length === 0 ? <p className="text-sm text-gray-500">{t('gt.noSpaces')}</p> : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {page.spaces.map((s) => (
              <article key={s.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
                <Thumb src={s.imageUrl} alt={s.name} className="h-40 w-full" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{t(`gt.kind.${s.kind}`)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{t(s.isAvailable ? 'gt.available' : 'gt.unavailable')}</span>
                  </div>
                  <h3 className="mt-2 font-extrabold text-secondary">{s.name}</h3>
                  {s.description && <p className="mt-1 whitespace-pre-line text-sm leading-7 text-gray-600">{s.description}</p>}
                  <p className="mt-2 text-xs text-gray-500">{[s.capacity ? `${t('gt.capacity')}: ${s.capacity} ${t('gt.people')}` : '', s.areaSqm ? `${t('gt.area')}: ${s.areaSqm} ${t('gt.sqm')}` : ''].filter(Boolean).join(' · ')}</p>
                  <p className={`mt-1 text-sm font-bold ${s.price ? 'text-primary' : 'text-gray-400'}`}>{s.price || t('gt.priceSoon')}</p>
                  <div className="mt-auto pt-4">
                    {s.isAvailable && page.isOpen ? <Button type="button" onClick={() => openForm('booking', s.id)}>{t('gt.book')}</Button> : <Button type="button" variant="outline" onClick={() => openForm('inquiry', s.id)}>{t('gt.inquire')}</Button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section id="news" title={t('gt.news')}>
        {!news ? <Center><Spinner /></Center> : news.data.length === 0 ? <p className="text-sm text-gray-500">{t('gt.noNews')}</p> : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{news.data.map((n) => <NewsCard key={n.id} n={n} />)}</div>
            <div className="mt-4 text-center"><Link href={href(`/media?topics=${encodeURIComponent(page.newsTopic)}`)} className="text-sm font-semibold text-primary hover:underline">{t('gt.allNews')}</Link></div>
          </>
        )}
      </Section>

      <Modal open={!!form} onClose={close} title={form?.kind === 'booking' ? t('gt.formBook') : t('gt.formInquiry')} wide>
        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-lg font-bold text-secondary">{t('gt.received')}</p>
            <p>{t('gt.reference')}: <b dir="ltr" className="text-primary">{done}</b></p>
            <p className="text-sm text-gray-600">{t('gt.receivedHint')}</p>
            <Button type="button" onClick={close}>{t('gt.close')}</Button>
          </div>
        ) : form && (
          <form onSubmit={submit} noValidate className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('gt.name')} error={errors.name}><input className={cls(errors.name)} maxLength={150} autoComplete="name" aria-invalid={!!errors.name} value={v.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label={t('gt.company')}><input className={inputCls} maxLength={150} autoComplete="organization" value={v.company} onChange={(e) => set('company', e.target.value)} /></Field>
              <Field label={t('contact.email')} error={errors.email}><input type="email" dir="ltr" className={cls(errors.email)} maxLength={190} autoComplete="email" aria-invalid={!!errors.email} value={v.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label={t('site.phone')} error={errors.phone}><input type="tel" dir="ltr" className={cls(errors.phone)} maxLength={30} autoComplete="tel" aria-invalid={!!errors.phone} value={v.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label={t('gt.space')}><select className={inputCls} value={v.spaceId} onChange={(e) => set('spaceId', e.target.value)}><option value="">{t('gt.noneChosen')}</option>{page.spaces.filter((s) => form.kind === 'inquiry' || s.isAvailable).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              {!v.spaceId && <Field label={t('gt.spaceKind')}><select className={inputCls} value={v.spaceKind} onChange={(e) => set('spaceKind', e.target.value)}><option value="">{t('gt.noneChosen')}</option>{KINDS.map((k) => <option key={k} value={k}>{t(`gt.kind.${k}`)}</option>)}</select></Field>}
              <Field label={t('gt.package')}><select className={inputCls} value={v.packageId} onChange={(e) => set('packageId', e.target.value)}><option value="">{t('gt.noneChosen')}</option>{page.packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              {form.kind === 'booking' && <Field label={t('gt.startDate')} error={errors.startDate}><input type="date" dir="ltr" min={today()} className={cls(errors.startDate)} aria-invalid={!!errors.startDate} value={v.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>}
              {form.kind === 'booking' && (
                <Field label={t('gt.duration')} error={errors.durationValue}>
                  <div className="flex gap-2">
                    <input inputMode="numeric" dir="ltr" className={`${cls(errors.durationValue)} w-24`} aria-invalid={!!errors.durationValue} value={v.durationValue} onChange={(e) => set('durationValue', e.target.value)} />
                    <select className={inputCls} aria-label={t('gt.duration')} value={v.durationUnit} onChange={(e) => set('durationUnit', e.target.value)}>{UNITS.map((u) => <option key={u} value={u}>{t(`gt.unit.${u}`)}</option>)}</select>
                  </div>
                </Field>
              )}
              <Field label={t('gt.peopleCount')} error={errors.people}><input inputMode="numeric" dir="ltr" className={cls(errors.people)} aria-invalid={!!errors.people} value={v.people} onChange={(e) => set('people', e.target.value)} /></Field>
            </div>
            {form.kind === 'booking' && <Field label={t('gt.extraServices')}><textarea rows={2} maxLength={1000} className={inputCls} value={v.extraServices} onChange={(e) => set('extraServices', e.target.value)} /></Field>}
            <Field label={t(form.kind === 'inquiry' ? 'gt.inquiryText' : 'gt.message')} error={errors.message}><textarea rows={4} maxLength={3000} className={cls(errors.message)} aria-invalid={!!errors.message} value={v.message} onChange={(e) => set('message', e.target.value)} /></Field>
            {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{t('app.cancel')}</Button><Button disabled={busy}>{t('gt.send')}</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
