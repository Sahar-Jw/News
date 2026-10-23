'use client';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { useSite } from './site-context';

/** Page text is managed in site settings (category "pages", JSON {title, body}). No legal text is invented. */
export function PageContent({ name, titleKey }: { name: string; titleKey: string }) {
  const { lang, t } = useI18n();
  const { s, ready } = useSite();
  if (!ready) return <Center><Spinner /></Center>;
  const v = s('pages', `${name}_${lang}`) as { title?: string; body?: string } | null;
  const paragraphs = (v?.body ?? '').split(/\n{1,}/).filter(Boolean);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-3xl font-bold">{v?.title || t(titleKey)}</h1>
      {paragraphs.length ? <div className="space-y-4 leading-8">{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div> : <p className="text-gray-500">{t('site.pageEmpty')}</p>}
    </div>
  );
}
