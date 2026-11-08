'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

  const [q, setQ] = useState('');
  const [pos, setPos] = useState('');
  const [termSel, setTermSel] = useState('');
  const terms = useMemo(() => [...new Set((items ?? []).map((m) => m.termLabel).filter(Boolean))], [items]);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () => (items ?? []).filter((m) => (!pos || m.position === pos) && (!termSel || m.termLabel === termSel) && (!needle || `${m.name} ${m.jobTitle}`.toLowerCase().includes(needle))),
    [items, pos, termSel, needle],
  );
  const filtered = !!(pos || termSel || needle);
  const presentPos = POSITIONS.filter((p) => (items ?? []).some((m) => m.position === p));
  const term = termSel || items?.find((m) => m.termLabel)?.termLabel;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-extrabold text-secondary">{t('board.title')}</h1>
        {term && <p className="mt-1 text-sm text-gray-500">{t('board.term')}: <bdi dir="ltr">{term}</bdi></p>}
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" />
        </div>
      </header>
      {items && items.length > 1 && (
        <div className="mb-8 space-y-3 rounded-2xl bg-white p-4 shadow-card ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-3">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('board.searchPh')} aria-label={t('app.search')} className="min-w-[12rem] flex-1 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-primary" />
            {terms.length > 1 && (
              <select value={termSel} onChange={(e) => setTermSel(e.target.value)} aria-label={t('board.term')} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
                <option value="">{t('board.term')}: {t('app.all')}</option>
                {terms.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            )}
            {filtered && <button type="button" onClick={() => { setQ(''); setPos(''); setTermSel(''); }} className="rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">{t('app.reset')}</button>}
          </div>
          <div role="group" aria-label={t('board.position')} className="flex flex-wrap gap-2">
            {['', ...presentPos].map((p) => (
              <button key={p || 'all'} type="button" aria-pressed={pos === p} onClick={() => setPos(p)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${pos === p ? 'bg-secondary text-white shadow-card' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                {p ? t(`board.pos.${p}`) : t('app.all')}
              </button>
            ))}
          </div>
        </div>
      )}
      {!items ? <Center><Spinner /></Center> : items.length === 0 ? <Center>{t('board.empty')}</Center> : filtered && shown.length === 0 ? <Center>{t('board.noMatch')}</Center> : (
        <div className="space-y-8">
          {POSITIONS.map((pos) => {
            const group = shown.filter((m) => m.position === pos);
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
