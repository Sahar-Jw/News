import { EntitySubscriberInterface, EventSubscriber, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { AuditChange, auditRequestContext } from './audit-context';
import { auditValue } from './audit-snapshot';

/** Tables whose rows never go into the audit trail (the log itself, one-time tokens, migration bookkeeping). */
const IGNORED_TABLES = new Set(['audit_logs', 'password_resets', 'typeorm_migrations']);
// timestamps, and values that are derived from another column (news.excerpt is computed from body)
const NOISE_COLUMNS = new Set(['createdAt', 'updatedAt', 'excerpt']);
const MAX_CHANGES_PER_REQUEST = 50;

function pk(meta: { primaryColumns: ColumnMetadata[] }, ...rows: any[]): number | string | null {
  for (const r of rows) {
    if (!r) continue;
    const v = meta.primaryColumns[0]?.getEntityValue(r);
    if (v !== undefined && v !== null) return typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
  }
  return null;
}

function snap(columns: ColumnMetadata[], row: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const c of columns) {
    if (c.isPrimary || NOISE_COLUMNS.has(c.propertyName)) continue; // the id is already on the change record
    const v = auditValue(c.getEntityValue(row));
    if (v !== undefined) out[c.propertyName] = v;
  }
  return out;
}

/**
 * Records, for the request being served, what every repository.save()/remove() really changed:
 * the full row on insert, only the changed fields (old and new value) on update, the full row on remove.
 * AuditService.log() attaches the matching entries to the audit row, so the existing call sites need no changes.
 * Outside an HTTP request (seed, scripts) there is no context and nothing is recorded.
 */
@EventSubscriber()
export class AuditChangeSubscriber implements EntitySubscriberInterface {
  private push(change: AuditChange) {
    const state = auditRequestContext.getStore();
    if (!state) return;
    const list = (state.changes ??= []);
    if (list.length < MAX_CHANGES_PER_REQUEST) list.push(change);
  }

  afterInsert(e: InsertEvent<any>) {
    const table = e.metadata.tableName;
    if (IGNORED_TABLES.has(table) || !e.entity) return;
    this.push({ table, id: pk(e.metadata, e.entity), op: 'insert', after: snap(e.metadata.columns, e.entity) });
  }

  afterUpdate(e: UpdateEvent<any>) {
    const table = e.metadata.tableName;
    if (IGNORED_TABLES.has(table) || !e.entity || !e.databaseEntity) return;
    const cols = (e.updatedColumns ?? []).filter((c) => !NOISE_COLUMNS.has(c.propertyName));
    if (!cols.length) return;
    const before: Record<string, any> = {};
    const after: Record<string, any> = {};
    for (const c of cols) {
      const b = auditValue(c.getEntityValue(e.databaseEntity));
      const a = auditValue(c.getEntityValue(e.entity));
      if (JSON.stringify(b) === JSON.stringify(a)) continue;
      before[c.propertyName] = b ?? null;
      after[c.propertyName] = a ?? null;
    }
    if (!Object.keys(after).length) return;
    this.push({ table, id: pk(e.metadata, e.entity, e.databaseEntity), op: 'update', before, after });
  }

  afterRemove(e: RemoveEvent<any>) {
    const table = e.metadata.tableName;
    const row = e.databaseEntity ?? e.entity;
    if (IGNORED_TABLES.has(table) || !row) return;
    this.push({ table, id: e.entityId ?? pk(e.metadata, row), op: 'remove', before: snap(e.metadata.columns, row) });
  }
}
