'use client';

import { useI18n } from '@/lib/i18n';
import { NotFoundContent } from '@/components/site/not-found-content';

export default function NotFound() {
  const { lang } = useI18n();
  return <NotFoundContent lang={lang} />;
}
