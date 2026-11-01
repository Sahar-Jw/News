import sanitizeHtmlLib from 'sanitize-html';

export function normalizeLabel(v: string): string {
  return (v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** "Company Overview" -> "COMPANY_OVERVIEW" (used to detect reserved codes) */
export function codeKey(v: string): string {
  return normalizeLabel(v).toUpperCase().replace(/ /g, '_');
}

export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => '\\' + m);
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtmlLib(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerpt(html: string | null | undefined, max = 180): string {
  const t = stripHtml(html);
  return t.length > max ? t.slice(0, max).trimEnd() + '…' : t;
}

/** The phrase that promotes a news item to the home "featured" carousel when it is mentioned in it. */
const CHAMBER_HEAD_RE = /رئيس[\s ]+الغرفة/;

/**
 * True when the news text mentions "رئيس الغرفة" (title, subject or body). Diacritics and tatweel are ignored and any
 * run of spaces counts, so "رئيــس  الغرفة" matches too; attached prefixes ("ورئيس الغرفة", "لرئيس الغرفة") match as well.
 * The database column `news.mentions_chamber_head` stores this result, so the home page never has to scan the bodies.
 */
export function mentionsChamberHead(title: string | null | undefined, subject: string | null | undefined, body: string | null | undefined): boolean {
  const text = `${title ?? ''} ${subject ?? ''} ${stripHtml(body)}`.normalize('NFC').replace(/[ـً-ٰٟ]/g, '');
  return CHAMBER_HEAD_RE.test(text);
}

/** SRS 13.6 – server-side whitelist sanitisation of rich text. */
export function sanitizeRichText(html: string | null | undefined): string | null {
  if (html == null) return null;
  return sanitizeHtmlLib(html, {
    allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'blockquote'],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'], '*': ['dir'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Remove secrets from audit details (SRS FR-LOG-001). */
export function scrubSecrets(input: any, depth = 0): any {
  if (input == null || depth > 5) return input;
  if (Array.isArray(input)) return input.map((v) => scrubSecrets(v, depth + 1));
  if (typeof input === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = /pass(word)?|token|secret|hash|authorization|cookie/i.test(k) ? '[REDACTED]' : scrubSecrets(v, depth + 1);
    }
    return out;
  }
  return input;
}
