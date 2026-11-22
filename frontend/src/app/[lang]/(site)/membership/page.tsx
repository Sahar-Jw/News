'use client';
import Link from 'next/link';
import { FormBySlug } from '@/components/site/dynamic-form';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Field, Modal, Spinner, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { ConfirmDelete, ItemActions, ManageBtn, ManageLink, PageManageBar } from '@/components/site/page-manage-bar';
import { Pager } from '@/components/site/pager';
import { KIND_ICON, PublicService, SERVICE_KINDS } from '@/components/site/services-shared';
import { FaqDialog } from '@/components/admin/faqs-admin';
import { ServiceDialog } from '@/components/admin/services-admin';
import { ProIcon, IconTile, InlineIcon } from '@/components/site/pro-icon';

interface Page { isOpen: boolean; conditions: string; documents: string; fees: string; steps: string[] }
interface Faq { id: number; question: string; answer: string }

const PER_PAGE = 6;
/** services that start the online membership application */
const APPLY_KINDS = ['membership', 'renewal'];

const Card = ({ title, html, empty }: { title: string; html: string; empty: string }) => (
  <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
    <h2 className="mb-3 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{title}</h2>
    {html ? <div className="prose-news" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="text-sm text-gray-500">{empty}</p>}
  </section>
);

/** the link to the department in charge: a full link opens in a new tab, a path stays inside the site */
function DeptLink({ s }: { s: PublicService }) {
  const { t, href } = useI18n();
  if (!s.department) return null;
  const cls = 'font-bold text-primary underline-offset-2 hover:underline';
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-primary/5 px-3 py-2 text-xs text-gray-700">
      <ProIcon name="landmark" size={16} /><span>{t('sv.dept')}:</span>
      {!s.departmentUrl ? <b className="text-secondary">{s.department}</b>
        : /^https?:/i.test(s.departmentUrl) ? <a href={s.departmentUrl} target="_blank" rel="noopener noreferrer" className={cls}>{s.department} ↗</a>
        : <Link href={href(s.departmentUrl)} className={cls}>{s.department}</Link>}
    </p>
  );
}

/** One service, fully explained: what it is, who it is for, the department in charge, then (details) documents, steps, fees, duration and place. */
function ServiceCard({ s, onApply, applyOpen, actions }: { s: PublicService; onApply: () => void; applyOpen: boolean; actions?: React.ReactNode }) {
  const { t, href } = useI18n();
  const [more, setMore] = useState(false);
  const apply = APPLY_KINDS.includes(s.kind);
  const hasMore = !!(s.audience || s.documents.length || s.steps.length || s.location);
  return (
    <article className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-line transition hover:ring-accent">
      <div className="flex items-start gap-3">
        <IconTile name={KIND_ICON[s.kind] ?? 'pin2'} className="h-12 w-12" />
        <div className="min-w-0">
          <span className="rounded-full bg-accent/25 px-2.5 py-0.5 text-[10px] font-bold text-secondary">{t(`svc.kind.${s.kind}`)}</span>
          <h2 className="mt-1 text-lg font-extrabold leading-snug text-secondary">{s.name}</h2>
        </div>
      </div>
      {s.description && <p className={`mt-3 whitespace-pre-line text-sm leading-7 text-gray-700 ${more ? '' : 'line-clamp-3'}`}>{s.description}</p>}
      <DeptLink s={s} />
      {(s.fee || s.duration) && (
        <dl className="mt-3 flex flex-wrap gap-2 text-xs">
          {s.fee && <div className="rounded-full bg-gray-100 px-3 py-1"><dt className="inline text-gray-500">{t('svc.fee')}: </dt><dd className="inline font-bold text-secondary">{s.fee}</dd></div>}
          {s.duration && <div className="rounded-full bg-gray-100 px-3 py-1"><dt className="inline text-gray-500">{t('svc.duration')}: </dt><dd className="inline font-bold text-secondary">{s.duration}</dd></div>}
        </dl>
      )}
      {more && (
        <div className="mt-4 space-y-4 border-t border-line pt-4 text-sm">
          {s.audience && <div><h3 className="mb-1 font-bold text-secondary">{t('svc.audience')}</h3><p className="leading-7 text-gray-700">{s.audience}</p></div>}
          {s.documents.length > 0 && <div><h3 className="mb-1 font-bold text-secondary">{t('svc.documents')}</h3><ul className="list-disc space-y-1 ps-5 leading-7 text-gray-700">{s.documents.map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
          {s.steps.length > 0 && <div><h3 className="mb-1 font-bold text-secondary">{t('svc.steps')}</h3><ol className="list-decimal space-y-1 ps-5 leading-7 text-gray-700">{s.steps.map((d, i) => <li key={i}>{d}</li>)}</ol></div>}
          {s.location && <div><h3 className="mb-1 font-bold text-secondary">{t('svc.location')}</h3><p className="text-gray-700">{s.location}</p></div>}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {apply && applyOpen && <button type="button" onClick={onApply} className="rounded-full bg-accent px-5 py-2 text-sm font-extrabold text-white shadow-card transition hover:shadow-lift">{t('sv.apply')}</button>}
        {!apply && s.formUrl && (() => {
          const cls = 'rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition hover:brightness-110';
          const label = s.kind === 'eservices' && !s.formIsFile ? t('sv.open') : t('svc.form');
          // a page of this site opens in the same tab; a file or another website opens in a new one
          return s.formIsFile || /^https?:/i.test(s.formUrl)
            ? <a href={s.formUrl} target="_blank" rel="noopener noreferrer" className={cls}>{label}</a>
            : <Link href={href(s.formUrl)} className={cls}>{label}</Link>;
        })()}
        {hasMore && <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-primary hover:bg-gray-50">{more ? t('sv.less') : t('sv.details')}</button>}
      </div>
      {actions}
    </article>
  );
}

/**
 * Services (the old Membership page): the chamber's services — membership, renewal, consultations, commercial sector, certificates / forms / requests,
 * attestation, e-services, certificates of origin — each explained and tied to the department in charge, with the online membership application,
 * the membership information and the FAQ below, and the control buttons on top for the people who manage them.
 */
export default function ServicesPage() {
  const { lang, t, href } = useI18n();
  const toast = useToast();
  const [page, setPage] = useState<Page | null>(null);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [services, setServices] = useState<PublicService[] | null>(null);
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [pg, setPg] = useState(1);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [form, setForm] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const { can } = useAuth();
  // manager tools (hidden from visitors): the service / question windows (id = edit, none = new) and what waits for the delete confirmation
  const [svcDialog, setSvcDialog] = useState<{ id?: number } | null>(null);
  const [askSvc, setAskSvc] = useState<PublicService | null>(null);
  const [faqDialog, setFaqDialog] = useState<{ id?: number } | null>(null);
  const [askFaq, setAskFaq] = useState<Faq | null>(null);
  const [mgBusy, setMgBusy] = useState(false);

  const load = useCallback(() => {
    api<Page>('/public/membership', { params: { lang }, cache: 'no-store' }).then(setPage).catch(() => setPage({ isOpen: true, conditions: '', documents: '', fees: '', steps: [] }));
    api<Faq[]>('/public/faqs', { params: { lang, scope: 'membership' }, cache: 'no-store' }).then(setFaqs).catch(() => setFaqs([]));
    api<PublicService[]>('/public/services', { params: { lang }, cache: 'no-store' }).then(setServices).catch(() => setServices([]));
  }, [lang]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPg(1); }, [kind, q, lang]);

  const mayRequests = can('membership.read');
  const mayToggle = can('membership.update') && can('membership.read');
  const mayAddSvc = can('services.create'), mayEditSvc = can('services.update') && can('services.read'), mayDeleteSvc = can('services.delete'), maySvc = can('services.read');
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
  const removeSvc = async () => {
    if (!askSvc) return;
    setMgBusy(true);
    try {
      await api(`/admin/services/${askSvc.id}`, { method: 'DELETE' });
      toast(t('app.deleted'));
      setAskSvc(null);
      load();
    } catch (e: any) { toast(e.message, 'err'); } finally { setMgBusy(false); }
  };

  const close = () => { setForm(false); setDone(null); };

  const empty = t('mb.soon');
  const needle = q.trim().toLowerCase();
  // only the kinds that have a service become filter buttons, in the fixed order of SERVICE_KINDS
  const kinds = useMemo(() => SERVICE_KINDS.filter((k) => (services ?? []).some((s) => s.kind === k)), [services]);
  const filtered = useMemo(
    () => (services ?? []).filter((s) => (kind === 'all' || s.kind === kind) && (!needle || `${s.name} ${s.description} ${s.department}`.toLowerCase().includes(needle))),
    [services, kind, needle],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const shown = filtered.slice((Math.min(pg, pages) - 1) * PER_PAGE, Math.min(pg, pages) * PER_PAGE);
  const applyOpen = page?.isOpen !== false;
  const chip = (active: boolean) => `rounded-full px-4 py-1.5 text-sm font-bold transition ${active ? 'bg-secondary text-white' : 'bg-primary/10 text-secondary hover:bg-primary/20'}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <PageManageBar show={mayRequests || maySvc || mayAddSvc || mayAddFaq || mayEditFaq || mayDeleteFaq} settingsUrl={maySvc ? '/admin/settings?page=membership&tab=services' : undefined}>
        {mayAddSvc && <ManageBtn onClick={() => setSvcDialog({})}>＋ {t('sv.add')}</ManageBtn>}
        {maySvc && <ManageLink tone="solid" to="/admin/settings?page=membership&tab=services">▤ {t('sv.manage')}</ManageLink>}
        {mayRequests && <ManageLink to="/admin/settings?page=membership&tab=applications"><InlineIcon name="inbox" />{t('mg.requests')}</ManageLink>}
        {mayRequests && <ManageLink to="/admin/settings?page=membership&tab=content"><InlineIcon name="edit" />{t('mg.pageContent')}</ManageLink>}
        {mayToggle && page && <button type="button" disabled={mgBusy} onClick={toggleOpen} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-white px-3.5 py-1.5 text-xs font-bold text-primary shadow-sm transition hover:bg-primary/10 disabled:opacity-50"><InlineIcon name={page.isOpen ? 'pause' : 'play'} />{t(page.isOpen ? 'mg.closeMembership' : 'mg.openMembership')}</button>}
        {mayAddFaq && <ManageBtn tone="ghost" onClick={() => setFaqDialog({})}>＋ {t('faq.add')}</ManageBtn>}
      </PageManageBar>

      <header className="relative overflow-hidden rounded-3xl bg-secondary p-6 text-white shadow-card md:p-9">
        <div className="pointer-events-none absolute -top-24 end-[-4rem] h-64 w-64 rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl"><h1 className="text-2xl font-extrabold md:text-3xl">{t('sv.title')}</h1><p className="mt-2 text-sm leading-7 text-white/85">{t('sv.hero')}</p></div>
          {page?.isOpen === false ? <p className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold">{t('mb.closed')}</p>
            : <button type="button" onClick={() => setForm(true)} className="shrink-0 rounded-full bg-accent px-8 py-3 text-base font-extrabold text-secondary shadow-lift transition hover:brightness-110">{t('mb.apply')}</button>}
        </div>
      </header>

      {/* one row: the kinds of service, then the search */}
      <div className="flex flex-wrap items-center gap-2" role="search">
        <div role="tablist" aria-label={t('svc.kind')} className="flex flex-wrap gap-2">
          <button type="button" role="tab" aria-selected={kind === 'all'} onClick={() => setKind('all')} className={chip(kind === 'all')}>{t('sv.all')}</button>
          {kinds.map((k) => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}><InlineIcon name={KIND_ICON[k] ?? 'pin2'} />{t(`svc.kind.${k}`)}</button>)}
        </div>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('sv.search')} aria-label={t('sv.search')} className={`${inputCls} !w-auto min-w-48 flex-1`} />
      </div>

      {!services ? <Center><Spinner /></Center> : filtered.length === 0 ? <Center>{t('sv.empty')}</Center> : (
        <>
          <ul className="grid gap-5 md:grid-cols-2">
            {shown.map((s) => (
              <li key={s.id}>
                <ServiceCard s={s} applyOpen={applyOpen} onApply={() => setForm(true)}
                  actions={(mayEditSvc || mayDeleteSvc) ? <div className="mt-3 border-t border-line pt-3"><ItemActions onEdit={mayEditSvc ? () => setSvcDialog({ id: s.id }) : undefined} onDelete={mayDeleteSvc ? () => setAskSvc(s) : undefined} /></div> : undefined} />
              </li>
            ))}
          </ul>
          <Pager page={Math.min(pg, pages)} totalPages={pages} onPage={setPg} />
        </>
      )}

      {/* membership information: the conditions, the documents, the fees and the steps (edited in Settings > Membership & services > Page content) */}
      <section aria-labelledby="mb-info" className="space-y-5 pt-2">
        <h2 id="mb-info" className="border-s-4 border-accent ps-3 text-xl font-extrabold text-secondary">{t('sv.membershipInfo')}</h2>
        <div className="grid gap-5 md:grid-cols-3">
          <Card title={t('mb.conditions')} html={page?.conditions ?? ''} empty={empty} />
          <div id="required-docs" className="scroll-mt-24"><Card title={t('mb.documents')} html={page?.documents ?? ''} empty={empty} /></div>
          <Card title={t('mb.fees')} html={page?.fees ?? ''} empty={empty} />
        </div>
        {page && page.steps.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
            <h3 className="mb-4 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{t('mb.steps')}</h3>
            <ol className="flex flex-wrap items-center gap-2">
              {page.steps.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-secondary">{i + 1}. {s}</span>
                  {i < page.steps.length - 1 && <span aria-hidden="true" className="text-accent rtl:rotate-180">▸</span>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
        <h2 className="mb-3 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{t('mb.faq')}</h2>
        {faqs.length === 0 ? <p className="text-sm text-gray-500">{empty}</p> : (
          <ul className="space-y-2">
            {faqs.map((f) => (
              <li key={f.id} className="rounded-xl border border-line">
                <button type="button" aria-expanded={openFaq === f.id} onClick={() => setOpenFaq(openFaq === f.id ? null : f.id)} className="flex w-full items-center justify-between gap-3 p-3 text-start font-semibold text-secondary"><span>{f.question}</span><span aria-hidden="true">{openFaq === f.id ? '▾' : '▸'}</span></button>
                {openFaq === f.id && <div className="prose-news border-t border-line p-3" dangerouslySetInnerHTML={{ __html: f.answer }} />}
                {(mayEditFaq || mayDeleteFaq) && <div className="border-t border-line p-2"><ItemActions onEdit={mayEditFaq ? () => setFaqDialog({ id: f.id }) : undefined} onDelete={mayDeleteFaq ? () => setAskFaq(f) : undefined} /></div>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {svcDialog && <ServiceDialog key={svcDialog.id ?? 'new'} id={svcDialog.id} onClose={() => setSvcDialog(null)} onSaved={() => { setSvcDialog(null); load(); }} />}
      {askSvc && <ConfirmDelete busy={mgBusy} onConfirm={removeSvc} onClose={() => setAskSvc(null)} />}
      {faqDialog && <FaqDialog key={faqDialog.id ?? 'new'} id={faqDialog.id} scope="membership" onClose={() => setFaqDialog(null)} onSaved={load} />}
      {askFaq && <ConfirmDelete busy={mgBusy} onConfirm={removeFaq} onClose={() => setAskFaq(null)} />}

      <Modal open={form} onClose={close} title={t('mb.online')} wide>
        {/* the fields are the dashboard form "membership" (Forms → Forms): edit, add and delete them there */}
        <FormBySlug slug="membership" onDone={(r) => setDone(r.reference)}
          doneExtra={<><p className="text-sm text-gray-600">{t('mb.receivedHint')}</p>{page?.documents && <a href="#required-docs" onClick={close} className="mt-2 inline-block text-sm font-semibold text-primary underline">{t('mb.documents')}</a>}<div className="mt-3"><Button type="button" onClick={close}>{t('mb.close')}</Button></div></>} />
      </Modal>
    </div>
  );
}
