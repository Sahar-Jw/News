'use client';
import { useI18n } from '@/lib/i18n';
import { NewsTable } from '@/components/admin/news-table';
import { RequirePerm } from '@/components/admin/guard';

export default function SectionClient({ code }: { code: string }) {
  const { t } = useI18n();
  return (
    <RequirePerm any={['news.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t(`section.${code}`)}</h1>
      <NewsTable section={code} />
    </RequirePerm>
  );
}
