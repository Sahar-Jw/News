'use client';
import { useI18n } from '@/lib/i18n';

/** Responsive 16:9 YouTube player (privacy-enhanced domain, lazy loaded) with a small header and an "open on YouTube" link. */
export function YoutubeEmbed({ id, title }: { id: string; title: string }) {
  const { t } = useI18n();
  return (
    <figure className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-red-600 text-white shadow-sm">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M8 5v14l11-7z" /></svg>
          </span>
          <figcaption className="text-sm font-bold text-gray-800">{t('site.video')}</figcaption>
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${id}`}
          target="_blank"
          rel="noopener noreferrer"
          dir="ltr"
          className="text-xs font-medium text-gray-500 transition hover:text-primary"
        >
          {t('site.openYoutube')} ↗
        </a>
      </div>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-lift ring-1 ring-black/10">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    </figure>
  );
}
