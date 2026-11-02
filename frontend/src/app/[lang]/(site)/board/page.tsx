'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';

interface Member { id: number; position: string; name: string; jobTitle: string; termLabel: string; photoUrl: string | null }
const POSITIONS = ['president', 'vice_president', 'secretary', 'treasurer', 'member'];

function Card({ m, big }: { m: Member; big?: boolean }) {
  const { t, href } = useI18n();
  return (
    <Link href={href(`/board/view?id=${m.id}`)} className={`group flex flex-col items-center rounded-2xl bg-white p-5 text-center shadow-card ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-accent ${big ? 'w-64' : 'w-52'}`}>
      {m.photoUrl
        ? <img src={fileUrl(m.photoUrl)} alt="" loading="lazy" className={`rounded-full object-cover ring-2 ring-accent/60 ${big ? 'h-32 w-32' : 'h-24 w-24'}`} />
        : <span className={`flex items-center justify-center rounded-full bg-primary/10 text-3xl text-primary ${big ? 'h-32 w-32' : 'h-24 w-24'}`} aria-hidden="true">👤</span>}
      <h3 className="mt-3 font-bold text-secondary group-hover:text-primary">{m.name}</h3>
      <span className="mt-1 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">{t(`board.pos.${m.position}`)}</span>
      {m.jobTitle && <p className="mt-2 text-xs leading-6 text-gray-600">{m.jobTitle}</p>}
    </Link>
  );
}

/** Public board of directors, top to bottom: president, vice presidents, secretary, treasurer, members. */
export default function BoardPage() {
  const { lang, t } = useI18n();
  const [items, setItems] = useState<Member[] | null>(null);

  useEffect(() => {
    setItems(null);
    api<Member[]>('/public/board', { params: { lang }, cache: 'no-store' }).then(setItems).catch(() => setItems([]));
  }, [lang]);

  const term = items?.find((m) => m.termLabel)?.termLabel;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold text-secondary">{t('board.title')}</h1>
        {term && <p className="mt-1 text-sm text-gray-500">{t('board.term')}: <bdi dir="ltr">{term}</bdi></p>}
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" />
        </div>
      </header>
      {!items ? <Center><Spinner /></Center> : items.length === 0 ? <Center>{t('board.empty')}</Center> : (
        <div className="space-y-8">
          {POSITIONS.map((pos) => {
            const group = items.filter((m) => m.position === pos);
            if (!group.length) return null;
            return (
              <section key={pos} aria-label={t(`board.pos.${pos}`)}>
                <div className="flex flex-wrap justify-center gap-4">{group.map((m) => <Card key={m.id} m={m} big={pos === 'president'} />)}</div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
