'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate } from '@/lib/utils';
import { Center, Spinner } from '@/components/ui/ui';
import { NotFoundContent } from '@/components/site/not-found-content';

interface Member { id: number; position: string; name: string; jobTitle: string; termLabel: string; photoUrl: string | null; bio: string; duties: string; news: { id: number; title: string; excerpt: string; image: string | null; publishAt: string | null }[] }

/** One board member: picture, name, position, bio, committees and duties: /board/view?id=3. The HTML is sanitised by the API. */
function View() {
  const { lang, t, href } = useI18n();
  const id = useSearchParams().get('id');
  const [m, setM] = useState<Member | null>(null);
  const [state, setState] = useState<'load' | 'ok' | '404'>('load');

  useEffect(() => {
    if (!id) { setState('404'); return; }
    setState('load');
    api<Member>(`/public/board/${encodeURIComponent(id)}`, { params: { lang }, cache: 'no-store' }).then((r) => { setM(r); setState('ok'); }).catch(() => setState('404'));
  }, [id, lang]);

  if (state === 'load') return <Center><Spinner /></Center>;
  if (state === '404' || !m) return <NotFoundContent lang={lang} />;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <article className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line md:p-10">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
          {m.photoUrl
            ? <img src={fileUrl(m.photoUrl)} alt="" className="h-44 w-44 shrink-0 rounded-2xl object-cover ring-2 ring-accent/60" />
            : <span className="flex h-44 w-44 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-5xl text-primary" aria-hidden="true">👤</span>}
          <div className="text-center md:text-start">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{t(`board.pos.${m.position}`)}</span>
            <h1 className="mt-3 text-2xl font-extrabold leading-snug text-secondary md:text-3xl">{m.name}</h1>
            {m.jobTitle && <p className="mt-1 text-gray-600">{m.jobTitle}</p>}
            {m.termLabel && <p className="mt-1 text-sm text-gray-500">{t('board.term')}: <bdi dir="ltr">{m.termLabel}</bdi></p>}
          </div>
        </div>
        {m.bio && <section className="mt-8"><h2 className="mb-2 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{t('board.bio')}</h2><div className="prose-news" dangerouslySetInnerHTML={{ __html: m.bio }} /></section>}
        {m.duties && <section className="mt-8"><h2 className="mb-2 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{t('board.duties')}</h2><div className="prose-news" dangerouslySetInnerHTML={{ __html: m.duties }} /></section>}
        {m.news.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 border-s-4 border-accent ps-3 text-lg font-bold text-secondary">{t('board.news')}</h2>
            <ul className="space-y-3">
              {m.news.map((n) => (
                <li key={n.id}>
                  <Link href={href(`/news/view?id=${n.id}`)} className="group flex items-start gap-3">
                    {n.image && <img src={fileUrl(n.image)} alt="" loading="lazy" className="h-16 w-24 shrink-0 rounded-lg object-cover" />}
                    <span className="min-w-0">
                      <span className="block font-semibold text-secondary group-hover:text-primary">{n.title}</span>
                      {n.publishAt && <span className="block text-xs text-gray-500">{fmtDate(lang, n.publishAt)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Link href={href('/board')} className="mt-8 inline-block rounded-lg border border-line px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary">{t('board.back')}</Link>
      </article>
    </div>
  );
}

export default function BoardMemberPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><View /></Suspense>;
}
