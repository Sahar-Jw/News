import { createInterface } from 'readline';
import { Readable } from 'stream';
import { SchemaInfo, TableCol } from './backup-schema';

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** PostgreSQL array literal: {a,"b c",NULL,{1,2}} */
function pgArray(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (Array.isArray(v)) return `{${v.map(pgArray).join(',')}}`;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** one value as an SQL literal, by the type of its column */
function sqlValue(v: unknown, type: string): string {
  if (v === null || v === undefined) return 'NULL';
  if (type.endsWith('[]') && Array.isArray(v)) return lit(pgArray(v));
  if (type === 'json' || type === 'jsonb') return lit(JSON.stringify(v));
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : lit(String(v));
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return lit(v);
  return lit(JSON.stringify(v));
}

const ROWS_PER_INSERT = 100;

/**
 * NDJSON backup (decrypted + gunzipped) -> a readable, importable SQL script, in this order:
 *   1. structure   CREATE TYPE / SEQUENCE / TABLE IF NOT EXISTS   (so it also imports into an EMPTY database)
 *   2. data        TRUNCATE, then INSERT INTO "table" ("col", ...) VALUES (...) one row per line, columns in the table's own order
 *   3. finishing   sequences, foreign keys, indexes
 * Tables come parents-first. Everything runs in ONE transaction: if anything fails, nothing is changed.
 */
export function ndjsonToSql(input: Readable, getSchema: (schema: string, tables: string[]) => Promise<SchemaInfo>): Readable {
  async function* gen() {
    const rl = createInterface({ input, crlfDelay: Infinity });
    let schema = 'public';
    let info: SchemaInfo = { pre: '', post: '', columns: new Map() };
    let table = '';
    let cols: { name: string; type: string }[] = [];
    let overriding = false;
    let pending: string[] = [];
    let header = false;
    let ended = false;
    const flush = () => {
      if (!pending.length) return '';
      const sql = `INSERT INTO ${q(schema)}.${q(table)} (${cols.map((c) => q(c.name)).join(', ')})${overriding ? ' OVERRIDING SYSTEM VALUE' : ''} VALUES\n${pending.join(',\n')};\n`;
      pending = [];
      return sql;
    };
    for await (const line of rl) {
      if (!line) continue;
      const o = JSON.parse(line);
      if (o.kind === 'header') {
        header = true;
        schema = o.schema || 'public';
        const tables: string[] = o.tables || [];
        info = await getSchema(schema, tables);
        yield `-- ============================================================================\n-- Database backup  ${o.createdAt ?? ''}\n-- ${tables.length} tables\n-- ============================================================================\n--\n-- HOW TO IMPORT: run this whole file on the target PostgreSQL database (pgAdmin Query Tool, or\n--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f this-file.sql ).\n--   * an EMPTY database: the tables are created, then filled.\n--   * the app's own database: the existing tables are kept, EMPTIED, and filled with the backup's data.\n-- It runs as ONE transaction: if anything fails, nothing is changed.\n-- ============================================================================\n\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nBEGIN;\n\n-- ---------------------------------------------------------------------------- 1. structure\n${schema !== 'public' ? `CREATE SCHEMA IF NOT EXISTS ${q(schema)};\n` : ''}SET search_path TO ${q(schema)};\n\n${info.pre}\n\n-- ---------------------------------------------------------------------------- 2. data\n`;
        if (tables.length) yield `\nTRUNCATE ${tables.map((t) => `${q(schema)}.${q(t)}`).join(', ')} RESTART IDENTITY CASCADE;\n`;
        continue;
      }
      if (o.kind === 'end') { ended = true; continue; }
      if (!header) throw new Error('Not a backup file (no header).');
      if (o.t !== table) {
        const f = flush();
        if (f) yield f;
        table = o.t;
        // the columns of this table: the real ones in their real order (only those the backup has a value for); without a catalog entry, the row's own order
        const real: TableCol[] | undefined = info.columns.get(table);
        const have = new Set(Object.keys(o.r));
        cols = real ? real.filter((c) => !c.generated && have.has(c.name)).map((c) => ({ name: c.name, type: c.type })) : [...have].map((name) => ({ name, type: '' }));
        overriding = !!real?.some((c) => c.alwaysIdentity);
        yield `\n-- ---- ${table}\n`;
      }
      pending.push(`(${cols.map((c) => sqlValue(o.r[c.name], c.type)).join(', ')})`);
      if (pending.length >= ROWS_PER_INSERT) yield flush();
    }
    const f = flush();
    if (f) yield f;
    if (!ended) throw new Error('The backup is incomplete (no end marker): the file was cut or damaged.');
    yield `
-- ---------------------------------------------------------------------------- 3. sequences, foreign keys, indexes
DO $restore$
DECLARE s record;
BEGIN
  FOR s IN SELECT table_name AS t, column_name AS c FROM information_schema.columns
           WHERE table_schema = ${lit(schema)} AND (column_default LIKE 'nextval(%' OR is_identity = 'YES')
  LOOP
    EXECUTE format('SELECT setval(pg_get_serial_sequence(%L, %L), COALESCE((SELECT MAX(%I) FROM %I.%I), 1), (SELECT MAX(%I) IS NOT NULL FROM %I.%I))',
      quote_ident(${lit(schema)}) || '.' || quote_ident(s.t), s.c, s.c, ${lit(schema)}, s.t, s.c, ${lit(schema)}, s.t);
  END LOOP;
END
$restore$;

${info.post}

COMMIT;
`;
  }
  return Readable.from(gen());
}
