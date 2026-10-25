'use client';
import { SiteProvider } from '@/components/site/site-context';
import { AdBanner } from '@/components/site/ad-slot';
import { BackToTop, Footer, Navbar, TopBar } from '@/components/site/shell';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteProvider>
      <TopBar />
      <Navbar />
      <AdBanner placement="golden" />
      {/* bronze ads are shown in the middle of the home page (see <AdMiddle /> in the home page) */}
      <main className="min-h-[60vh] min-w-0">{children}</main>
      <AdBanner placement="silver" />
      <Footer />
      <BackToTop />
    </SiteProvider>
  );
}
