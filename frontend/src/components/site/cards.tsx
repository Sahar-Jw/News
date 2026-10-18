'use client';
import Link from 'next/link';
import { fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { fmtDate, fmtNum, shareLinks } from '@/lib/utils';

export interface Card {
  id: number;
  title: string;
  subject: string | null;
  mainCategory: string;
  subcategory: string | null;
  topics: string[];
  excerpt: string;
  images: string[];
  rating: number | null;
  publishAt: string | null;
  viewCount: number;
  body?: string | null;
  language: string;
}

export function Thumb({ src, className = '', alt = '' }: { src?: string | null; className?: string; alt?: string }) {
  if (src) return <img src={fileUrl(src)} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
  return <div className={`flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 text-3xl text-primary/40 ${className}`} aria-hidden>▤</div>;
}

/** Default picture for a testimonial that has no image: a neutral person silhouette (inline, so nothing to host). */
export function DefaultAvatar({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="" className={`shrink-0 ${className}`}>
      <rect width="64" height="64" fill="#e5e7eb" />
      <circle cx="32" cy="24" r="11" fill="#9ca3af" />
      <path d="M10 64c0-13 10-22 22-22s22 9 22 22z" fill="#9ca3af" />
    </svg>
  );
}

export function ShareRow({ id, title }: { id: number; title: string }) {
  const { href, t } = useI18n();
  const url = typeof window !== 'undefined' ? `${location.origin}${href(`/news/view?id=${id}`)}` : '';
  const l = shareLinks(url, title);
  const items: [string, string, string][] = [['facebook', 'f', l.facebook], ['whatsapp', 'wa', l.whatsapp], ['linkedin', 'in', l.linkedin], ['email', '✉', l.email]];
  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <span className="me-1">{t('site.share')}</span>
      {items.map(([k, ic, h]) => (
        <a key={k} href={h} target="_blank" rel="noopener noreferrer" aria-label={`${t('site.share')} ${k}`} className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold hover:bg-primary hover:text-white">{ic}</a>
      ))}
    </div>
  );
}

export function NewsCard({ n }: { n: Card }) {
  const { href, lang, t } = useI18n();
  const link = href(`/news/view?id=${n.id}`);
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md">
      <Link href={link} className="relative block">
        <Thumb src={n.images[0]} alt={n.title} className="h-44 w-full" />
        <span className="absolute start-2 top-2 rounded bg-primary px-2 py-0.5 text-xs text-white">{n.mainCategory}</span>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link href={link}><h3 className="line-clamp-2 text-base font-bold leading-snug hover:text-primary">{n.title}</h3></Link>
        {n.subject && <p className="line-clamp-1 text-sm font-medium text-gray-500">{n.subject}</p>}
        {n.excerpt && <p className="line-clamp-3 text-sm text-gray-600">{n.excerpt}</p>}
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-gray-500">
          <span>{fmtDate(lang, n.publishAt)}</span>
          <span>👁 {fmtNum(lang, n.viewCount)} {t('site.views')}</span>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <Link href={link} className="text-sm font-semibold text-primary">{t('site.readMore')} →</Link>
          <ShareRow id={n.id} title={n.title} />
        </div>
      </div>
    </article>
  );
}
