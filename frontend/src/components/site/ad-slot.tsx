'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { FitImage } from './cards';

export type AdPlacement = 'golden' | 'bronze' | 'silver';
interface PublicAd { id: number; placement: AdPlacement; owner: string; link: string; images: string[] }

// one request for all placements, shared by every slot on the page (refreshed after a minute)
let cache: { at: number; p: Promise<PublicAd[]> } | null = null;
function loadAds() {
  if (!cache || Date.now() - cache.at > 60_000) cache = { at: Date.now(), p: api<PublicAd[]>('/public/ads').catch(() => [] as PublicAd[]) };
  return cache.p;
}
function useAds(placement: AdPlacement) {
  const [ads, setAds] = useState<PublicAd[]>([]);
  useEffect(() => {
    let live = true;
    loadAds().then((all) => { if (live) setAds(all.filter((a) => a.placement === placement && a.images.length > 0)); });
    return () => { live = false; };
  }, [placement]);
  return ads;
}

/** Several pictures: they cross-fade by themselves (no arrows). One picture: shown still. */
function AdCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const n = images.length;
  useEffect(() => {
    setI(0);
    if (n < 2) return;
    const timer = setInterval(() => setI((x) => (x + 1) % n), 4000);
    return () => clearInterval(timer);
  }, [n]);
  return (
    <>
      {images.map((im, k) => (
        <div key={im} className={`absolute inset-0 transition-opacity duration-700 ${k === i ? 'opacity-100' : 'opacity-0'}`} aria-hidden={k !== i}>
          <FitImage src={im} alt={k === i ? alt : ''} />
        </div>
      ))}
    </>
  );
}

const SIZE: Record<AdPlacement, string> = {
  golden: 'h-24 sm:h-32 md:h-40', // top banner
  silver: 'h-20 sm:h-28 md:h-32', // bottom banner
  bronze: 'aspect-[3/5] w-full', // side column
};

function AdBox({ ad, placement }: { ad: PublicAd; placement: AdPlacement }) {
  const { t } = useI18n();
  if (!/^https?:\/\//i.test(ad.link)) return null; // the API only stores http(s) links; this is a second guard
  return (
    <a href={ad.link} target="_blank" rel="noopener noreferrer sponsored" aria-label={`${t('ad.label')}: ${ad.owner}`} className={`relative block overflow-hidden rounded-xl bg-gray-100 ring-1 ring-line ${SIZE[placement]}`}>
      <AdCarousel images={ad.images} alt={ad.owner} />
      <span className="pointer-events-none absolute end-1.5 top-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{t('ad.label')}</span>
    </a>
  );
}

/** Top (golden) or bottom (silver) banner. Renders nothing when no ad is running there. */
export function AdBanner({ placement }: { placement: 'golden' | 'silver' }) {
  const ads = useAds(placement);
  if (!ads.length) return null;
  return <div className="mx-auto max-w-7xl space-y-3 px-4 py-3">{ads.map((a) => <AdBox key={a.id} ad={a} placement={placement} />)}</div>;
}

/** Side (bronze) column: sticky beside the page on wide screens, a row above the footer on small ones. */
export function AdSide() {
  const { t } = useI18n();
  const ads = useAds('bronze');
  if (!ads.length) return null;
  return (
    <>
      <aside className="sticky top-24 hidden w-44 shrink-0 space-y-3 self-start py-6 pe-4 xl:block" aria-label={t('ad.label')}>
        {ads.map((a) => <AdBox key={a.id} ad={a} placement="bronze" />)}
      </aside>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-3 xl:hidden">
        {ads.map((a) => <AdBox key={a.id} ad={a} placement="bronze" />)}
      </div>
    </>
  );
}
