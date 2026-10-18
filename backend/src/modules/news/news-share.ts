const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SharePageData {
  title: string;
  description: string;
  image: string;
  lang: string;
  /** absolute URL of this very page (what people paste into Facebook / WhatsApp / LinkedIn) */
  shareUrl: string;
  /** where a real visitor ends up: the news page of the website */
  target: string;
  nonce: string;
}

/**
 * Tiny HTML page with Open Graph / Twitter tags. The website is a static export (no server rendering), so link
 * previews can only come from here: crawlers read the tags, browsers are sent on to the real article.
 */
export function renderSharePage(d: SharePageData): string {
  const t = esc(d.title);
  const desc = esc(d.description);
  const og = [
    ['og:type', 'article'],
    ['og:title', d.title],
    ['og:description', d.description],
    ['og:url', d.shareUrl],
    ['og:locale', d.lang === 'ar' ? 'ar_AR' : 'en_US'],
    ...(d.image ? [['og:image', d.image]] : []),
    ['twitter:card', d.image ? 'summary_large_image' : 'summary'],
    ['twitter:title', d.title],
    ['twitter:description', d.description],
    ...(d.image ? [['twitter:image', d.image]] : []),
  ]
    .map(([k, v]) => `<meta property="${k}" content="${esc(v)}">`)
    .join('\n');
  return `<!doctype html>
<html lang="${esc(d.lang)}" dir="${d.lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${desc}">
${og}
<meta name="robots" content="noindex">
</head>
<body style="font-family:Arial,sans-serif;padding:2rem">
<h1 style="font-size:1.25rem">${t}</h1>
<p><a href="${esc(d.target)}">${esc(d.target)}</a></p>
<script nonce="${d.nonce}">location.replace(${JSON.stringify(d.target).replace(/</g, '\\u003c')});</script>
</body>
</html>`;
}
