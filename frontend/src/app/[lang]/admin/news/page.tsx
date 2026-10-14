'use client';
import { useI18n } from '@/lib/i18n';
import { NewsTable } from '@/components/admin/news-table';
import { RequirePerm } from '@/components/admin/guard';

export default function AdminNews() {
  const { t } = useI18n();
  return (
    <RequirePerm any={['news.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.news')}</h1>
      <NewsTable section="regular" />
    </RequirePerm>
  );
}
