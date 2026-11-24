'use client';
import { useRecordId } from '@/lib/use-record-id';
import { useCrumbTitle } from '@/components/site/breadcrumbs';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Center, Spinner } from '@/components/ui/ui';
import { CourseRegister } from '@/components/site/course-register';
import { NotFoundContent } from '@/components/site/not-found-content';
import { PublicCourse, courseFacts } from '@/components/site/training-shared';
import { ImageSlider } from '@/components/site/image-slider';
import { IconTile } from '@/components/site/pro-icon';

/** One course: /training/5 */
function View() {
  const { lang, t, href } = useI18n();
  const id = useRecordId('id');
  const [c, setC] = useState<PublicCourse | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');
  useCrumbTitle(c?.name);
  const [reg, setReg] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!id) { setState('404'); return; }
    setState((s) => (s === 'ok' ? s : 'load'));
    api<PublicCourse>(`/public/training/courses/${encodeURIComponent(id)}`, { params: { lang }, cache: 'no-store' }).then((r) => { setC(r); setState('ok'); }).catch(() => setState('404'));
  }, [id, lang, reload]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !c) return <NotFoundContent lang={lang} />;

  const facts = courseFacts(c, t, lang, true);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href={href('/training')} className="mb-4 inline-block text-sm text-primary hover:underline">{t('tr.back')}</Link>
      <article className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line">
        <div className="p-6 md:p-10">
          {/* the whole picture (never cropped); click it to open it full size, like the pictures of the news */}
          {c.imageUrl && <div className="-mt-5 mb-6"><ImageSlider images={[c.imageUrl]} title={c.name} dir={lang === 'ar' ? 'rtl' : 'ltr'} /></div>}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{t(`tr.kind.${c.kind}`)}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${c.status === 'open' ? 'bg-emerald-50 text-emerald-700' : c.status === 'full' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{t(`tr.status.${c.status}`)}</span>
          </div>
          <h1 className="mt-4 text-2xl font-extrabold leading-snug text-secondary md:text-3xl">{c.name}</h1>
          {facts.length > 0 && (
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label} className="flex items-start gap-3 rounded-xl bg-gray-50 px-4 py-3">
                  <IconTile name={f.icon} size={18} className="h-9 w-9 !rounded-lg" />
                  <div className="min-w-0"><dt className="text-xs font-semibold text-gray-500">{f.label}</dt><dd className="mt-0.5 break-words text-sm font-bold leading-6 text-secondary">{f.value}</dd></div>
                </div>
              ))}
            </dl>
          )}
          {c.topics.length > 0 && <section className="mt-6"><h2 className="mb-2 text-lg font-extrabold text-secondary">{t('tr.topics')}</h2><div className="space-y-1 text-sm leading-7 text-gray-700">{c.topics.map((x, i) => <p key={i}>{x}</p>)}</div></section>}
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
