'use client';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { Block, Bullets, Heading, useExpoInfo } from '@/components/site/expo-shared';

/** Full introduction of the expo: definition, idea, goals, targeted sectors, participants, nature of participation, importance, why EXPO and the value it gives. */
export default function AboutPage() {
  const { lang, href } = useI18n();
  const ar = lang === 'ar';
  const x = useExpoInfo();
  const text = (k: string) => x.L(k);
  const para = (k: string, title: string) => text(k) && <Block title={title}><p className="whitespace-pre-line text-sm leading-8 text-gray-700">{text(k)}</p></Block>;
  const list = (k: string, title: string) => x.lines(k).length > 0 && <Block title={title}><Bullets items={x.lines(k)} /></Block>;
  const values: [string, string][] = [['value_exhibitors', ar ? 'للعارضين' : 'For exhibitors'], ['value_visitors', ar ? 'للزوار' : 'For visitors'], ['value_trade', ar ? 'للقطاع التجاري' : 'For the trade sector']];
  const shownValues = values.filter(([k]) => x.lines(k).length > 0);
  const empty = ![ 'about', 'idea', 'goals', 'target_sectors', 'participants', 'participation_nature', 'importance', 'why_expo', 'value_exhibitors', 'value_visitors', 'value_trade'].some((k) => text(k));
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Heading sub={x.tagline}>{ar ? 'عن المعرض' : 'About the expo'}</Heading>
      {empty && <p className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 ring-1 ring-line">{ar ? 'سيتم نشر التعريف بالمعرض قريباً.' : 'The expo introduction will be published soon.'}</p>}
      <div className="space-y-5">
        {para('about', ar ? 'التعريف بالمعرض' : 'What is the expo')}
        <div className="grid gap-5 md:grid-cols-2">
          {para('idea', ar ? 'فكرة المعرض' : 'The idea')}
          {list('goals', ar ? 'أهداف المعرض' : 'Goals')}
          {list('target_sectors', ar ? 'القطاعات المستهدفة' : 'Targeted sectors')}
          {list('participants', ar ? 'الفئات المشاركة' : 'Who takes part')}
          {para('participation_nature', ar ? 'طبيعة المشاركة' : 'Nature of participation')}
          {para('importance', ar ? 'أهمية المعرض' : 'Why it matters')}
        </div>
        {(text('why_expo') || x.lines('why').length > 0) && (
          <section className="rounded-2xl bg-secondary p-6 text-white shadow-card">
            <h3 className="mb-3 text-lg font-extrabold text-accent">{ar ? `لماذا ${x.name}؟` : `Why ${x.name}?`}</h3>
            {text('why_expo') && <p className="whitespace-pre-line text-sm leading-8 text-white/90">{text('why_expo')}</p>}
            {x.lines('why').length > 0 && <ul className="mt-3 space-y-2 text-sm leading-7 text-white/90">{x.lines('why').map((w, i) => <li key={i} className="flex gap-2"><span className="mt-1 text-accent">◆</span><span>{w}</span></li>)}</ul>}
          </section>
        )}
        {shownValues.length > 0 && (
          <div>
            <h3 className="mb-3 text-center text-lg font-extrabold text-primary">{ar ? 'القيمة التي يقدمها المعرض' : 'The value the expo offers'}</h3>
            <div className={`grid gap-4 ${shownValues.length === 1 ? '' : shownValues.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
              {shownValues.map(([k, title]) => <Block key={k} title={title}><Bullets items={x.lines(k)} /></Block>)}
            </div>
          </div>
        )}
      </div>
      {x.registerOpen && <div className="mt-8 text-center"><Link href={href('/expo/register')} className="inline-block rounded-full bg-accent px-6 py-3 font-extrabold text-secondary shadow transition hover:brightness-110">{ar ? 'سجّل الآن' : 'Register now'}</Link></div>}
    </div>
  );
}
