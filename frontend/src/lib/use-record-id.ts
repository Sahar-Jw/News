'use client';
import { useParams, useSearchParams } from 'next/navigation';

/**
 * The id / slug of the record a detail page shows. Detail pages live at clean addresses (/news/123/, /pages/about/): the value is a path
 * parameter (the folder is [id] or [slug]). Old addresses (/news/view/?id=123) are redirected to them by src/middleware.ts; the query string is
 * still read here so an old link that slips through (a page open in a browser during the update) keeps working.
 */
export function useRecordId(key: 'id' | 'slug' = 'id'): string | null {
  const params = useParams<Record<string, string | string[]>>();
  const search = useSearchParams();
  const raw = params?.[key];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && v !== 'view') {
    try { return decodeURIComponent(v); } catch { return v; }
  }
  return search.get(key);
}
