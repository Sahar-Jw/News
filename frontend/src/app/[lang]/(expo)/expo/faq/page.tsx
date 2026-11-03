'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { Heading } from '@/components/site/expo-shared';

interface Faq { id: number; question: string; answer: string }

/** EXPO FAQ: the questions of the "expo" scope (managed in the FAQ admin screen). */
export default function ExpoFaq() {
  const { lang, t } = useI18n();
  const [items, setItems] = useState<Faq[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { setItems(null); api<Faq[]>('/public/faqs', { params: { lang, scope: 'expo' }, cache: 'no-store' }).then(setItems).catch(() => setItems([])); }, [lang]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Heading>{t('ex.faq')}</Heading>
      {!items ? <Center><Spinner /></Center> : items.length === 0 ? <Center>{t('faq.empty')}</Center> : (
        <div className="space-y-3">
          {items.map((f) => {
            const on = open === f.id;
            return (
              <div key={f.id} className={`overflow-hidden rounded-2xl bg-white shadow-card ring-1 transition ${on ? 'ring-accent' : 'ring-line'}`}>
                <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : f.id)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start font-bold text-secondary"><span>{f.question}</span><span className={`shrink-0 text-accent transition-transform ${on ? 'rotate-45' : ''}`} aria-hidden="true">＋</span></button>
                {on && <div className="whitespace-pre-line border-t border-line px-5 py-4 text-sm leading-7 text-gray-700">{f.answer}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
