'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';

/** The Services page lives at /membership (the old Membership page): /services opens it, so a link to either one works. */
export default function ServicesRedirect() {
  const { t, href } = useI18n();
  const router = useRouter();
  useEffect(() => { router.replace(href('/membership')); }, [router, href]);
  return <Center><Spinner /><span className="sr-only">{t('sv.title')}</span></Center>;
}
