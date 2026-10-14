'use client';
import { SiteProvider } from '@/components/site/site-context';
import { BackToTop, Footer, Navbar, TopBar } from '@/components/site/shell';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteProvider>
      <TopBar />
      <Navbar />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
      <BackToTop />
    </SiteProvider>
  );
}
