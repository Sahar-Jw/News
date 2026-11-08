'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { hubUrl } from '@/lib/hubs-meta';
import { Center, Spinner } from '@/components/ui/ui';

/** Old stand-alone admin routes (bookmarks, history) land in their tab of the Settings hub. */
export function HubRedirect({ hub, tab }: { hub: string; tab?: string }) {
  const { href } = useI18n();
  const router = useRouter();
  useEffect(() => { router.replace(href(hubUrl(hub, tab))); }, [router, href, hub, tab]);
  return <Center><Spinner /></Center>;
}
