'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';

interface Faq { id: number; scope: string; question: string; answer: string }

/** Public FAQ page: questions grouped by scope (tabs appear when more than one scope has questions), one answer open at a time. */
export default function FaqPage() {
  const { lang, t } = useI18n();
  const [items, setItems] = useState<Faq[] | null>(null);
  const [scope, setScope] = useState('all');
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    setItems(null);
    api<Faq[]>('/public/faqs', { params: { lang }, cache: 'no-store' }).then(setItems).catch(() => setItems([]));
  }, [lang]);

  const scopes = useMemo(() => [...new Set((items ?? []).map((f) => f.scope))], [items]);
  const shown = (items ?? []).filter((f) => scope === 'all' || f.scope === scope);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-secondary">{t('site.faq')}</h1>
        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-primary" /><span className="h-1 w-2 rounded-full bg-primary/50" /><span className="h-1 w-1 rounded-full bg-primary/25" />
        </div>
      </header>
      {!items ? <Center><Spinner /></Center> : items.length === 0 ? <Center>{t('faq.empty')}</Center> : (
        <>
          {scopes.length > 1 && (
            <div className="mb-5 flex flex-wrap justify-center gap-2" role="tablist">
              {['all', ...scopes].map((sc) => (
                <button key={sc} type="button" role="tab" aria-selected={scope === sc} onClick={() => { setScope(sc); setOpen(null); }}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${scope === sc ? 'border-primary bg-primary text-white' : 'bg-white text-gray-700 hover:border-primary'}`}>
                  {sc === 'all' ? t('faq.all') : t(`faq.scope.${sc}`)}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-3">
            {shown.map((f) => {
              const on = open === f.id;
              return (
                <div key={f.id} className={`overflow-hidden rounded-2xl bg-white shadow-card ring-1 transition ${on ? 'ring-accent' : 'ring-line'}`}>
                  <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : f.id)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start font-bold text-secondary">
                    <span>{f.question}</span>
                    <span className={`shrink-0 text-accent transition-transform ${on ? 'rotate-45' : ''}`} aria-hidden="true">＋</span>
                  </button>
                  {on && <div className="whitespace-pre-line border-t border-line px-5 py-4 text-sm leading-7 text-gray-700">{f.answer}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
