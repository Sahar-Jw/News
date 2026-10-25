'use client';
import { useEffect, useState } from 'react';
import { api, onSiteChange } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { FitImage } from './cards';

export type AdPlacement = 'golden' | 'bronze' | 'silver';
interface PublicAd { id: number; placement: AdPlacement; owner: string; link: string; images: string[] }

// ---- live ad store -------------------------------------------------------------------------------------------------
// One request serves every slot on the page. It is re-run (not cached) whenever something changes:
//  - right after an admin add / edit / delete / switch (this tab, or another tab of the same browser)
//  - when the tab regains focus
//  - every 30 s, so another device's change (or an ad that just started / expired by date) shows up on its own
let current: PublicAd[] | null = null;
let loadedAt = 0;
let running: Promise<void> | null = null;
let again = false;
const subscribers = new Set<() => void>();

function refreshAds(): Promise<void> {
  if (running) { again = true; return running; } // a change arrived while loading: load once more afterwards
  running = api<PublicAd[]>('/public/ads', { cache: 'no-store' })
    .then((all) => { current = all; })
    .catch(() => { if (current === null) current = []; })
    .finally(() => {
      loadedAt = Date.now();
      running = null;
      subscribers.forEach((f) => f());
      if (again) { again = false; void refreshAds(); }
    });
  return running;
}

function startWatching() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const soon = () => { clearTimeout(timer); timer = setTimeout(() => void refreshAds(), 150); };
  const onVisible = () => { if (document.visibilityState === 'visible') soon(); };
  const off = onSiteChange(soon);
  const poll = setInterval(() => { if (document.visibilityState === 'visible') void refreshAds(); }, 30_000);
  window.addEventListener('focus', soon);
  document.addEventListener('visibilitychange', onVisible);
  return () => { clearTimeout(timer); clearInterval(poll); off(); window.removeEventListener('focus', soon); document.removeEventListener('visibilitychange', onVisible); };
}

let stopWatching: (() => void) | null = null;

function useAds(placement: AdPlacement) {
  const [all, setAll] = useState<PublicAd[]>(current ?? []);
  useEffect(() => {
    const sync = () => setAll(current ?? []);
    subscribers.add(sync);
    if (subscribers.size === 1) stopWatching = startWatching(); // watchers run once, however many slots are on the page
    if (!running && (current === null || Date.now() - loadedAt > 5_000)) void refreshAds();
    else sync();
    return () => {
      subscribers.delete(sync);
      if (subscribers.size === 0) { stopWatching?.(); stopWatching = null; }
    };
  }, []);
  return all.filter((a) => a.placement === placement && a.images.length > 0);
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
  bronze: 'aspect-[4/3] w-full', // middle-of-the-page card
};

function AdBox({ ad, placement }: { ad: PublicAd; placement: AdPlacement }) {
  const { t } = useI18n();
  if (!/^https?:\/\//i.test(ad.link)) return null; // the API only stores http(s) links; this is a second guard
  const label = `${t('ad.label')}: ${ad.owner}`;

  // Middle (bronze) ads are cards: a white frame, soft shadow, a lift on hover, the sponsor under the picture.
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
 * Middle (bronze) ads: a centred strip of cards. The home page places it between its sections, halfway down the page.
 * Renders nothing when no bronze ad is running.
 */
export function AdMiddle() {
  const { t } = useI18n();
  const ads = useAds('bronze');
  if (!ads.length) return null;
  return (
    <section aria-label={t('ad.label')} className="mx-auto max-w-7xl px-4 py-6 md:py-8">
      <div className="mb-3 flex items-center gap-3 text-[11px] font-medium text-[color:var(--muted)]">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <span>{t('ad.label')}</span>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {ads.map((a) => (
          <div key={a.id} className="w-full max-w-xs sm:max-w-sm">
            <AdBox ad={a} placement="bronze" />
          </div>
        ))}
      </div>
    </section>
  );
}
