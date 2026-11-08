'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { Card, NewsCard } from '@/components/site/cards';
import { useSite } from '@/components/site/site-context';
import { EMAIL_RE, PHONE_RE } from '@/components/site/training-shared';

interface Project { id: number; status: string; name: string; sector: string; founder: string; summary: string; story: string; joinedYear: number | null; website: string | null; imageUrl: string | null }
interface Data { incubated: Project[]; graduated: Project[] }
type V = { projectName: string; founderName: string; email: string; phone: string; sector: string; stage: string; description: string };
const EMPTY: V = { projectName: '', founderName: '', email: '', phone: '', sector: '', stage: '', description: '' };
const lines = (v: string) => v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

/** Business Incubator (P10): about + how it works, incubated projects, success stories, opportunities, news and "submit your project". */
export default function IncubatorPage() {
  const { lang, t, href } = useI18n();
  const { s, loc } = useSite();
  const L = (k: string) => loc('incubator', k) || String(s('incubator', `${k}_ar`) ?? '');
  const open = s('incubator', 'apply_open') !== false && s('incubator', 'apply_open') !== 'false';
  const about = L('about'), vision = L('vision');
  const goals = lines(L('goals')), how = lines(L('how')), opportunities = lines(L('opportunities'));
  const topic = L('news_topic');

  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'incubated' | 'graduated'>('incubated');
  const [news, setNews] = useState<Card[]>([]);
  useEffect(() => { api<Data>('/public/incubator', { params: { lang }, cache: 'no-store' }).then(setData).catch(() => setData({ incubated: [], graduated: [] })); }, [lang]);
  useEffect(() => {
    if (!topic) return setNews([]);
    api<{ data: Card[] }>('/public/news', { params: { lang, topics: topic, limit: 3 } }).then((r) => setNews(r.data)).catch(() => setNews([]));
  }, [lang, topic]);

  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState<V>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof V, string>>>({});
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const set = (k: keyof V, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: undefined })); setServerError(''); };
  const start = () => { setShowForm(true); setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: typeof errors = {};
    if (f.projectName.trim().length < 2) err.projectName = t('inc.projectReq');
    if (f.founderName.trim().length < 2) err.founderName = t('inc.founderReq');
    if (!EMAIL_RE.test(f.email.trim()) || f.email.trim().length > 190) err.email = t('tr.emailInvalid');
    if (!PHONE_RE.test(f.phone.trim())) err.phone = t('tr.phoneInvalid');
    if (f.description.trim().length < 10) err.description = t('inc.descReq');
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    setServerError('');
    try {
      await api('/public/incubator/apply', { method: 'POST', body: { projectName: f.projectName.trim(), founderName: f.founderName.trim(), email: f.email.trim(), phone: f.phone.trim(), sector: f.sector.trim(), stage: f.stage, description: f.description.trim() } });
      setDone(true);
      setF(EMPTY);
    } catch (e2: any) { setServerError(e2.message); }
    finally { setBusy(false); }
  };

  const card = (title: string, body: React.ReactNode, id?: string) => (
    <section id={id} className="scroll-mt-24 rounded-2xl bg-white p-6 shadow-card ring-1 ring-line">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-secondary"><span className="h-5 w-1.5 rounded-full bg-accent" />{title}</h2>
      {body}
    </section>
  );
  const bullets = (items: string[]) => <ul className="space-y-2 text-sm leading-7 text-gray-700">{items.map((x, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-sm bg-accent" /><span>{x}</span></li>)}</ul>;
  const shown = data ? data[tab] : null;
  const tabCls = (x: string) => `rounded-full px-5 py-2.5 text-sm font-bold transition ${tab === x ? 'bg-secondary text-white' : 'bg-primary/10 text-secondary hover:bg-primary/20'}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold text-secondary md:text-3xl">{t('nav.incubator')}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-gray-600">{t('inc.subtitle')}</p>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true"><span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" /></div>
        {open && <div className="mt-5"><Button onClick={start}>{t('inc.submit')}</Button></div>}
      </header>

      {(about || vision || goals.length > 0) && (
        <div className="grid gap-5 md:grid-cols-2">
          {(about || vision) && card(t('inc.about'), <div className="space-y-3 text-sm leading-8 text-gray-700">{about && <p className="whitespace-pre-line">{about}</p>}{vision && <p className="whitespace-pre-line rounded-xl bg-primary/5 p-3"><b className="text-secondary">{t('inc.vision')}: </b>{vision}</p>}</div>)}
          {goals.length > 0 && card(t('inc.goals'), bullets(goals))}
        </div>
      )}

      {how.length > 0 && card(t('inc.how'), (
        <ol className="flex flex-wrap items-center gap-2">
          {how.map((x, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-secondary">{i + 1}. {x}</span>
              {i < how.length - 1 && <span className="text-accent rtl:rotate-180" aria-hidden="true">◂</span>}
            </li>
          ))}
        </ol>
      ))}

      <section aria-label={t('inc.projects')}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold text-secondary">{t('inc.projects')}</h2>
          <div className="flex gap-2" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'incubated'} className={tabCls('incubated')} onClick={() => setTab('incubated')}>{t('inc.incubated')}</button>
            <button type="button" role="tab" aria-selected={tab === 'graduated'} className={tabCls('graduated')} onClick={() => setTab('graduated')}>{t('inc.graduated')}</button>
          </div>
        </div>
        {!shown ? <p className="py-10 text-center text-sm text-gray-500">{t('app.loading')}</p> : shown.length === 0 ? <p className="rounded-2xl bg-white py-10 text-center text-sm text-gray-500 shadow-card ring-1 ring-line">{t(tab === 'incubated' ? 'inc.noIncubated' : 'inc.noGraduated')}</p> : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
                {p.imageUrl && <img src={p.imageUrl} alt="" className="h-40 w-full object-cover" />}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-extrabold text-secondary">{p.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                    {p.sector && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">{p.sector}</span>}
                    {p.joinedYear && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600">{p.joinedYear}</span>}
                  </div>
                  {p.founder && <p className="mt-2 text-xs text-gray-500">👤 {p.founder}</p>}
                  {p.summary && <p className="mt-2 whitespace-pre-line text-sm leading-7 text-gray-600">{p.summary}</p>}
                  {tab === 'graduated' && p.story && <blockquote className="mt-3 whitespace-pre-line rounded-xl border-s-4 border-accent bg-accent/10 p-3 text-sm leading-7 text-gray-700"><b className="block text-secondary">{t('inc.story')}</b>{p.story}</blockquote>}
                  {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="mt-auto pt-3 text-sm font-bold text-primary hover:underline">{t('ex.visit')} ↗</a>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {opportunities.length > 0 && card(t('inc.opportunities'), bullets(opportunities))}

      {news.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-extrabold text-secondary">{t('inc.news')}</h2>
          <div className="grid gap-4 md:grid-cols-3">{news.map((n) => <NewsCard key={n.id} n={n} />)}</div>
          <div className="mt-3 text-center"><Link href={href(`/media?topics=${encodeURIComponent(topic)}`)} className="text-sm font-bold text-primary hover:underline">{t('tr.moreNews')} →</Link></div>
        </section>
      )}

      {!showForm && (
        <div className="rounded-2xl bg-gradient-to-r from-secondary to-primary p-6 text-center text-white shadow-card">
          <h2 className="text-lg font-extrabold">{t('inc.cta')}</h2>
          <div className="mt-4">{open ? <button type="button" onClick={start} className="rounded-full bg-accent px-6 py-2.5 font-extrabold text-secondary transition hover:brightness-110">{t('inc.submit')}</button> : <p className="text-sm font-semibold text-white/90">{t('inc.closed')}</p>}</div>
        </div>
      )}

      {showForm && open && (
        <div ref={formRef} className="scroll-mt-24 rounded-2xl bg-white p-6 shadow-card ring-1 ring-accent">
          <h2 className="mb-4 text-lg font-extrabold text-secondary">{t('inc.submit')}</h2>
          {done ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">{t('inc.done')}</p> : (
            <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
              <Field label={t('inc.project')} error={errors.projectName}><input className={inputCls} maxLength={190} aria-invalid={!!errors.projectName} value={f.projectName} onChange={(e) => set('projectName', e.target.value)} /></Field>
              <Field label={t('inc.founder')} error={errors.founderName}><input className={inputCls} maxLength={150} autoComplete="name" aria-invalid={!!errors.founderName} value={f.founderName} onChange={(e) => set('founderName', e.target.value)} /></Field>
              <Field label={t('contact.email')} error={errors.email}><input type="email" dir="ltr" className={inputCls} maxLength={190} autoComplete="email" aria-invalid={!!errors.email} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label={t('site.phone')} error={errors.phone}><input type="tel" dir="ltr" className={inputCls} maxLength={30} autoComplete="tel" aria-invalid={!!errors.phone} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label={t('ex.f.sector')}><input className={inputCls} maxLength={150} value={f.sector} onChange={(e) => set('sector', e.target.value)} /></Field>
              <Field label={t('inc.stage')}><select className={inputCls} value={f.stage} onChange={(e) => set('stage', e.target.value)}><option value="">—</option>{['idea', 'prototype', 'launched'].map((x) => <option key={x} value={x}>{t(`inc.stage.${x}`)}</option>)}</select></Field>
              <div className="sm:col-span-2"><Field label={t('inc.description')} error={errors.description}><textarea rows={5} className={inputCls} maxLength={5000} aria-invalid={!!errors.description} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field></div>
              {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">{serverError}</p>}
              <div className="sm:col-span-2"><Button disabled={busy}>{busy ? t('app.sending') : t('tr.send')}</Button></div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
