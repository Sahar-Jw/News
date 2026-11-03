'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

interface Page { isOpen: boolean; conditions: string; documents: string; fees: string; steps: string[] }
interface Faq { id: number; question: string; answer: string }

const MAX_FILES = 6;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMPTY = { companyName: '', activity: '', managerName: '', phone: '', email: '', address: '', message: '' };

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

  useEffect(() => {
    api<Page>('/public/membership', { params: { lang }, cache: 'no-store' }).then(setPage).catch(() => setPage({ isOpen: true, conditions: '', documents: '', fees: '', steps: [] }));
    api<Faq[]>('/public/faqs', { params: { lang, scope: 'membership' }, cache: 'no-store' }).then(setFaqs).catch(() => setFaqs([]));
  }, [lang]);

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

      <div className="grid gap-5 md:grid-cols-3">
        <Card title={t('mb.conditions')} html={page?.conditions ?? ''} empty={empty} />
        <Card title={t('mb.documents')} html={page?.documents ?? ''} empty={empty} />
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
        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
          <h2 className="mb-3 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{t('mb.online')}</h2>
          <p className="text-sm leading-7 text-gray-600">{t('mb.onlineFields')}</p>
          {page?.isOpen === false ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-700">{t('mb.closed')}</p>
            : <button type="button" onClick={() => setForm(true)} className="mt-4 rounded-full bg-accent px-6 py-2.5 font-bold text-white shadow-card transition hover:-translate-y-px hover:shadow-lift">{t('mb.start')}</button>}
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
          <h2 className="mb-3 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{t('mb.faq')}</h2>
          {faqs.length === 0 ? <p className="text-sm text-gray-500">{empty}</p> : (
            <ul className="space-y-2">
              {faqs.map((q) => (
                <li key={q.id} className="rounded-xl border border-line">
                  <button type="button" aria-expanded={openFaq === q.id} onClick={() => setOpenFaq(openFaq === q.id ? null : q.id)} className="flex w-full items-center justify-between gap-3 p-3 text-start font-semibold text-secondary"><span>{q.question}</span><span aria-hidden="true">{openFaq === q.id ? '▾' : '▸'}</span></button>
                  {openFaq === q.id && <div className="prose-news border-t border-line p-3" dangerouslySetInnerHTML={{ __html: q.answer }} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-sm text-gray-500">{t('mb.future')}</p>

      <Modal open={form} onClose={close} title={t('mb.online')} wide>
        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-lg font-bold text-secondary">{t('mb.received')}</p>
            <p>{t('mb.reference')}: <b dir="ltr" className="text-primary">{done}</b></p>
            <p className="text-sm text-gray-600">{t('mb.receivedHint')}</p>
            <Button type="button" onClick={close}>{t('mb.close')}</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('mb.company')}><input required minLength={2} maxLength={255} className={inputCls} value={v.companyName} onChange={(e) => setV({ ...v, companyName: e.target.value })} /></Field>
              <Field label={t('mb.activity')}><input required minLength={2} maxLength={255} className={inputCls} value={v.activity} onChange={(e) => setV({ ...v, activity: e.target.value })} /></Field>
              <Field label={t('mb.manager')}><input required minLength={2} maxLength={150} className={inputCls} value={v.managerName} onChange={(e) => setV({ ...v, managerName: e.target.value })} /></Field>
              <Field label={t('mb.phone')}><input required minLength={5} maxLength={50} dir="ltr" className={inputCls} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
              <Field label={t('contact.email')}><input required type="email" maxLength={190} dir="ltr" className={inputCls} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
              <Field label={t('mb.address')}><input maxLength={500} className={inputCls} value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
            </div>
            <Field label={t('mb.message')}><textarea rows={3} maxLength={3000} className={inputCls} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} /></Field>
            <Field label={t('mb.upload')} hint={t('mb.uploadHint')}>
              <input ref={picker} type="file" multiple accept={ACCEPT} className={inputCls} onChange={(e) => addFiles(e.target.files)} />
            </Field>
            {files.length > 0 && (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => <li key={i} className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-1.5"><span className="truncate">{f.name}</span><button type="button" aria-label={t('app.delete')} className="text-red-600" onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button></li>)}
              </ul>
            )}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{t('app.cancel')}</Button><Button disabled={busy}>{t('mb.submit')}</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
