'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_URL, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { useI18n } from '@/lib/i18n';
import { SECTIONS, fmtDate, fmtNum, newsPerm, shareLinks } from '@/lib/utils';
import { ContactIcon, SocialIcon } from './icons';

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
  /** attached PDF (detail page only) */
  pdf?: string | null;
  language: string;
}

/** Newspaper icon used when a news item has no picture. */
export function NewsGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
    </svg>
  );
}

export function Thumb({ src, className = '', alt = '' }: { src?: string | null; className?: string; alt?: string }) {
  if (src) return <img src={fileUrl(src)} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
  return <div className={`flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20 text-primary/50 ${className}`} aria-hidden><NewsGlyph className="h-10 w-10" /></div>;
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

/**
 * Image that is never stretched or cropped: shown whole (object-contain) over a blurred copy of itself,
 * so any aspect ratio fills the frame. The parent must be `relative` with a fixed size.
 */
export function FitImage({ src, alt = '' }: { src?: string | null; alt?: string }) {
  if (!src) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/60 to-secondary" aria-hidden>
        <NewsGlyph className="h-1/3 w-1/3 max-h-32 max-w-32 text-white/40" />
      </div>
    );
  }
  const url = fileUrl(src);
  return (
    <>
      <img src={url} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl" />
      <img src={url} alt={alt} className="absolute inset-0 h-full w-full object-contain" />
    </>
  );
}

/**
 * Share buttons. They point at the API's share page (/public/news/:id/share): it carries the Open Graph tags
 * (title, description, picture) that Facebook / WhatsApp / LinkedIn need, then sends visitors on to the article.
 */
export function ShareRow({ id, title }: { id: number; title: string }) {
  const { t, href } = useI18n();
  const toast = useToast();
  const url = `${API_URL}/public/news/${id}/share`;
  const l = shareLinks(url, title);
  const [native, setNative] = useState(false);
  // plain link to the article itself (no preview page in between) – paste it anywhere
  const copy = async () => {
    const link = `${window.location.origin}${href(`/news/view?id=${id}`)}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // http / old browsers: select-and-copy fallback
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } finally { ta.remove(); }
    }
    toast(t('site.copied'));
  };
  useEffect(() => setNative(typeof navigator !== 'undefined' && typeof navigator.share === 'function'), []);
  const items: [string, React.ReactNode, string][] = [
    ['facebook', <SocialIcon key="f" name="facebook_url" size={12} />, l.facebook],
    ['whatsapp', <SocialIcon key="w" name="whatsapp_url" size={12} />, l.whatsapp],
    ['linkedin', <SocialIcon key="l" name="linkedin_url" size={12} />, l.linkedin],
    ['email', <ContactIcon key="e" name="email" size={12} />, l.email],
  ];
  const cls = 'flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 hover:bg-primary hover:text-white';
  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <span className="me-1">{t('site.share')}</span>
      {native && (
        <button type="button" aria-label={t('site.share')} title={t('site.share')} className={cls} onClick={() => navigator.share({ title, url }).catch(() => {})}>
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>
        </button>
      )}
      {items.map(([k, icon, h]) => (
        <a key={k} href={h} target="_blank" rel="noopener noreferrer" aria-label={`${t('site.share')} ${k}`} title={k} className={cls}>{icon}</a>
      ))}
      <button type="button" aria-label={t('site.copyLink')} title={t('site.copyLink')} className={cls} onClick={copy}>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      </button>
    </div>
  );
}

/** Characters shown from the excerpt before the "…" (about two lines in a card; change to taste). */
const EXCERPT_CHARS = 90;
function shortExcerpt(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= EXCERPT_CHARS) return clean;
  return clean.slice(0, EXCERPT_CHARS).replace(/\s+\S*$/, '') + '…';
}

/**
 * The whole card opens the news: the title link is stretched over the card (after:absolute inset-0),
 * and the links that do something else (category, subcategory, share) sit above it with `relative z-10`.
 */
export function NewsCard({ n }: { n: Card }) {
  const { href, lang, t } = useI18n();
  const { can } = useAuth();
  const link = href(`/news/view?id=${n.id}`);
  const section = (SECTIONS as readonly string[]).includes(n.mainCategory) ? n.mainCategory : '';
  const mayEdit = can(newsPerm('update', section));
  const chip = 'z-10 transition hover:bg-primary hover:text-white';
  return (
    <article className="card-accent group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:shadow-lift hover:ring-primary/25">
      <div className="relative block overflow-hidden">
        <Thumb src={n.images[0]} alt={n.title} className="aspect-[16/10] w-full transition-transform duration-700 ease-out group-hover:scale-105" />
        <div className="absolute start-3 top-3 z-10 flex items-center gap-1.5">
          <Link href={href(`/news?category=${encodeURIComponent(n.mainCategory)}`)} className={`${chip} flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-secondary shadow-sm backdrop-blur`}>
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />{n.mainCategory}
          </Link>
          {mayEdit && <Link href={href(`/admin/news/edit?id=${n.id}${section ? `&section=${section}` : ''}`)} className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:brightness-110">{t('app.edit')}</Link>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="line-clamp-2 text-sm font-bold leading-[1.8] transition group-hover:text-primary"><Link href={link} className="after:absolute after:inset-0 after:content-['']">{n.title}</Link></h3>
        {n.subject && <p className="line-clamp-1 text-sm font-medium text-[color:var(--muted)]">{n.subject}</p>}
        {n.excerpt && <p className="line-clamp-2 text-sm leading-7 text-gray-600">{shortExcerpt(n.excerpt)}</p>}
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-gray-500">
          <span>{fmtDate(lang, n.publishAt)}</span>
          <span>👁 {fmtNum(lang, n.viewCount)} {t('site.views')}</span>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          {n.subcategory ? (
            <Link href={href(`/news?subcategory=${encodeURIComponent(n.subcategory)}`)} className={`${chip} relative min-w-0 truncate rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary`}>{n.subcategory}</Link>
          ) : <span />}
          <div className="relative z-10 shrink-0"><ShareRow id={n.id} title={n.title} /></div>
        </div>
      </div>
    </article>
  );
}
