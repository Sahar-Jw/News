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

/** Client-side pagination of a list that is already loaded: the slice of the current page and the page count (the page is clamped when the list shrinks). */
export function paginate<T>(items: T[], page: number, size: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), totalPages);
  return { rows: items.slice((current - 1) * size, current * size), page: current, totalPages, total: items.length };
}
