'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { Button, Center, Spinner } from '@/components/ui/ui';
import { CourseRegister } from '@/components/site/course-register';
import { NotFoundContent } from '@/components/site/not-found-content';
import { PublicCourse, courseDates } from '@/components/site/training-shared';

/** One course: /training/view?id=5 */
function View() {
  const { lang, t, href } = useI18n();
  const id = useSearchParams().get('id');
  const [c, setC] = useState<PublicCourse | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');
  const [reg, setReg] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!id) { setState('404'); return; }
    setState((s) => (s === 'ok' ? s : 'load'));
    api<PublicCourse>(`/public/training/courses/${encodeURIComponent(id)}`, { params: { lang }, cache: 'no-store' }).then((r) => { setC(r); setState('ok'); }).catch(() => setState('404'));
  }, [id, lang, reload]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !c) return <NotFoundContent lang={lang} />;

  const facts: [string, string][] = ([
    [t('tr.trainer'), c.trainer?.name ?? ''], [t('tr.audience'), c.audience], [t('tr.field'), c.field], [t('tr.date'), courseDates(c, (d) => fmtDay(lang, d), t('tr.fromTo'))],
    [t('tr.place'), c.location], [t('tr.hours'), c.hours != null ? String(c.hours) : ''], [t('tr.fee'), c.fee], [t('tr.seatsLeft'), c.seatsLeft != null && c.status !== 'ended' ? String(c.seatsLeft) : ''],
  ] as [string, string][]).filter(([, v]) => v);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href={href('/training')} className="mb-4 inline-block text-sm text-primary hover:underline">{t('tr.back')}</Link>
      <article className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line">
        {c.imageUrl && <img src={fileUrl(c.imageUrl)} alt="" className="h-56 w-full object-cover" />}
        <div className="p-6 md:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{t(`tr.kind.${c.kind}`)}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${c.status === 'open' ? 'bg-emerald-50 text-emerald-700' : c.status === 'full' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{t(`tr.status.${c.status}`)}</span>
          </div>
          <h1 className="mt-4 text-2xl font-extrabold leading-snug text-secondary md:text-3xl">{c.name}</h1>
          {facts.length > 0 && (
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {facts.map(([k, v]) => <div key={k} className="rounded-xl bg-gray-50 px-4 py-3"><dt className="text-xs font-semibold text-gray-500">{k}</dt><dd className="mt-0.5 text-sm font-bold text-secondary">{v}</dd></div>)}
            </dl>
          )}
          {c.topics.length > 0 && <section className="mt-6"><h2 className="mb-2 text-lg font-extrabold text-secondary">{t('tr.topics')}</h2><ul className="list-disc space-y-1 ps-5 text-sm leading-7 text-gray-700">{c.topics.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
          {c.trainer?.bio && <section className="mt-6"><h2 className="mb-2 text-lg font-extrabold text-secondary">{t('tr.about')}</h2><p className="whitespace-pre-line text-sm leading-7 text-gray-700">{c.trainer.bio}</p></section>}
          {c.status === 'open' && <Button type="button" className="mt-8" onClick={() => setReg(true)}>{t('tr.registerNow')}</Button>}
        </div>
      </article>
      <CourseRegister courseId={c.id} courseName={c.name} open={reg} onClose={() => setReg(false)} onDone={() => setReload((n) => n + 1)} />
    </div>
  );
}

export default function CourseViewPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><View /></Suspense>;
}
