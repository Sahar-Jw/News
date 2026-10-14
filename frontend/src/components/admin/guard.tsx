'use client';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Center } from '@/components/ui/ui';

/** UI-level gate only; the API still enforces every permission. */
export function RequirePerm({ any, children }: { any: string[]; children: React.ReactNode }) {
  const { can } = useAuth();
  const { t } = useI18n();
  if (!can(...any)) return <Center>{t('adm.noAccess')}</Center>;
  return <>{children}</>;
}
