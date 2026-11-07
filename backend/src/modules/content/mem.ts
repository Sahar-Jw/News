import { BadRequestException } from '@nestjs/common';
import { adminPage, paged } from '../../common/utils/pagination';

const lc = (v: unknown) => String(v ?? '').toLowerCase();

/** Case-insensitive "contains" on any of the texts (what ILIKE '%q%' did). */
export const matches = (texts: unknown[], q: string) => {
  const needle = lc(q.trim());
  return !needle || texts.some((t) => lc(t).includes(needle));
};

/**
 * Per-column search of the admin tables, in memory. `raw` is the JSON object the table sends ({"questionAr":"abc"}); only keys of
 * `accessors` are used, columns are AND-ed, several texts for one column are OR-ed.
 */
export function filterByCf<T>(rows: T[], raw: string | undefined, accessors: Record<string, (r: T) => unknown[]>): T[] {
  if (!raw) return rows;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new BadRequestException('مرشحات الأعمدة غير صالحة');
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new BadRequestException('مرشحات الأعمدة غير صالحة');
  let out = rows;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const acc = accessors[key];
    if (!acc || typeof val !== 'string') continue;
    const v = val.trim().slice(0, 200);
    if (!v) continue;
    out = out.filter((r) => matches(acc(r), v));
  }
  return out;
}

/** One admin page of already filtered + sorted rows, in the shape every admin table expects. */
export function pageRows<T, R>(rows: T[], q: { page?: number; limit?: string }, present: (r: T) => R) {
  const p = adminPage(q);
  return paged(rows.slice(p.skip, p.skip + p.limit).map(present), rows.length, p);
}

/** compare helpers for sort(): numbers ascending / descending, strings in the Arabic-friendly order */
export const by = <T>(...keys: ((r: T) => number | string)[]) => (a: T, b: T) => {
  for (const k of keys) {
    const x = k(a), y = k(b);
    if (x === y) continue;
    return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
  }
  return 0;
};
export const desc = <T>(k: (r: T) => number | string) => (r: T) => (typeof k(r) === 'number' ? -(k(r) as number) : k(r));
