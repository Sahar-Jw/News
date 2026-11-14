'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { SiteProvider } from '@/components/site/site-context';
import { BackToTop, Footer, Navbar, TopBar } from '@/components/site/shell';
import { FormsInbox } from '@/components/admin/forms-inbox';

/**
 * Management pages open inside the normal site shell (top bar + navbar + footer).
 * There is no separate dashboard or sidebar: what the user can reach is listed in the
 * navbar dropdowns, filtered by their permissions.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const { href } = useI18n();
  const router = useRouter();

  // signed out (or the session ran out while the page was open): log in again, then come back to this page
  useEffect(() => {
    if (loading || me) return;
    const back = window.location.pathname + window.location.search;
    router.replace(href(`/login?next=${encodeURIComponent(back)}`));
  }, [loading, me, router, href]);
  if (loading || !me) return <Center><Spinner /></Center>;

  return (
    <SiteProvider>
      <TopBar />
      <Navbar />
      <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-6"><FormsInbox />{children}</main>
      <Footer />
      <BackToTop />
    </SiteProvider>
  );
}
