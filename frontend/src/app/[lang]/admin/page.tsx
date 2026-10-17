'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

/** The dashboard was removed: management lives in the navbar dropdowns. */
export default function AdminIndex() {
  const { href } = useI18n();
  const router = useRouter();
  useEffect(() => { router.replace(href('/')); }, [router, href]);
  return null;
}
