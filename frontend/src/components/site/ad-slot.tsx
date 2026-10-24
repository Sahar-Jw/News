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
  const label = `${t('ad.label')}: ${ad.owner}`;

  // Side (bronze) ads are small "cards": a white frame, soft shadow, a lift on hover, the sponsor under the picture.
  if (placement === 'bronze') {
    return (
      <a href={ad.link} target="_blank" rel="noopener noreferrer sponsored" aria-label={label} className="group block rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:shadow-lift">
        <span className={`relative block overflow-hidden rounded-xl bg-gray-100 ${SIZE.bronze}`}>
          <AdCarousel images={ad.images} alt={ad.owner} />
          <span className="pointer-events-none absolute start-2 top-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-ink shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            {t('ad.label')}
          </span>
        </span>
        <span className="block truncate px-1.5 pb-1 pt-2 text-center text-[11px] font-medium text-[color:var(--muted)] transition-colors group-hover:text-primary">{ad.owner}</span>
      </a>
    );
  }

  return (
    <a href={ad.link} target="_blank" rel="noopener noreferrer sponsored" aria-label={label} className={`relative block overflow-hidden rounded-xl bg-gray-100 ring-1 ring-line ${SIZE[placement]}`}>
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

/**
 * Side (bronze) ads. Render inside a `relative` wrapper that also holds <main> (see the site layout).
 *
 * - Wide screens (2xl, 1536px+): the ads float in the empty margin beside the page, snug against the content column
 *   (80rem = max-w-7xl, the width every page uses). They are taken out of the layout flow, so <main> keeps its full width and
 *   its centred content stays lined up with the navbar and footer (a column that sat beside <main> used to squeeze it and
 *   push everything off-centre). The width follows the free margin, 116px to 176px. `50%` = half the wrapper's width.
 * - Narrower screens: no room beside the page, so the ads become a tidy centred strip above the footer.
 */
export function AdSide() {
  const { t } = useI18n();
  const ads = useAds('bronze');
  if (!ads.length) return null;
  return (
    <>
      <aside aria-label={t('ad.label')} className="pointer-events-none absolute inset-y-0 end-[max(0.25rem,calc(50%_-_40rem_-_var(--ad-w)_-_0.75rem))] hidden w-[var(--ad-w)] [--ad-w:clamp(7.25rem,calc(50%_-_40rem_-_1rem),11rem)] 2xl:block">
        <div className="pointer-events-auto sticky top-24 space-y-4 py-6">
          {ads.map((a) => <AdBox key={a.id} ad={a} placement="bronze" />)}
        </div>
      </aside>
      <section aria-label={t('ad.label')} className="mx-auto max-w-7xl px-4 py-6 2xl:hidden">
        <div className="mb-3 flex items-center gap-3 text-[11px] font-medium text-[color:var(--muted)]">
          <span>{t('ad.label')}</span>
          <span className="h-px flex-1 bg-line" aria-hidden="true" />
        </div>
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {ads.map((a) => (
            <div key={a.id} className="w-[calc(50%-0.375rem)] sm:w-40">
              <AdBox ad={a} placement="bronze" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
