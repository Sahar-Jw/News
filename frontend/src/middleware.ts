import { NextRequest, NextResponse } from 'next/server';

/**
 * Old detail addresses → clean ones, with a permanent redirect and without the old query string:
 *   /ar/news/view/?id=12      → /ar/news/12/        (also documents, gallery, services, training, occasions, committees, board)
 *   /ar/pages/view/?slug=about → /ar/pages/about/
 *   /ar/forms/?slug=contact    → /ar/forms/contact/
 * They were made for static hosting, where a page could not have a path per record. A path is never mixed up by a cache or CDN that ignores
 * query strings (the usual reason why "some pages do not open"), can be shared, and is what search engines index. Old bookmarks, e-mails that
 * were already sent and menu items saved in the database keep working through this redirect.
 */
const ID_KINDS = new Set(['news', 'documents', 'gallery', 'services', 'training', 'occasions', 'committees', 'board']);

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const [, lang, kind, last] = pathname.split('/');
  if (lang !== 'ar' && lang !== 'en') return NextResponse.next();

  let target: string | null = null;
  if (ID_KINDS.has(kind) && last === 'view') {
    const id = searchParams.get('id');
    if (id && /^[0-9]{1,12}$/.test(id)) target = `/${lang}/${kind}/${id}/`;
  } else if (kind === 'pages' && last === 'view') {
    const slug = searchParams.get('slug');
    if (slug && /^[A-Za-z0-9_-]{1,80}$/.test(slug)) target = `/${lang}/pages/${slug}/`;
  } else if (kind === 'forms' && (last === undefined || last === '')) {
    const slug = searchParams.get('slug');
    if (slug && /^[A-Za-z0-9_-]{1,80}$/.test(slug)) target = `/${lang}/forms/${slug}/`;
  }
  if (!target) return NextResponse.next();

  // The address the visitor really used: behind Docker / a proxy the host Next.js knows (HOSTNAME=0.0.0.0 -> "localhost") is not it.
  const first = (v: string | null) => (v ?? '').split(',')[0].trim();
  const host = first(req.headers.get('x-forwarded-host')) || first(req.headers.get('host'));
  const proto = first(req.headers.get('x-forwarded-proto'));
  const origin = /^[A-Za-z0-9.\-:\[\]]{1,255}$/.test(host) ? `${proto === 'http' || proto === 'https' ? proto : req.nextUrl.protocol.replace(':', '')}://${host}` : req.nextUrl.origin;
  return NextResponse.redirect(new URL(target, origin), 308);
}

export const config = { matcher: ['/:lang(ar|en)/:path*'] };
