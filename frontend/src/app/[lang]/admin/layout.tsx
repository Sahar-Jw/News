'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Center, Spinner } from '@/components/ui/ui';
import { SiteProvider } from '@/components/site/site-context';
import { BackToTop, Footer, Navbar, TopBar } from '@/components/site/shell';

/**
 * Management pages open inside the normal site shell (top bar + navbar + footer).
 * There is no separate dashboard or sidebar: what the user can reach is listed in the
 * navbar dropdowns, filtered by their permissions.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();
  const { href } = useI18n();
  const router = useRouter();

  useEffect(() => { if (!loading && !me) router.replace(href('/login')); }, [loading, me, router, href]);
  if (loading || !me) return <Center><Spinner /></Center>;

  return (
    <SiteProvider>
      <TopBar />
      <Navbar />
      <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-6">{children}</main>
      <Footer />
      <BackToTop />
    </SiteProvider>
  );
}
