import { AuditChange } from './audit-context';

const SKIP_KEYS = new Set(['id', 'createdAt', 'updatedAt', 'excerpt']); // the id is on the change record itself
const MAX_STR = 300;
const MAX_JSON = 1000;

/** Makes one value safe and small enough for the audit log. */
export function auditValue(v: any): any {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v.length > MAX_STR ? `${v.slice(0, MAX_STR)}… (${v.length})` : v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'bigint') return Number(v);
  if (Buffer.isBuffer(v)) return undefined;
  try {
    const s = JSON.stringify(v);
    return s.length > MAX_JSON ? `${s.slice(0, MAX_JSON)}… (${s.length})` : v;
  } catch {
    return undefined;
  }
}

/**
 * Plain snapshot of an entity row for the "before" of a delete (own scalar / array / JSON properties only,
 * no relations, no timestamps; passwords and tokens are redacted later by scrubSecrets in AuditService.log).
 */
export function snapshotRow(row: Record<string, any> | null | undefined, omit: string[] = []): Record<string, any> {
  const out: Record<string, any> = {};
  if (!row) return out;
  for (const [k, v] of Object.entries(row)) {
    if (SKIP_KEYS.has(k) || omit.includes(k) || typeof v === 'function') continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) continue; // relation or nested object
    const c = auditValue(v);
    if (c !== undefined) out[k] = c;
  }
  return out;
}

/** What a service passes to AuditService.log() for rows removed with repo.delete() (no TypeORM event fires for it). */
export function removedChanges(table: string, rows: Record<string, any>[], omit: string[] = []): AuditChange[] {
  return rows.map((r) => ({ table, id: r.id ?? null, op: 'remove' as const, before: snapshotRow(r, omit) }));
}
