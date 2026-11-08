/**
 * jsonb list columns (news.topics, news.images ...) should hold a JSON array, but rows imported with SQL / from an
 * older database can hold a JSON string ("a,b" or "[\"a\"]"), an object or null. Anything that is not a list of strings
 * is repaired here so one bad row can never crash a page (".join is not a function").
 */
export function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.startsWith('[')) {
      try {
        return toStringArray(JSON.parse(s));
      } catch {
        /* fall through: treat as plain text */
      }
    }
    return s ? s.split(',').map((x) => x.trim()).filter(Boolean) : [];
  }
  return [];
}

/** All PDFs of a news record: the `pdfs` list, or the single legacy `pdf` when the list is empty (e.g. rows written by the documents module). */
export function pdfList(n: { pdf?: string | null; pdfs?: unknown }): string[] {
  const l = toStringArray(n.pdfs);
  return l.length ? l : n.pdf ? [n.pdf] : [];
}
