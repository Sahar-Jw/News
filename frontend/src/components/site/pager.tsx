'use client';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/ui';

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  const { t } = useI18n();
  if (totalPages <= 1) return null;
  return (
    <div className="mt-8 flex items-center justify-center gap-3">
      <Button variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>{t('app.prev')}</Button>
      <span className="text-sm">{page} / {totalPages}</span>
      <Button variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>{t('app.next')}</Button>
    </div>
  );
}
