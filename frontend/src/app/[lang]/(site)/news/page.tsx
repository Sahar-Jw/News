'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';

/** "All news" is now the News tab of the Media Center: old /news links (menus, chips, topic links) land there with their filters. */
function Redirect() {
  const { href } = useI18n();
  const router = useRouter();
  const qs = useSearchParams().toString();
  useEffect(() => { router.replace(href(`/media${qs ? `?${qs}` : ''}`)); }, [router, href, qs]);
  return <Center><Spinner /></Center>;
}

export default function NewsListPage() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Redirect /></Suspense>;
}
