'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { ConfirmDelete, ItemActions, ManageBtn, ManageLink, PageManageBar } from '@/components/site/page-manage-bar';
import { FaqDialog } from '@/components/admin/faqs-admin';

interface Page { isOpen: boolean; conditions: string; documents: string; fees: string; steps: string[] }
interface Faq { id: number; question: string; answer: string }

const MAX_FILES = 6;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMPTY = { managerName: '', companyName: '', businessType: 'individual', businessTypeOther: '', commercialRegNo: '', registrationDate: '', activity: '', address: '', phone: '', email: '', contactPerson: '', message: '' };
const todayIso = () => new Date().toISOString().slice(0, 10);

const Card = ({ title, html, empty }: { title: string; html: string; empty: string }) => (
  <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
    <h2 className="mb-3 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{title}</h2>
    {html ? <div className="prose-news" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="text-sm text-gray-500">{empty}</p>}
  </section>
);

/** Membership (wireframe 6.15): conditions, required documents, fees, the steps, the electronic application and the FAQ. */
export default function MembershipPage() {
  const { lang, t, href } = useI18n();
  const toast = useToast();
  const [page, setPage] = useState<Page | null>(null);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState(false);
  const [v, setV] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const { can } = useAuth();
  // manager tools (hidden from visitors): the question window (id = edit, none = new) and the question waiting for the delete confirmation
  const [faqDialog, setFaqDialog] = useState<{ id?: number } | null>(null);
  const [askFaq, setAskFaq] = useState<Faq | null>(null);
  const [mgBusy, setMgBusy] = useState(false);

  const load = useCallback(() => {
    api<Page>('/public/membership', { params: { lang }, cache: 'no-store' }).then(setPage).catch(() => setPage({ isOpen: true, conditions: '', documents: '', fees: '', steps: [] }));
    api<Faq[]>('/public/faqs', { params: { lang, scope: 'membership' }, cache: 'no-store' }).then(setFaqs).catch(() => setFaqs([]));
  }, [lang]);
  useEffect(() => { load(); }, [load]);

  const mayRequests = can('membership.read');
  const mayToggle = can('membership.update') && can('membership.read');
  const mayAddFaq = can('faqs.create'), mayEditFaq = can('faqs.update') && can('faqs.read'), mayDeleteFaq = can('faqs.delete');
  const toggleOpen = async () => {
    if (!page) return;
    setMgBusy(true);
    try {
      await api('/admin/membership/settings', { method: 'PATCH', body: { isOpen: !page.isOpen } });
      toast(t(page.isOpen ? 'mg.membershipClosed' : 'mg.membershipOpened'));
      load();
    } catch (e: any) { toast(e.message, 'err'); } finally { setMgBusy(false); }
  };
  const removeFaq = async () => {
    if (!askFaq) return;
    setMgBusy(true);
    try {
      await api(`/admin/faqs/${askFaq.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      setAskFaq(null);
      load();
    } catch (e: any) { toast(e.message, 'err'); } finally { setMgBusy(false); }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > MAX_BYTES) { toast(`${f.name}: ≤ 5MB`, 'err'); continue; }
      if (next.length >= MAX_FILES) { toast(t('mb.maxFiles'), 'err'); break; }
      next.push(f);
    }
    setFiles(next);
    if (picker.current) picker.current.value = '';
  };

  const close = () => { setForm(false); setDone(null); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(v.email.trim())) return toast(t('contact.err.emailInvalid'), 'err');
    if (v.businessType === 'other' && !v.businessTypeOther.trim()) return toast(t('mb.typeOther'), 'err');
    if (files.length === 0) return toast(t('mb.needFile'), 'err');
    const fd = new FormData();
    for (const [k, val] of Object.entries(v)) fd.set(k, val.trim());
    files.forEach((f) => fd.append('files', f));
    setBusy(true);
    try {
      const r = await api<{ reference: string }>('/public/membership/apply', { method: 'POST', form: fd });
      setDone(r.reference);
      setV(EMPTY); setFiles([]);
    } catch (err: any) { toast(err.message, 'err'); }
    finally { setBusy(false); }
  };

  const empty = t('mb.soon');
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <nav aria-label="breadcrumb" className="text-sm text-gray-500"><Link href={href('/')} className="hover:text-primary">{t('site.home')}</Link><span className="mx-1.5">›</span><span className="text-ink">{t('nav.membership')}</span></nav>

      <PageManageBar show={mayRequests || mayAddFaq || mayEditFaq || mayDeleteFaq}>
        {mayRequests && <ManageLink tone="solid" to="/admin/settings?page=membership&tab=applications">📥 {t('mg.requests')}</ManageLink>}
        {mayRequests && <ManageLink to="/admin/settings?page=membership&tab=content">✎ {t('mg.pageContent')}</ManageLink>}
        {mayToggle && page && <button type="button" disabled={mgBusy} onClick={toggleOpen} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-white px-3.5 py-1.5 text-xs font-bold text-primary shadow-sm transition hover:bg-primary/10 disabled:opacity-50">{page.isOpen ? '⏸' : '▶'} {t(page.isOpen ? 'mg.closeMembership' : 'mg.openMembership')}</button>}
        {mayAddFaq && <ManageBtn tone="ghost" onClick={() => setFaqDialog({})}>＋ {t('faq.add')}</ManageBtn>}
      </PageManageBar>

      <header className="relative overflow-hidden rounded-3xl bg-secondary p-6 text-white shadow-card md:p-9">
        <div className="pointer-events-none absolute -top-24 end-[-4rem] h-64 w-64 rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl"><h1 className="text-2xl font-extrabold md:text-3xl">{t('nav.membership')}</h1><p className="mt-2 text-sm leading-7 text-white/85">{t('mb.heroText')}</p></div>
          {page?.isOpen === false ? <p className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold">{t('mb.closed')}</p>
            : <button type="button" onClick={() => setForm(true)} className="shrink-0 rounded-full bg-accent px-8 py-3 text-base font-extrabold text-secondary shadow-lift transition hover:-translate-y-px hover:brightness-110">{t('mb.apply')}</button>}
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-3">
        <Card title={t('mb.conditions')} html={page?.conditions ?? ''} empty={empty} />
        <div id="required-docs" className="scroll-mt-24"><Card title={t('mb.documents')} html={page?.documents ?? ''} empty={empty} /></div>
        <Card title={t('mb.fees')} html={page?.fees ?? ''} empty={empty} />
      </div>

      {page && page.steps.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
          <h2 className="mb-4 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{t('mb.steps')}</h2>
          <ol className="flex flex-wrap items-center gap-2">
            {page.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-secondary">{i + 1}. {s}</span>
                {i < page.steps.length - 1 && <span aria-hidden="true" className="text-accent rtl:rotate-180">▸</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
          <h2 className="mb-3 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{t('mb.online')}</h2>
          <p className="text-sm leading-7 text-gray-600">{t('mb.onlineFields')}</p>
          {page?.isOpen === false ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-700">{t('mb.closed')}</p>
            : <button type="button" onClick={() => setForm(true)} className="mt-4 rounded-full bg-accent px-6 py-2.5 font-bold text-white shadow-card transition hover:-translate-y-px hover:shadow-lift">{t('mb.start')}</button>}
        </section>
        <section aria-disabled="true" className="rounded-2xl border border-dashed border-accent/70 bg-white/60 p-5">
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{t('mb.trackSoon')}</h2><span className="rounded-full bg-accent/20 px-3 py-0.5 text-xs font-bold text-secondary">{t('mb.soonTag')}</span></div>
          <p className="mb-3 text-sm leading-7 text-gray-600">{t('mb.trackText')}</p>
          <div className="flex gap-2"><input disabled placeholder={t('mb.trackRef')} aria-label={t('mb.trackRef')} className={`${inputCls} cursor-not-allowed bg-gray-100`} /><button type="button" disabled className="cursor-not-allowed rounded-xl bg-gray-200 px-4 text-sm font-semibold text-gray-500">{t('mb.trackSoon')}</button></div>
        </section>
        </div>
        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
          <h2 className="mb-3 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{t('mb.faq')}</h2>
          {faqs.length === 0 ? <p className="text-sm text-gray-500">{empty}</p> : (
            <ul className="space-y-2">
              {faqs.map((q) => (
                <li key={q.id} className="rounded-xl border border-line">
                  <button type="button" aria-expanded={openFaq === q.id} onClick={() => setOpenFaq(openFaq === q.id ? null : q.id)} className="flex w-full items-center justify-between gap-3 p-3 text-start font-semibold text-secondary"><span>{q.question}</span><span aria-hidden="true">{openFaq === q.id ? '▾' : '▸'}</span></button>
                  {openFaq === q.id && <div className="prose-news border-t border-line p-3" dangerouslySetInnerHTML={{ __html: q.answer }} />}
                  {(mayEditFaq || mayDeleteFaq) && <div className="border-t border-line p-2"><ItemActions onEdit={mayEditFaq ? () => setFaqDialog({ id: q.id }) : undefined} onDelete={mayDeleteFaq ? () => setAskFaq(q) : undefined} /></div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-sm text-gray-500">{t('mb.future')}</p>

      {faqDialog && <FaqDialog key={faqDialog.id ?? 'new'} id={faqDialog.id} scope="membership" onClose={() => setFaqDialog(null)} onSaved={load} />}
      {askFaq && <ConfirmDelete busy={mgBusy} onConfirm={removeFaq} onClose={() => setAskFaq(null)} />}

      <Modal open={form} onClose={close} title={t('mb.online')} wide>
        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-lg font-bold text-secondary">{t('mb.received')}</p>
            <p>{t('mb.reference')}: <b dir="ltr" className="text-primary">{done}</b></p>
            <p className="text-sm text-gray-600">{t('mb.receivedHint')}</p>
            <Button type="button" onClick={close}>{t('mb.close')}</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <fieldset className="space-y-3"><legend className="mb-2 border-s-4 border-accent ps-3 text-sm font-extrabold text-secondary">{t('mb.sec.owner')}</legend>
              <Field label={t('mb.manager')} hint={t('mb.ownerHint')}><input required minLength={2} maxLength={150} autoComplete="name" className={inputCls} value={v.managerName} onChange={(e) => setV({ ...v, managerName: e.target.value })} /></Field>
            </fieldset>
            <fieldset className="space-y-3"><legend className="mb-2 border-s-4 border-accent ps-3 text-sm font-extrabold text-secondary">{t('mb.sec.business')}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('mb.company')}><input required minLength={2} maxLength={255} className={inputCls} value={v.companyName} onChange={(e) => setV({ ...v, companyName: e.target.value })} /></Field>
                <Field label={t('mb.businessType')}>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-line bg-white px-3 py-2 text-sm">
                    {['individual', 'company', 'other'].map((k) => <label key={k} className="flex items-center gap-1.5"><input type="radio" name="businessType" checked={v.businessType === k} onChange={() => setV({ ...v, businessType: k })} />{t(`mb.type.${k}`)}</label>)}
                  </div>
                </Field>
                {v.businessType === 'other' && <Field label={t('mb.typeOther')}><input required maxLength={120} className={inputCls} value={v.businessTypeOther} onChange={(e) => setV({ ...v, businessTypeOther: e.target.value })} /></Field>}
                <Field label={t('mb.regNo')}><input required maxLength={60} dir="ltr" className={inputCls} value={v.commercialRegNo} onChange={(e) => setV({ ...v, commercialRegNo: e.target.value })} /></Field>
                <Field label={t('mb.regDate')}><input required type="date" max={todayIso()} dir="ltr" className={inputCls} value={v.registrationDate} onChange={(e) => setV({ ...v, registrationDate: e.target.value })} /></Field>
                <Field label={t('mb.activity')}><input required minLength={2} maxLength={255} className={inputCls} value={v.activity} onChange={(e) => setV({ ...v, activity: e.target.value })} /></Field>
              </div>
              <Field label={t('mb.address')}><textarea required rows={2} minLength={5} maxLength={500} className={inputCls} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
            </fieldset>
            <fieldset className="space-y-3"><legend className="mb-2 border-s-4 border-accent ps-3 text-sm font-extrabold text-secondary">{t('mb.sec.contact')}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('mb.phone')}><input required minLength={5} maxLength={50} dir="ltr" autoComplete="tel" className={inputCls} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
                <Field label={t('contact.email')}><input required type="email" maxLength={190} dir="ltr" autoComplete="email" className={inputCls} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
                <Field label={`${t('mb.contactPerson')} (${t('mb.optional')})`}><input maxLength={150} className={inputCls} value={v.contactPerson} onChange={(e) => setV({ ...v, contactPerson: e.target.value })} /></Field>
              </div>
              <Field label={t('mb.message')}><textarea rows={2} maxLength={3000} className={inputCls} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} /></Field>
            </fieldset>
            <fieldset className="space-y-3"><legend className="mb-2 border-s-4 border-accent ps-3 text-sm font-extrabold text-secondary">{t('mb.sec.docs')}</legend>
              <p className="text-xs leading-6 text-gray-600">{t('mb.filesRequired')}{page?.documents && <> · <a href="#required-docs" onClick={close} className="font-semibold text-primary underline">{t('mb.seeDocs')}</a></>}</p>
              <Field label={t('mb.upload')} hint={t('mb.uploadHint')}>
                <input ref={picker} type="file" multiple accept={ACCEPT} className={inputCls} onChange={(e) => addFiles(e.target.files)} />
              </Field>
              {files.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {files.map((f, i) => <li key={i} className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-1.5"><span className="truncate">{f.name}</span><button type="button" aria-label={t('app.delete')} className="text-red-600" onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button></li>)}
                </ul>
              )}
            </fieldset>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{t('app.cancel')}</Button><Button disabled={busy}>{t('mb.submit')}</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
