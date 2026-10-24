'use client';
import { SiteProvider } from '@/components/site/site-context';
import { AdBanner, AdSide } from '@/components/site/ad-slot';
import { BackToTop, Footer, Navbar, TopBar } from '@/components/site/shell';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteProvider>
      <TopBar />
      <Navbar />
      <AdBanner placement="golden" />
      {/* <main> always takes the full width; the bronze ads sit in the side margin (or in a strip below) instead of beside it */}
      <div className="relative">
        <main className="min-h-[60vh] min-w-0">{children}</main>
        <AdSide />
      </div>
      <AdBanner placement="silver" />
      <Footer />
      <BackToTop />
    </SiteProvider>
  );
}
