/** A jsonb list that may come back as a string / object / null from an old row -> always a string[] (never crashes .join/.map). */
export function asList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.startsWith('[')) {
      try {
        return asList(JSON.parse(s));
      } catch {
        /* plain text */
      }
    }
    return s ? s.split(',').map((x) => x.trim()).filter(Boolean) : [];
  }
  return [];
}
