'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { fmtDate, fmtDay } from '@/lib/utils';
import { womenPageHref } from '@/lib/women-menu';
import { useSite } from '@/components/site/site-context';
import { ContactForm } from '@/components/site/contact-form';
import { ContactIcon, SocialIcon } from '@/components/site/icons';
import type { CommitteeData, Activity, Member, NewsItem } from '@/components/site/committee-view';
import { ActGroup, DialogState, Dialogs, ItemTools, ManageButton, WomenAdminProvider, useCanManage, useTr } from './women-manage';

const todayStr = () => new Date().toISOString().slice(0, 10);
/** archived by hand, or already over (its date has passed) */
const autoArchived = (a: Activity) => !!a.eventDate && a.eventDate < todayStr();
const isArchived = (a: Activity) => !!a.archived || autoArchived(a);
const byDateDesc = (a: Activity, b: Activity) => (b.eventDate ?? '').localeCompare(a.eventDate ?? '') || b.id - a.id;

const Box = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <section className={`rounded-2xl bg-white p-5 shadow-card ring-1 ring-line ${className}`}>{children}</section>;
const Heading = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
    <h2 className="border-s-4 border-accent ps-3 text-xl font-extrabold text-secondary">{children}</h2>
    {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
  </div>
);
const Rich = ({ html }: { html: string }) => <div className="prose-news" dangerouslySetInnerHTML={{ __html: html }} />;
function Empty() {
  const tr = useTr();
  return <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-sm text-gray-500">{tr('لا يوجد محتوى بعد', 'Nothing here yet')}</p>;
}

function PageTitle({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <header className="relative mb-6 overflow-hidden rounded-3xl bg-secondary text-white shadow-card">
      <div className="pointer-events-none absolute -top-24 end-[-4rem] h-64 w-64 rounded-full bg-accent/25 blur-3xl" aria-hidden="true" />
      <div className="relative flex items-center gap-4 px-6 py-7 md:px-9">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-3xl ring-1 ring-white/25" aria-hidden="true">{icon}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-snug md:text-3xl">{title}</h1>
          {hint && <p className="mt-1 text-sm leading-6 text-white/80">{hint}</p>}
        </div>
      </div>
      <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent" aria-hidden="true" />
    </header>
  );
}

function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string; count?: number }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {tabs.map((x) => (
        <button key={x.key} role="tab" aria-selected={value === x.key} type="button" onClick={() => onChange(x.key)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${value === x.key ? 'bg-secondary text-white shadow-card' : 'bg-primary/10 text-ink/80 hover:bg-primary/20'}`}>
          {x.label}{x.count !== undefined && <span className="ms-1.5 text-xs opacity-70">({x.count})</span>}
        </button>
      ))}
    </div>
  );
}

function useTypeName() {
  const tr = useTr();
  const names: Record<string, string> = {
    meeting: tr('اجتماع', 'Meeting'), visit: tr('زيارة', 'Visit'), gathering: tr('لقاء', 'Gathering'), workshop: tr('ورشة عمل', 'Workshop'),
    expo: tr('مشاركة في معرض', 'Exhibition'), event: tr('فعالية', 'Event'), initiative: tr('مبادرة', 'Initiative'), success: tr('قصة نجاح', 'Success story'),
    recommendation: tr('توصية', 'Recommendation'), output: tr('مخرج', 'Output'),
  };
  return (k: string) => names[k] ?? k;
}
const typeOf = (a: Activity) => (a.kind === 'event' ? a.eventType || 'event' : a.kind);

/** `?add=<name>` in the address opens that "add" window (the avatar menu's "add new content" uses it) */
function useAutoAdd(name: string, open: () => void) {
  const can = useCanManage();
  useEffect(() => {
    if (!can) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('add') !== name) return;
    open();
    sp.delete('add');
    const q = sp.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`);
  }, [can]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** One initiative / activity / success story; the full text, goals and results open under it. */
function ActCard({ a, tools, showType = true }: { a: Activity; tools?: React.ReactNode; showType?: boolean }) {
  const tr = useTr();
  const { lang } = useI18n();
  const typeName = useTypeName();
  const [open, setOpen] = useState(false);
  const more = !!(a.body || a.goals || a.results);
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:ring-accent/60">
      {a.image && <img src={fileUrl(a.image)} alt="" loading="lazy" className="h-48 w-full object-cover" />}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {showType && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">{typeName(typeOf(a))}</span>}
          {a.eventDate && <span className="text-gray-500">{fmtDay(lang, a.eventDate)}</span>}
          {a.upcoming && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">{tr('قريباً', 'Upcoming')}</span>}
          {isArchived(a) && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-stone-600">{tr('أرشيف', 'Archive')}</span>}
        </div>
        <h3 className="text-lg font-extrabold leading-snug text-secondary">{a.title}</h3>
        {a.subtitle && <p className="text-sm font-semibold text-primary">{a.subtitle}</p>}
        {more && (
          <>
            {open && (
              <div className="space-y-4 border-t border-line pt-3">
                {a.body && <Rich html={a.body} />}
                {a.goals && <div className="rounded-lg bg-primary/5 p-3"><h4 className="mb-1 text-sm font-extrabold text-secondary">🎯 {tr('الأهداف', 'Goals')}</h4><Rich html={a.goals} /></div>}
                {a.results && <div className="rounded-lg bg-accent/10 p-3"><h4 className="mb-1 text-sm font-extrabold text-secondary">✅ {tr('النتائج', 'Results')}</h4><Rich html={a.results} /></div>}
              </div>
            )}
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-auto self-start text-sm font-bold text-primary hover:underline">{open ? tr('إخفاء التفاصيل', 'Hide details') : tr('عرض التفاصيل', 'Show details')}</button>
          </>
        )}
        {tools && <div className="mt-2 border-t border-dashed border-line pt-3">{tools}</div>}
      </div>
    </article>
  );
}

function NewsGrid({ items, limit }: { items: NewsItem[]; limit?: number }) {
  const { lang, href } = useI18n();
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((n) => (
        <Link key={n.id} href={href(`/news/view?id=${n.id}`)} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent/60">
          {n.image ? <img src={fileUrl(n.image)} alt="" loading="lazy" className="h-44 w-full object-cover" /> : <span className="grid h-44 place-items-center bg-primary/10 text-4xl" aria-hidden="true">📰</span>}
          <span className="flex flex-1 flex-col gap-1.5 p-4">
            {n.publishAt && <span className="text-xs text-gray-500">{fmtDate(lang, n.publishAt)}</span>}
            <span className="font-extrabold leading-snug text-secondary group-hover:text-primary">{n.title}</span>
            {n.excerpt && <span className="line-clamp-3 text-sm leading-6 text-ink/75">{n.excerpt}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}

function PersonCard({ m, big, tools }: { m: Member; big?: boolean; tools?: React.ReactNode }) {
  const { t } = useI18n();
  const role = m.role !== 'member' ? t(`cm.role.${m.role}`) : '';
  return (
    <div className={`text-center ${big ? 'rounded-2xl bg-white p-5 shadow-card ring-1 ring-accent/50' : ''}`}>
      {m.photoUrl
        ? <img src={fileUrl(m.photoUrl)} alt="" loading="lazy" className={`mx-auto rounded-2xl object-cover ring-2 ring-accent/50 ${big ? 'h-32 w-32' : 'h-24 w-24'}`} />
        : <span className={`mx-auto flex items-center justify-center rounded-2xl bg-primary/10 text-primary ${big ? 'h-32 w-32 text-5xl' : 'h-24 w-24 text-3xl'}`} aria-hidden="true">👤</span>}
      <div className={`mt-2 font-bold text-secondary ${big ? 'text-lg' : 'text-sm'}`}>{m.name}</div>
      {role && <div className="text-xs font-semibold text-primary">{role}</div>}
      {m.title && <div className="mt-0.5 text-xs leading-5 text-gray-600">{m.title}</div>}
      {tools && <div className="mt-2 flex justify-center">{tools}</div>}
    </div>
  );
}

const lines = (v: string) => v.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

// =============================================================================================== the pages
export function WomenPages({ c, page, reload }: { c: CommitteeData; page: string; reload: () => void }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  return (
    <WomenAdminProvider value={{ id: c.id, reload }}>
      {page === 'home' && <Home c={c} open={setDialog} />}
      {page === 'about' && <About c={c} open={setDialog} />}
      {page === 'organization' && <Structure c={c} open={setDialog} />}
      {page === 'initiatives' && <Initiatives c={c} open={setDialog} />}
      {page === 'activities' && <Activities c={c} open={setDialog} />}
      {page === 'success' && <Stories c={c} open={setDialog} />}
      {page === 'news' && <NewsPage c={c} />}
      {page === 'archive' && <ArchivePage c={c} open={setDialog} />}
      {page === 'contact' && <ContactPage />}
      <Dialogs state={dialog} close={() => setDialog(null)} />
    </WomenAdminProvider>
  );
}
type Open = (d: DialogState) => void;

function EditActTools({ a, group, open }: { a: Activity; group: ActGroup; open: Open }) {
  return <ItemTools kind="activity" id={a.id} archived={a.archived} canArchive={!autoArchived(a)} onEdit={() => open({ type: 'activity', group, editId: a.id })} />;
}

function ActGrid({ items, group, open, showType }: { items: Activity[]; group: ActGroup; open: Open; showType?: boolean }) {
  if (!items.length) return <Empty />;
  return <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{items.map((a) => <ActCard key={a.id} a={a} showType={showType} tools={<EditActTools a={a} group={group} open={open} />} />)}</div>;
}

// ---------------------------------------------------------------- home: the committee as a small site of its own
function Home({ c, open }: { c: CommitteeData; open: Open }) {
  const tr = useTr();
  const { href, t } = useI18n();
  const { loc } = useSite();
  const vision = loc('women', 'vision');
  const mission = loc('women', 'mission');
  const goals = lines(loc('women', 'goals'));
  const activities = [...c.meetings, ...(c.visits ?? []), ...(c.events ?? [])];
  const initiatives = c.initiatives.filter((a) => !isArchived(a)).sort(byDateDesc);
  const comingUp = activities.filter((a) => a.upcoming).sort((a, b) => (a.eventDate ?? '').localeCompare(b.eventDate ?? ''));
  const stories = [...(c.successStories ?? [])].sort(byDateDesc);
  const leader = c.members.find((m) => m.role === 'chair');
  const stats = [
    { n: c.members.length, label: tr('عضوة', 'Members'), icon: '👥', slug: 'organization' },
    { n: c.initiatives.length, label: tr('مبادرة ومشروع', 'Initiatives'), icon: '🌱', slug: 'initiatives' },
    { n: activities.length, label: tr('نشاط وفعالية', 'Activities'), icon: '📅', slug: 'activities' },
    { n: stories.length, label: tr('قصة نجاح', 'Success stories'), icon: '🏆', slug: 'success' },
  ];
  const cards = [
    { slug: 'about', icon: '💡', title: tr('عن اللجنة', 'About the committee'), text: tr('من نحن، رؤيتنا ورسالتنا وأهدافنا', 'Who we are, our vision, mission and goals') },
    { slug: 'organization', icon: '🏛', title: tr('الهيكلية التنظيمية', 'Organisational structure'), text: tr('الرئيسة وأمينة السر والعضوات ومهامهن', 'The chair, the secretary, the members and their tasks') },
    { slug: 'initiatives', icon: '🌱', title: tr('المبادرات والمشاريع', 'Initiatives & projects'), text: tr('ما تطلقه اللجنة: تفاصيله وأهدافه ونتائجه', 'What the committee launches: details, goals and results') },
    { slug: 'activities', icon: '📅', title: tr('الأنشطة والفعاليات', 'Activities & events'), text: tr('الاجتماعات والزيارات واللقاءات وورش العمل والمعارض', 'Meetings, visits, gatherings, workshops and exhibitions') },
    { slug: 'success', icon: '🏆', title: tr('قصص النجاح', 'Success stories'), text: tr('تجارب سيدات الأعمال والمشاريع النسائية المميزة', 'Outstanding businesswomen and women-led projects') },
    { slug: 'news', icon: '📰', title: tr('الأخبار', 'News'), text: tr('آخر أخبار اللجنة وسيدات الأعمال', 'The latest from the committee and businesswomen') },
  ];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((x) => (
          <Link key={x.slug} href={href(womenPageHref(x.slug))} className="rounded-2xl bg-white p-4 text-center shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent/60">
            <div className="text-2xl" aria-hidden="true">{x.icon}</div>
            <div className="text-3xl font-extrabold text-secondary">{x.n}</div>
            <div className="text-xs font-semibold text-gray-600">{x.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((x) => (
          <Link key={x.slug} href={href(womenPageHref(x.slug))} className="group flex items-start gap-3 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent/60">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-2xl" aria-hidden="true">{x.icon}</span>
            <span><span className="block font-extrabold text-secondary group-hover:text-primary">{x.title}</span><span className="mt-1 block text-sm leading-6 text-ink/70">{x.text}</span></span>
          </Link>
        ))}
      </div>

      {(vision || mission || goals.length > 0) && (
        <div className="grid gap-4 md:grid-cols-3">
          {vision && <Box><Heading>{t('women.vision')}</Heading><p className="whitespace-pre-line text-sm leading-7 text-ink/80">{vision}</p></Box>}
          {mission && <Box><Heading>{t('women.mission')}</Heading><p className="whitespace-pre-line text-sm leading-7 text-ink/80">{mission}</p></Box>}
          {goals.length > 0 && <Box><Heading>{t('women.goals')}</Heading><ul className="list-disc space-y-2 pe-5 text-sm leading-6 text-ink/80">{goals.map((g, i) => <li key={i}>{g}</li>)}</ul></Box>}
        </div>
      )}

      {initiatives.length > 0 && <section><Heading action={<Link href={href(womenPageHref('initiatives'))} className="text-sm font-bold text-primary hover:underline">{tr('كل المبادرات', 'All initiatives')} ←</Link>}>{tr('أحدث المبادرات والمشاريع', 'Latest initiatives & projects')}</Heading>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{initiatives.slice(0, 3).map((a) => <ActCard key={a.id} a={a} showType={false} />)}</div></section>}

      {comingUp.length > 0 && <section><Heading action={<Link href={href(womenPageHref('activities'))} className="text-sm font-bold text-primary hover:underline">{tr('كل الأنشطة', 'All activities')} ←</Link>}>{tr('الأنشطة القادمة', 'Coming up')}</Heading>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{comingUp.slice(0, 3).map((a) => <ActCard key={a.id} a={a} />)}</div></section>}

      {stories.length > 0 && <section><Heading action={<Link href={href(womenPageHref('success'))} className="text-sm font-bold text-primary hover:underline">{tr('كل القصص', 'All stories')} ←</Link>}>{tr('قصص نجاح', 'Success stories')}</Heading>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{stories.slice(0, 3).map((a) => <ActCard key={a.id} a={a} showType={false} />)}</div></section>}

      {c.news.length > 0 && <section><Heading action={<Link href={href(womenPageHref('news'))} className="text-sm font-bold text-primary hover:underline">{tr('كل الأخبار', 'All news')} ←</Link>}>{tr('آخر الأخبار', 'Latest news')}</Heading><NewsGrid items={c.news} limit={3} /></section>}

      {leader && <Box className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start"><div className="w-40 shrink-0"><PersonCard m={leader} /></div>
        <div><h2 className="text-lg font-extrabold text-secondary">{tr('رئيسة اللجنة', 'Committee chair')}</h2>{leader.title && <p className="mt-1 text-sm leading-7 text-ink/80">{leader.title}</p>}
          <Link href={href(womenPageHref('organization'))} className="mt-2 inline-block text-sm font-bold text-primary hover:underline">{tr('الهيكلية التنظيمية', 'The structure')} ←</Link></div></Box>}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-5 text-white shadow-card">
        <div><h2 className="text-lg font-extrabold">{tr('هل لديكِ مشروع أو سؤال؟', 'Have a project or a question?')}</h2><p className="text-sm text-white/80">{tr('تواصلي مع لجنة سيدات الأعمال', 'Get in touch with the committee')}</p></div>
        <Link href={href(womenPageHref('contact'))} className="rounded-full bg-accent px-6 py-2.5 text-sm font-extrabold text-secondary transition hover:brightness-110">{tr('تواصل معنا', 'Contact us')}</Link>
      </section>
      <ManageHome open={open} />
    </div>
  );
}
function ManageHome({ open }: { open: Open }) {
  const tr = useTr();
  const can = useCanManage();
  if (!can) return null;
  return (
    <Box className="border-2 border-dashed border-primary/40 bg-primary/5">
      <Heading>{tr('إدارة سريعة', 'Quick management')}</Heading>
      <div className="flex flex-wrap gap-2">
        <ManageButton onClick={() => open({ type: 'activity', group: 'initiative' })}>＋ {tr('مبادرة / مشروع', 'Initiative / project')}</ManageButton>
        <ManageButton onClick={() => open({ type: 'activity', group: 'activity' })}>＋ {tr('نشاط / فعالية', 'Activity / event')}</ManageButton>
        <ManageButton onClick={() => open({ type: 'activity', group: 'success' })}>＋ {tr('قصة نجاح', 'Success story')}</ManageButton>
        <ManageButton onClick={() => open({ type: 'member' })}>＋ {tr('عضوة', 'Member')}</ManageButton>
        <ManageButton tone="ghost" onClick={() => open({ type: 'texts', part: 'about' })}>✎ {tr('عن اللجنة', 'About')}</ManageButton>
        <ManageButton tone="ghost" onClick={() => open({ type: 'texts', part: 'structure' })}>✎ {tr('الهيكلية', 'Structure')}</ManageButton>
      </div>
    </Box>
  );
}

// ---------------------------------------------------------------- about
function About({ c, open }: { c: CommitteeData; open: Open }) {
  const tr = useTr();
  const { t } = useI18n();
  const { loc } = useSite();
  const vision = loc('women', 'vision');
  const mission = loc('women', 'mission');
  const goals = lines(loc('women', 'goals'));
  return (
    <div className="space-y-6">
      <PageTitle icon="💡" title={tr('عن اللجنة', 'About the committee')} />
      <Box>
        <Heading action={<ManageButton tone="ghost" onClick={() => open({ type: 'texts', part: 'about' })}>✎ {tr('تعديل', 'Edit')}</ManageButton>}>{tr('تعريف باللجنة', 'About the committee')}</Heading>
        <div className="flex flex-col items-center gap-5 md:flex-row md:items-start">
          {c.logoUrl && <img src={fileUrl(c.logoUrl)} alt="" className="h-32 w-auto max-w-[10rem] shrink-0 object-contain" />}
          <p className="whitespace-pre-line text-base leading-8 text-ink/85">{c.summary || tr('لم يُضف التعريف بعد', 'No description yet')}</p>
        </div>
      </Box>
      <div className="grid gap-4 md:grid-cols-2">
        <Box><Heading>🔭 {t('women.vision')}</Heading><p className="whitespace-pre-line text-sm leading-8 text-ink/85">{vision || '—'}</p></Box>
        <Box><Heading>🧭 {t('women.mission')}</Heading><p className="whitespace-pre-line text-sm leading-8 text-ink/85">{mission || '—'}</p></Box>
      </div>
      <Box>
        <Heading>🎯 {t('women.goals')}</Heading>
        {goals.length ? <ol className="grid gap-3 md:grid-cols-2">{goals.map((g, i) => <li key={i} className="flex gap-3 rounded-xl bg-primary/5 p-3 text-sm leading-7"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>{g}</li>)}</ol> : <Empty />}
      </Box>
    </div>
  );
}

// ---------------------------------------------------------------- organisational structure
function Structure({ c, open }: { c: CommitteeData; open: Open }) {
  const tr = useTr();
  const { t } = useI18n();
  const { loc } = useSite();
  const structure = loc('women', 'structure');
  const traits = lines(structure);
  const chair = c.members.filter((m) => m.role === 'chair');
  const deputies = c.members.filter((m) => m.role === 'vice');
  const secretary = c.members.filter((m) => m.role === 'secretary');
  const members = c.members.filter((m) => m.role === 'member');
  const tools = (m: Member) => <ItemTools kind="member" id={m.id} onEdit={() => open({ type: 'member', editId: m.id })} />;
  const leaders = [...chair, ...deputies, ...secretary];
  return (
    <div className="space-y-6">
      <PageTitle icon="🏛" title={tr('الهيكلية التنظيمية', 'Organisational structure')} />
      <Box>
        <Heading action={<><ManageButton onClick={() => open({ type: 'member' })}>＋ {tr('إضافة عضوة', 'Add a member')}</ManageButton><ManageButton tone="ghost" onClick={() => open({ type: 'texts', part: 'structure' })}>✎ {tr('تعديل النصوص', 'Edit texts')}</ManageButton></>}>{tr('رئاسة اللجنة وأمانة السر', 'Chair and secretary')}</Heading>
        {leaders.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{leaders.map((m) => <PersonCard key={m.id} m={m} big tools={tools(m)} />)}</div> : <Empty />}
      </Box>
      <Box>
        <Heading>{tr('العضوات', 'Members')} <span className="text-sm font-normal text-gray-500">({members.length})</span></Heading>
        {members.length ? <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{members.map((m) => <PersonCard key={m.id} m={m} tools={tools(m)} />)}</div> : <Empty />}
      </Box>
      {(c.duties || traits.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {c.duties && <Box><Heading>📋 {tr('المهام', 'Tasks')}</Heading><Rich html={c.duties} /></Box>}
          {traits.length > 0 && <Box><Heading>⭐ {tr('الصفات التنظيمية', 'Organisational characteristics')}</Heading><ul className="list-disc space-y-2 pe-5 text-sm leading-7 text-ink/80">{traits.map((x, i) => <li key={i}>{x}</li>)}</ul></Box>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- initiatives & projects (current / archive)
function Initiatives({ c, open }: { c: CommitteeData; open: Open }) {
  const tr = useTr();
  const [tab, setTab] = useState<'current' | 'archive'>('current');
  useAutoAdd('initiative', () => open({ type: 'activity', group: 'initiative' }));
  const all = [...c.initiatives].sort(byDateDesc);
  const current = all.filter((a) => !isArchived(a));
  const past = all.filter(isArchived);
  return (
    <div className="space-y-6">
      <PageTitle icon="🌱" title={tr('المبادرات والمشاريع', 'Initiatives & projects')} hint={tr('ما تطلقه اللجنة من مبادرات ومشاريع: تفاصيل كل واحدة وأهدافها ونتائجها', 'What the committee launches: the details, goals and results of each')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={(k) => setTab(k as 'current' | 'archive')} tabs={[{ key: 'current', label: tr('الحالية', 'Current'), count: current.length }, { key: 'archive', label: tr('الأرشيف', 'Archive'), count: past.length }]} />
        <ManageButton onClick={() => open({ type: 'activity', group: 'initiative' })}>＋ {tr('إضافة مبادرة / مشروع', 'Add an initiative / project')}</ManageButton>
      </div>
      <ActGrid items={tab === 'current' ? current : past} group="initiative" open={open} showType={false} />
    </div>
  );
}

// ---------------------------------------------------------------- activities & events (filter by type, current / archive)
function Activities({ c, open }: { c: CommitteeData; open: Open }) {
  const tr = useTr();
  const typeName = useTypeName();
  const [tab, setTab] = useState<'current' | 'archive'>('current');
  const [type, setType] = useState('all');
  useAutoAdd('activity', () => open({ type: 'activity', group: 'activity' }));
  const all = [...c.meetings, ...(c.visits ?? []), ...(c.events ?? [])].sort(byDateDesc);
  const pool = all.filter((a) => (tab === 'current' ? !isArchived(a) : isArchived(a)));
  const types = ['meeting', 'visit', 'gathering', 'workshop', 'expo'];
  const shown = pool.filter((a) => type === 'all' || typeOf(a) === type);
  return (
    <div className="space-y-6">
      <PageTitle icon="📅" title={tr('الأنشطة والفعاليات', 'Activities & events')} hint={tr('الاجتماعات والزيارات واللقاءات وورش العمل والمشاركات في المعارض', 'Meetings, visits, gatherings, workshops and exhibition participation')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onChange={(k) => setTab(k as 'current' | 'archive')} tabs={[{ key: 'current', label: tr('الحالية والقادمة', 'Current & upcoming'), count: all.filter((a) => !isArchived(a)).length }, { key: 'archive', label: tr('الأرشيف', 'Archive'), count: all.filter(isArchived).length }]} />
        <ManageButton onClick={() => open({ type: 'activity', group: 'activity' })}>＋ {tr('إضافة نشاط / فعالية', 'Add an activity / event')}</ManageButton>
      </div>
      <Tabs value={type} onChange={setType} tabs={[{ key: 'all', label: tr('الكل', 'All'), count: pool.length }, ...types.map((k) => ({ key: k, label: typeName(k), count: pool.filter((a) => typeOf(a) === k).length }))]} />
      <ActGrid items={shown} group="activity" open={open} />
    </div>
  );
}

// ---------------------------------------------------------------- success stories
function Stories({ c, open }: { c: CommitteeData; open: Open }) {
  const tr = useTr();
  useAutoAdd('success', () => open({ type: 'activity', group: 'success' }));
  const items = [...(c.successStories ?? [])].sort(byDateDesc);
  return (
    <div className="space-y-6">
      <PageTitle icon="🏆" title={tr('قصص النجاح', 'Success stories')} hint={tr('تجارب سيدات الأعمال والمشاريع النسائية المميزة', 'Outstanding businesswomen and women-led projects')} />
      <div className="flex justify-end"><ManageButton onClick={() => open({ type: 'activity', group: 'success' })}>＋ {tr('إضافة قصة نجاح', 'Add a success story')}</ManageButton></div>
      <ActGrid items={items} group="success" open={open} showType={false} />
    </div>
  );
}

// ---------------------------------------------------------------- news (everything whose main category is the businesswomen one + the news linked to the committee)
function NewsPage({ c }: { c: CommitteeData }) {
  const tr = useTr();
  const { href } = useI18n();
  const { can } = useAuth();
  return (
    <div className="space-y-6">
      <PageTitle icon="📰" title={tr('الأخبار', 'News')} hint={tr('كل خبر تصنيفه الرئيسي «سيدات أعمال» يظهر هنا تلقائياً', 'Every news item whose main category is "businesswomen" appears here automatically')} />
      {can('news.create') && <div className="flex justify-end"><Link href={href('/admin/news/edit')} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm hover:brightness-110">＋ {tr('إضافة خبر', 'Add a news item')}</Link></div>}
      {c.news.length ? <NewsGrid items={c.news} /> : <Empty />}
    </div>
  );
}

// ---------------------------------------------------------------- archive: past (or archived) initiatives and activities
function ArchivePage({ c, open }: { c: CommitteeData; open: Open }) {
  const tr = useTr();
  const typeName = useTypeName();
  const [type, setType] = useState('all');
  const all = [...c.initiatives, ...c.meetings, ...(c.visits ?? []), ...(c.events ?? []), ...c.recommendations, ...(c.outputs ?? [])].filter(isArchived).sort(byDateDesc);
  const kinds = [...new Set(all.map(typeOf))];
  const shown = all.filter((a) => type === 'all' || typeOf(a) === type);
  const group = (a: Activity): ActGroup => (a.kind === 'initiative' ? 'initiative' : 'activity');
  return (
    <div className="space-y-6">
      <PageTitle icon="🗄" title={tr('الأرشيف', 'Archive')} hint={tr('المبادرات والأنشطة السابقة', 'Past initiatives and activities')} />
      <Tabs value={type} onChange={setType} tabs={[{ key: 'all', label: tr('الكل', 'All'), count: all.length }, ...kinds.map((k) => ({ key: k, label: typeName(k), count: all.filter((a) => typeOf(a) === k).length }))]} />
      {shown.length ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{shown.map((a) => <ActCard key={a.id} a={a} tools={<EditActTools a={a} group={group(a)} open={open} />} />)}</div> : <Empty />}
    </div>
  );
}

// ---------------------------------------------------------------- contact: details, social links and a message form
function ContactPage() {
  const tr = useTr();
  const { s, loc } = useSite();
  const phone = String(s('women', 'contact_phone') ?? '');
  const email = String(s('women', 'contact_email') ?? '');
  const website = String(s('women', 'contact_website') ?? '');
  const address = loc('women', 'contact_address');
  const hours = loc('women', 'contact_hours');
  const socials = ['facebook_url', 'x_url', 'instagram_url', 'linkedin_url', 'youtube_url', 'whatsapp_url', 'telegram_url'].filter((k) => s('women', `social_${k}`));
  const card = 'flex items-center gap-3 rounded-xl border border-line p-4 transition hover:border-primary';
  return (
    <div className="space-y-6">
      <PageTitle icon="✉️" title={tr('تواصل معنا', 'Contact us')} hint={tr('يسعدنا سماعكِ: راسلي لجنة سيدات الأعمال مباشرة', 'We would love to hear from you: write to the committee directly')} />
      <div className="grid gap-6 lg:grid-cols-[1fr,1.2fr]">
        <Box>
          <Heading>{tr('بيانات التواصل', 'Contact details')}</Heading>
          <div className="grid gap-3">
            {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={card}><ContactIcon name="phone" size={18} /><bdi dir="ltr">{phone}</bdi></a>}
            {email && <a href={`mailto:${email}`} className={card}><ContactIcon name="email" size={18} /><bdi dir="ltr">{email}</bdi></a>}
            {website && <a href={website} target="_blank" rel="noopener noreferrer" className={card}><ContactIcon name="website" size={18} /><bdi dir="ltr">{website}</bdi></a>}
            {address && <div className={card}><ContactIcon name="address" size={18} />{address}</div>}
            {hours && <div className={card}><ContactIcon name="hours" size={18} />{hours}</div>}
            {!phone && !email && !website && !address && !hours && <Empty />}
          </div>
          {socials.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{socials.map((k) => <a key={k} href={String(s('women', `social_${k}`))} target="_blank" rel="noopener noreferrer" aria-label={k.replace('_url', '')} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition hover:bg-primary hover:text-white"><SocialIcon name={k} size={18} /></a>)}</div>}
        </Box>
        <Box>
          <Heading>{tr('أرسلي رسالة', 'Send a message')}</Heading>
          <ContactForm subjectPrefix={tr('[لجنة سيدات الأعمال] ', '[Women Business Committee] ')} />
        </Box>
      </div>
    </div>
  );
}
