'use client';
import { useCrumbTitle } from '@/components/site/breadcrumbs';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Modal, Spinner } from '@/components/ui/ui';
import { ContactForm } from '@/components/site/contact-form';
import { NotFoundContent } from '@/components/site/not-found-content';
import { PublicService } from '@/components/site/services-shared';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-6"><h2 className="mb-2 text-lg font-extrabold text-secondary">{title}</h2>{children}</section>;
}

/** One service: /services/view?id=5 */
function View() {
  const { lang, t, href } = useI18n();
  const id = useSearchParams().get('id');
  const [d, setD] = useState<PublicService | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');
  useCrumbTitle(d?.name);
  const [inquiry, setInquiry] = useState(false);

  useEffect(() => {
    if (!id) { setState('404'); return; }
    setState('load');
    api<PublicService>(`/public/services/${encodeURIComponent(id)}`, { params: { lang }, cache: 'no-store' }).then((r) => { setD(r); setState('ok'); }).catch(() => setState('404'));
  }, [id, lang]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !d) return <NotFoundContent lang={lang} />;

  const facts: [string, string][] = ([
    [t('svc.department'), d.department], [t('svc.duration'), d.duration], [t('svc.fee'), d.fee], [t('svc.location'), d.location], [t('svc.audience'), d.audience],
  ] as [string, string][]).filter(([, v]) => v);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href={href('/one-stop')} className="mb-4 inline-block text-sm text-primary hover:underline">{t('svc.back')}</Link>
      <article className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line">
        {d.imageUrl && <img src={fileUrl(d.imageUrl)} alt="" className="h-56 w-full object-cover" />}
        <div className="p-6 md:p-10">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{t(`svc.kind.${d.kind}`)}</span>
          <h1 className="mt-4 text-2xl font-extrabold leading-snug text-secondary md:text-3xl">{d.name}</h1>
          {d.description && <p className="mt-3 whitespace-pre-line leading-8 text-gray-700">{d.description}</p>}
          {facts.length > 0 && (
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {facts.map(([k, v]) => <div key={k} className="rounded-xl bg-gray-50 px-4 py-3"><dt className="text-xs font-semibold text-gray-500">{k}</dt><dd className="mt-0.5 text-sm font-bold text-secondary">{v}</dd></div>)}
            </dl>
          )}
          {d.documents.length > 0 && <Block title={t('svc.documents')}><ul className="list-disc space-y-1 ps-5 text-sm leading-7 text-gray-700">{d.documents.map((x, i) => <li key={i}>{x}</li>)}</ul></Block>}
          {d.steps.length > 0 && <Block title={t('svc.steps')}><ol className="list-decimal space-y-1 ps-5 text-sm leading-7 text-gray-700">{d.steps.map((x, i) => <li key={i}>{x}</li>)}</ol></Block>}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => setInquiry(true)}>{t('os.inquiry')}</Button>
            {d.formUrl && (d.formIsFile || /^https?:/i.test(d.formUrl)
              ? <a href={fileUrl(d.formUrl)} {...(d.formIsFile ? { download: true } : {})} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">{d.formIsFile ? '\u2b07 ' : '\u2197 '}{t(d.formIsFile ? 'svc.formDownload' : 'svc.form')}</a>
              : <Link href={href(d.formUrl)} className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">{'\u2197 '}{t('svc.form')}</Link>)}
            <button type="button" disabled title={t('os.soon')} className="cursor-not-allowed rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-500">{t('os.applyOnlineSoon')}</button>
          </div>
          <p className="mt-4 rounded-xl border border-dashed border-accent/70 px-4 py-2 text-center text-xs text-gray-600">{t('os.future')}</p>
        </div>
      </article>
      <Modal open={inquiry} onClose={() => setInquiry(false)} title={t('os.inquiryTitle')}>
        <ContactForm subjectPrefix={`${t('os.inquiryPrefix')}${d.name} - `} />
      </Modal>
    </div>
  );
}

export default function ServiceViewPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><View /></Suspense>;
}
