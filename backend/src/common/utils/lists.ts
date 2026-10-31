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
