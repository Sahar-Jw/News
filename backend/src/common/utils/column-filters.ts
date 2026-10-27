import { BadRequestException } from '@nestjs/common';
import { Brackets, ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { escapeLike } from './text';

/** column key sent by the table -> SQL expression(s) it is matched against (several = OR). */
export type ColumnMap = Record<string, string | string[]>;

/**
 * Per-column search of the admin tables. `raw` is a JSON object {"email":"abc","role":"admin"}.
 * Only keys present in `map` are used (whitelist), values are always bound parameters, columns are AND-ed.
 */
export function applyColumnFilters<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, raw: string | undefined, map: ColumnMap) {
  if (!raw) return qb;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new BadRequestException('مرشحات الأعمدة غير صالحة');
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new BadRequestException('مرشحات الأعمدة غير صالحة');
  let i = 0;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const exprs = map[key];
    if (!exprs || typeof val !== 'string') continue;
    const v = val.trim().slice(0, 200);
    if (!v) continue;
    const p = `cf${i++}`;
    const like = `%${escapeLike(v)}%`;
    const list = Array.isArray(exprs) ? exprs : [exprs];
    qb.andWhere(new Brackets((b) => list.forEach((e, n) => (n === 0 ? b.where(`${e} ILIKE :${p}`, { [p]: like }) : b.orWhere(`${e} ILIKE :${p}`, { [p]: like })))));
  }
  return qb;
}
