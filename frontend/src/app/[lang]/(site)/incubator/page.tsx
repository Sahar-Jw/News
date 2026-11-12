'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';
import { Pager } from '@/components/site/pager';
import { ManageLink, PageManageBar } from '@/components/site/page-manage-bar';
import { Card, NewsCard, Thumb } from '@/components/site/cards';
import { useSite } from '@/components/site/site-context';
import { newsCategoryLabel } from '@/lib/news-categories';
import { EMAIL_RE, PHONE_RE, THREE_PART_NAME_RE } from '@/components/site/training-shared';

interface Project { id: number; status: string; name: string; sector: string; founder: string; summary: string; story: string; joinedYear: number | null; website: string | null; imageUrl: string | null }
interface Data { incubated: Project[]; graduated: Project[] }
type V = { projectName: string; founderName: string; email: string; phone: string; sector: string; stage: string; description: string; feasibility: string; targetAudience: string; team: string; needs: string };
const EMPTY: V = { projectName: '', founderName: '', email: '', phone: '', sector: '', stage: '', description: '', feasibility: '', targetAudience: '', team: '', needs: '' };
type Err = Partial<Record<keyof V | 'profile' | 'accept', string>>;
const REQUIRED = ['sector', 'stage', 'description', 'feasibility', 'targetAudience', 'needs'] as const;
const MAX_DOC = 10 * 1024 * 1024;
const PROJECTS_PER_PAGE = 6;
const lines = (v: string) => v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

/** Business Incubator (P10): about + how it works, incubated projects, success stories, opportunities, news and "submit your project". */
export default function IncubatorPage() {
  const { lang, t, href } = useI18n();
  const { s, loc } = useSite();
  const { can } = useAuth();
  const L = (k: string) => loc('incubator', k) || String(s('incubator', `${k}_ar`) ?? '');
  const open = s('incubator', 'apply_open') !== false && s('incubator', 'apply_open') !== 'false';
  const about = L('about'), vision = L('vision'), purpose = L('purpose'), entrepreneurs = L('entrepreneurs');
  const goals = lines(L('goals')), how = lines(L('how')), opportunities = lines(L('opportunities'));
  const topic = L('news_topic');

  const [data, setData] = useState<Data | null>(null);
  const [section, setSection] = useState('');
  const [pp, setPp] = useState(1);
  const [news, setNews] = useState<Card[]>([]);
  useEffect(() => { api<Data>('/public/incubator', { params: { lang }, cache: 'no-store' }).then(setData).catch(() => setData({ incubated: [], graduated: [] })); }, [lang]);
  useEffect(() => {
    // the news of the fixed "Business Incubator News" category + the news tagged with the page topic (Settings), newest first, no duplicates
    const get = (params: Record<string, string | number>) => api<{ data: Card[] }>('/public/news', { params: { lang, limit: 3, ...params } }).then((r) => r.data).catch(() => [] as Card[]);
    Promise.all([get({ category: newsCategoryLabel('incubator', lang) }), topic ? get({ topics: topic }) : Promise.resolve([] as Card[])]).then(([byCategory, byTopic]) => {
      const seen = new Set<number>();
      const merged = [...byCategory, ...byTopic].filter((n) => !seen.has(n.id) && seen.add(n.id));
      merged.sort((a, b) => (b.publishAt ? Date.parse(b.publishAt) : 0) - (a.publishAt ? Date.parse(a.publishAt) : 0));
      setNews(merged.slice(0, 3));
    });
  }, [lang, topic]);

  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState<V>(EMPTY);
  const [errors, setErrors] = useState<Err>({});
  const [profile, setProfile] = useState<File | null>(null);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [confirmData, setConfirmData] = useState(false);
  const [ref, setRef] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof V, v: string) => { setF((p) => ({ ...p, [k]: v })); setErrors((p) => ({ ...p, [k]: undefined })); setServerError(''); };
  // the "submit your project" form opens in a window on top of the page
  const start = () => { setDone(false); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setDone(false); };

  const pickProfile = (list: FileList | null) => {
    const file = list?.[0] ?? null;
    if (file && file.size > MAX_DOC) { setErrors((p) => ({ ...p, profile: t('inc.fileTooBig') })); if (picker.current) picker.current.value = ''; return; }
    setProfile(file);
    setErrors((p) => ({ ...p, profile: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Err = {};
    if (f.projectName.trim().length < 2) err.projectName = t('inc.projectReq');
    if (!THREE_PART_NAME_RE.test(f.founderName.trim())) err.founderName = t('inc.founderReq');
    if (!EMAIL_RE.test(f.email.trim()) || f.email.trim().length > 190) err.email = t('tr.emailInvalid');
    if (!PHONE_RE.test(f.phone.trim())) err.phone = t('tr.phoneInvalid');
    for (const k of REQUIRED) if (f[k].trim().length < 2) err[k] = t('inc.fieldReq');
    if (f.description.trim().length < 10) err.description = t('inc.descReq');
    if (f.feasibility.trim().length < 10) err.feasibility = t('inc.descReq');
    if (!acceptPrivacy || !confirmData) err.accept = t('inc.acceptReq');
    setErrors(err);
    if (Object.keys(err).length) return;
    const fd = new FormData();
    for (const [k, v] of Object.entries(f)) fd.set(k, v.trim());
    fd.set('acceptPrivacy', 'true');
    fd.set('confirmData', 'true');
    fd.set('lang', lang);
    if (profile) fd.set('profile', profile);
    setBusy(true);
    setServerError('');
    try {
      const r = await api<{ reference?: string }>('/public/incubator/apply', { method: 'POST', form: fd });
      setRef(r.reference ?? '');
      setDone(true);
      setF(EMPTY); setProfile(null); setAcceptPrivacy(false); setConfirmData(false);
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
  // every section of the page is its own tab; a section without content has no tab
  const tabs = ([
    about ? ['about', t('inc.about')] : null,
    vision ? ['vision', t('inc.vision')] : null,
    goals.length > 0 ? ['goals', t('inc.goals')] : null,
    how.length > 0 ? ['how', t('inc.how')] : null,
    ['projects', t('inc.incubatedProjects')],
    purpose ? ['purpose', t('inc.purpose')] : null,
    entrepreneurs ? ['entrepreneurs', t('inc.entrepreneurs')] : null,
    opportunities.length > 0 ? ['opportunities', t('inc.availableOpps')] : null,
    (opportunities.length > 0 || (data?.incubated.length ?? 0) > 0) ? ['current', t('inc.currentTab')] : null,
    news.length > 0 ? ['news', t('inc.news')] : null,
    ['success', t('inc.graduated')],
  ] as (string[] | null)[]).filter((x): x is string[] => !!x);
  const current = tabs.some(([id]) => id === section) ? section : tabs[0][0];
  const isStory = current === 'success';
  // the project cards of the "incubated projects" and "success stories" tabs, 6 per page
  const shown = data ? (isStory ? data.graduated : data.incubated) : null;
  const pages = shown ? Math.max(1, Math.ceil(shown.length / PROJECTS_PER_PAGE)) : 1;
  const pageItems = shown ? shown.slice((Math.min(pp, pages) - 1) * PROJECTS_PER_PAGE, Math.min(pp, pages) * PROJECTS_PER_PAGE) : null;
  const mayRequests = can('incubator.applications.read'), mayProjects = can('incubator.read'), maySettings = can('settings.read');
  const goTab = (id: string) => { setSection(id); setPp(1); window.history.replaceState(null, '', `#${id}`); };
  // an old link such as /incubator#projects (or #graduated, #how ...) opens its tab
  useEffect(() => { const id = window.location.hash.replace('#', ''); if (id) setSection(id === 'graduated' ? 'success' : id === 'overview' ? 'about' : id); }, []);
  const prose = (text: string) => <p className="whitespace-pre-line text-sm leading-8 text-gray-700">{text}</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* buttons for the people who manage the page (visitors see nothing) */}
      <PageManageBar show={mayRequests || mayProjects || maySettings} settingsUrl={maySettings ? '/admin/settings?page=incubator&tab=settings' : undefined}>
        {mayRequests && <ManageLink tone="solid" to="/admin/settings?page=incubator&tab=applications">📥 {t('adm.incubatorApplications')}</ManageLink>}
        {can('incubator.create') && <ManageLink tone="solid" to="/admin/settings?page=incubator&tab=projects">＋ {t('inc.a.add')}</ManageLink>}
        {mayProjects && <ManageLink to="/admin/settings?page=incubator&tab=projects">🚀 {t('adm.incubatorProjects')}</ManageLink>}
      </PageManageBar>

      {/* the ONE "submit your project" button of the page lives here */}
      <header className="rounded-3xl bg-gradient-to-l from-secondary to-primary p-6 text-center text-white shadow-lift md:p-10">
        <h1 className="text-2xl font-extrabold md:text-3xl">{t('nav.incubator')}</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-white/85">{t('inc.subtitle')}</p>
        {data && (data.incubated.length > 0 || data.graduated.length > 0) && (
          <dl className="mt-5 flex flex-wrap justify-center gap-3">
            {([['inc.incubated', data.incubated.length], ['inc.graduated', data.graduated.length]] as const).map(([k, n]) => <div key={k} className="min-w-28 rounded-2xl bg-white/10 px-4 py-2 ring-1 ring-white/25"><dd className="text-2xl font-extrabold">{n}</dd><dt className="text-xs font-semibold text-white/85">{t(k)}</dt></div>)}
          </dl>
        )}
        <div className="mt-5">
          {open ? <button type="button" onClick={start} className="rounded-full bg-accent px-7 py-2.5 font-extrabold text-white shadow-card transition hover:-translate-y-px hover:shadow-lift">{t('inc.submit')}</button> : <p role="status" className="inline-block rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold">{t('inc.closed')}</p>}
        </div>
      </header>

      {/* the tabs stay in view while scrolling, with the apply button always in reach */}
      <div className="sticky top-0 z-10 flex items-center gap-2 rounded-full bg-white/90 px-2 py-1.5 shadow-card ring-1 ring-line backdrop-blur">
        <div role="tablist" aria-label={t('nav.incubator')} className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={current === id} onClick={() => goTab(id)} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${current === id ? 'bg-secondary text-white' : 'text-secondary hover:bg-primary/10 hover:text-primary'}`}>{label}</button>)}
        </div>
        {open && <button type="button" onClick={start} className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white shadow-card transition hover:-translate-y-px">{t('inc.submit')}</button>}
      </div>

      {current === 'about' && card(t('inc.about'), prose(about))}
      {current === 'vision' && card(t('inc.vision'), prose(vision))}
      {current === 'goals' && card(t('inc.goals'), bullets(goals))}
      {current === 'how' && card(t('inc.how'), (
        <ol className="flex flex-wrap items-center gap-2">
          {how.map((x, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-secondary">{i + 1}. {x}</span>
              {i < how.length - 1 && <span className="text-accent rtl:rotate-180" aria-hidden="true">◂</span>}
            </li>
          ))}
        </ol>
      ))}
      {current === 'purpose' && card(t('inc.purpose'), prose(purpose))}
      {current === 'entrepreneurs' && card(t('inc.entrepreneurs'), prose(entrepreneurs))}
      {current === 'opportunities' && card(t('inc.availableOpps'), bullets(opportunities))}

      {/* current projects and opportunities: who is being incubated now, and what is open to apply for */}
      {current === 'current' && (
        <div className="space-y-5">
          {data && data.incubated.length > 0 && card(t('inc.incubated'), (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.incubated.map((p) => <li key={p.id} className="rounded-xl bg-primary/5 p-3"><b className="text-secondary">{p.name}</b>{p.sector && <span className="ms-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-primary ring-1 ring-line">{p.sector}</span>}{p.summary && <span className="mt-1 line-clamp-2 block text-xs leading-6 text-gray-600">{p.summary}</span>}</li>)}
            </ul>
          ))}
          {opportunities.length > 0 && card(t('inc.availableOpps'), bullets(opportunities))}
        </div>
      )}

      {(current === 'projects' || current === 'success') && (
      <section aria-label={isStory ? t('inc.graduated') : t('inc.incubatedProjects')}>
        <h2 className="mb-4 text-xl font-extrabold text-secondary">{isStory ? t('inc.graduated') : t('inc.incubatedProjects')}</h2>
        {!pageItems || !shown ? <p className="py-10 text-center text-sm text-gray-500">{t('app.loading')}</p> : shown.length === 0 ? <p className="rounded-2xl bg-white py-10 text-center text-sm text-gray-500 shadow-card ring-1 ring-line">{t(isStory ? 'inc.noGraduated' : 'inc.noIncubated')}</p> : (
          <>
          <Pager page={Math.min(pp, pages)} totalPages={pages} onPage={setPp} className="mb-4" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((p) => (
              <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line">
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-40 w-full object-cover" /> : <Thumb src={null} className="h-40 w-full" />}
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-extrabold text-secondary">{p.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                    {p.sector && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-primary">{p.sector}</span>}
                    {p.joinedYear && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-gray-600">{p.joinedYear}</span>}
                  </div>
                  {p.founder && <p className="mt-2 text-xs text-gray-500">👤 {p.founder}</p>}
                  {p.summary && <p className="mt-2 whitespace-pre-line text-sm leading-7 text-gray-600">{p.summary}</p>}
                  {isStory && p.story && <blockquote className="mt-3 whitespace-pre-line rounded-xl border-s-4 border-accent bg-accent/10 p-3 text-sm leading-7 text-gray-700"><b className="block text-secondary">{t('inc.story')}</b>{p.story}</blockquote>}
                  {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="mt-auto pt-3 text-sm font-bold text-primary hover:underline">{t('ex.visit')} ↗</a>}
                </div>
              </article>
            ))}
          </div>
          <Pager page={Math.min(pp, pages)} totalPages={pages} onPage={setPp} />
          </>
        )}
      </section>
      )}

      {current === 'news' && news.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-extrabold text-secondary">{t('inc.news')}</h2>
          <div className="grid gap-4 md:grid-cols-3">{news.map((n) => <NewsCard key={n.id} n={n} />)}</div>
          <div className="mt-3 text-center"><Link href={href(`/media?topics=${encodeURIComponent(topic)}`)} className="text-sm font-bold text-primary hover:underline">{t('tr.moreNews')} →</Link></div>
        </section>
      )}

      <Modal open={showForm && open} onClose={closeForm} title={t('inc.submit')} wide>
        {done ? <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">{t('inc.done')}{ref && <> {t('inc.reference')}: <b dir="ltr">{ref}</b></>}</p> : (
            <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
              <Field label={t('inc.founder')} error={errors.founderName}><input className={inputCls} maxLength={150} autoComplete="name" aria-invalid={!!errors.founderName} value={f.founderName} onChange={(e) => set('founderName', e.target.value)} /></Field>
              <Field label={t('inc.project')} error={errors.projectName}><input className={inputCls} maxLength={190} aria-invalid={!!errors.projectName} value={f.projectName} onChange={(e) => set('projectName', e.target.value)} /></Field>
              <Field label={t('site.phone')} error={errors.phone}><input type="tel" dir="ltr" className={inputCls} maxLength={30} autoComplete="tel" aria-invalid={!!errors.phone} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label={t('contact.email')} error={errors.email}><input type="email" dir="ltr" className={inputCls} maxLength={190} autoComplete="email" aria-invalid={!!errors.email} value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label={t('inc.sector')} error={errors.sector}><input className={inputCls} maxLength={150} aria-invalid={!!errors.sector} value={f.sector} onChange={(e) => set('sector', e.target.value)} /></Field>
              <Field label={t('inc.stage')} error={errors.stage}><select className={inputCls} aria-invalid={!!errors.stage} value={f.stage} onChange={(e) => set('stage', e.target.value)}><option value="">—</option>{['idea', 'prototype', 'launched'].map((x) => <option key={x} value={x}>{t(`inc.stage.${x}`)}</option>)}</select></Field>
              <div className="sm:col-span-2"><Field label={t('inc.description')} error={errors.description}><textarea rows={4} className={inputCls} maxLength={5000} aria-invalid={!!errors.description} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field></div>
              <div className="sm:col-span-2"><Field label={t('inc.feasibility')} error={errors.feasibility}><textarea rows={4} className={inputCls} maxLength={5000} aria-invalid={!!errors.feasibility} value={f.feasibility} onChange={(e) => set('feasibility', e.target.value)} /></Field></div>
              <Field label={t('inc.audience')} error={errors.targetAudience}><textarea rows={3} className={inputCls} maxLength={3000} aria-invalid={!!errors.targetAudience} value={f.targetAudience} onChange={(e) => set('targetAudience', e.target.value)} /></Field>
              <Field label={t('inc.team')}><textarea rows={3} className={inputCls} maxLength={3000} value={f.team} onChange={(e) => set('team', e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label={t('inc.needs')} error={errors.needs}><textarea rows={3} className={inputCls} maxLength={3000} aria-invalid={!!errors.needs} value={f.needs} onChange={(e) => set('needs', e.target.value)} /></Field></div>
              <div className="sm:col-span-2">
                <Field label={t('inc.profile')} hint={t('inc.profileHint')} error={errors.profile}><input ref={picker} type="file" accept=".pdf,.doc,.docx" className={inputCls} aria-invalid={!!errors.profile} onChange={(e) => pickProfile(e.target.files)} /></Field>
                {profile && <p className="mt-1 truncate rounded-lg bg-canvas px-3 py-1.5 text-sm">{profile.name}</p>}
              </div>
              <div className="space-y-2 text-sm sm:col-span-2">
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={acceptPrivacy} onChange={(e) => { setAcceptPrivacy(e.target.checked); setErrors((p) => ({ ...p, accept: undefined })); }} /><span>{t('inc.acceptPrivacy')} <Link href={href('/privacy')} target="_blank" className="font-semibold text-primary hover:underline">{t('site.privacy')}</Link></span></label>
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={confirmData} onChange={(e) => { setConfirmData(e.target.checked); setErrors((p) => ({ ...p, accept: undefined })); }} /><span>{t('inc.confirmData')}</span></label>
                {errors.accept && <p role="alert" className="text-xs text-red-600">{errors.accept}</p>}
              </div>
              {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:col-span-2">{serverError}</p>}
              <div className="sm:col-span-2"><Button disabled={busy}>{busy ? t('app.sending') : t('tr.send')}</Button></div>
            </form>
          )}
      </Modal>
    </div>
  );
}
