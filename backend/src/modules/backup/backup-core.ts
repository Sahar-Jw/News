import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { createGunzip, createGzip } from 'zlib';
import { pipeline as pipelineP } from 'stream/promises';
import { pipeline } from 'stream';
import { Readable } from 'stream';
import { createInterface } from 'readline';
import { DataSource } from 'typeorm';

/**
 * Framework-free core of the backup: used by the BackupService (dashboard / schedule) and by the restore command-line script.
 * Format: NDJSON, gzip-compressed, optionally AES-256-GCM encrypted (BACKUP_ENCRYPTION_KEY):
 *   {"kind":"header",...} / {"t":"table","r":{row}} ... / {"kind":"end","rows":N}
 * Tables are written parents-first (foreign-key order), so a restore can insert them in file order.
 */
const MAGIC = Buffer.from('DCCBK1');
const BATCH = 2000;
const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

export const backupKey = (): Buffer | null => {
  const k = (process.env.BACKUP_ENCRYPTION_KEY ?? '').trim();
  return k ? createHash('sha256').update(k).digest() : null;
};

/** Writes `src` to `dest`, encrypting it when a key is set. Layout: MAGIC | iv(12) | ciphertext | tag(16). The tag is appended after the last block. */
export async function writeEncryptedOrPlain(src: Readable, dest: string, key: Buffer | null) {
  if (!key) {
    await pipelineP(src, createWriteStream(dest, { mode: 0o600 }));
    return;
  }
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const out = createWriteStream(dest, { mode: 0o600 });
  await new Promise<void>((resolve, reject) => {
    out.on('error', reject);
    src.on('error', reject);
    out.write(Buffer.concat([MAGIC, iv]));
    src.on('data', (chunk) => {
      const enc = c.update(chunk);
      if (enc.length && !out.write(enc)) {
        src.pause();
        out.once('drain', () => src.resume());
      }
    });
    src.on('end', () => {
      out.write(c.final());
      out.end(c.getAuthTag(), () => resolve());
    });
  });
}

/** Opens a backup file for reading: decrypts when it carries the MAGIC header. The key is needed only for encrypted files. */
export async function openProtected(file: string, key: Buffer | null): Promise<Readable> {
  const fh = await fs.open(file, 'r');
  const { size } = await fh.stat();
  const head = Buffer.alloc(MAGIC.length);
  await fh.read(head, 0, head.length, 0);
  await fh.close();
  if (!head.equals(MAGIC)) return createReadStream(file);
  if (!key) throw new Error('This backup is encrypted: set BACKUP_ENCRYPTION_KEY to the key it was made with.');
  const fd = await fs.open(file, 'r');
  const iv = Buffer.alloc(12);
  const tag = Buffer.alloc(16);
  await fd.read(iv, 0, 12, MAGIC.length);
  await fd.read(tag, 0, 16, size - 16);
  await fd.close();
  const d = createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  // a wrong key / a damaged file fails at the end (authentication), never silently
  return createReadStream(file, { start: MAGIC.length + 12, end: size - 17 }).pipe(d);
}

/** Base tables of the current schema, parents first (foreign keys); tables in a cycle come last. */
export async function tableOrder(ds: DataSource): Promise<{ schema: string; tables: string[] }> {
  const [{ s }] = await ds.query(`SELECT current_schema() AS s`);
  const tables: string[] = (await ds.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`, [s])).map((r: any) => r.table_name);
  const fks: { child: string; parent: string }[] = await ds.query(
    `SELECT c.relname AS child, p.relname AS parent FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_class p ON p.oid = k.confrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE k.contype = 'f' AND n.nspname = $1`, [s]);
  const deps = new Map<string, Set<string>>(tables.map((t) => [t, new Set()]));
  for (const f of fks) if (f.child !== f.parent && deps.has(f.child) && deps.has(f.parent)) deps.get(f.child)!.add(f.parent);
  const out: string[] = [];
  const left = new Set(tables);
  while (left.size) {
    const ready = [...left].filter((t) => [...deps.get(t)!].every((p) => !left.has(p)));
    if (!ready.length) { out.push(...left); break; }
    for (const t of ready) { out.push(t); left.delete(t); }
  }
  return { schema: s, tables: out };
}

export interface DumpResult { tables: number; rows: number; bytes: number }

export async function dumpDatabase(ds: DataSource, dest: string, key: Buffer | null, info: Record<string, any> = {}): Promise<DumpResult> {
  const { schema, tables } = await tableOrder(ds);
  const gz = createGzip({ level: 6 });
  const finished = writeEncryptedOrPlain(gz, dest, key);
  const write = (obj: unknown) => (gz.write(JSON.stringify(obj) + '\n') ? Promise.resolve() : new Promise<void>((r) => gz.once('drain', r)));
  let rows = 0;
  try {
    await write({ kind: 'header', format: 1, createdAt: new Date().toISOString(), schema, tables, ...info });
    for (const t of tables) {
      for (let off = 0; ; off += BATCH) {
        const batch: { r: unknown }[] = await ds.query(`SELECT to_jsonb(x) AS r FROM ${q(schema)}.${q(t)} x ORDER BY x.ctid LIMIT ${BATCH} OFFSET ${off}`);
        for (const b of batch) await write({ t, r: b.r });
        rows += batch.length;
        if (batch.length < BATCH) break;
      }
    }
    await write({ kind: 'end', rows });
    gz.end();
    await finished;
  } catch (e) {
    gz.destroy();
    await finished.catch(() => undefined);
    await fs.rm(dest, { force: true });
    throw e;
  }
  return { tables: tables.length, rows, bytes: (await fs.stat(dest)).size };
}

/**
 * Replaces the content of every table with the backup's. One transaction: any error leaves the database as it was.
 * The schema must already exist (run the migrations first); a table that is in the backup but not in the database aborts the restore.
 */
export async function restoreDatabase(ds: DataSource, src: string, key: Buffer | null, log: (m: string) => void = () => undefined) {
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const { schema, tables } = await tableOrder(ds);
    await qr.query(`SET LOCAL statement_timeout = 0`);
    await qr.query(`TRUNCATE ${tables.map((t) => `${q(schema)}.${q(t)}`).join(', ')} RESTART IDENTITY CASCADE`);
    // pipeline() forwards a decryption / gzip error to the reader (a bare .pipe() would leave it uncaught)
    const input = createGunzip();
    pipeline(await openProtected(src, key), input, (err) => { if (err) input.destroy(err); });
    const rl = createInterface({ input, crlfDelay: Infinity });
    let table = '';
    let buf: unknown[] = [];
    let total = 0;
    let ended = false;
    let seenHeader = false;
    const flush = async () => {
      if (!buf.length) return;
      await qr.query(`INSERT INTO ${q(schema)}.${q(table)} SELECT * FROM jsonb_populate_recordset(NULL::${q(schema)}.${q(table)}, $1::jsonb)`, [JSON.stringify(buf)]);
      total += buf.length;
      buf = [];
    };
    for await (const line of rl) {
      if (!line) continue;
      const o = JSON.parse(line);
      if (o.kind === 'header') {
        seenHeader = true;
        const missing = (o.tables as string[]).filter((t) => !tables.includes(t));
        if (missing.length) throw new Error(`The database has no table(s): ${missing.join(', ')}. Run the migrations of the same app version first.`);
        continue;
      }
      if (o.kind === 'end') { ended = true; continue; }
      if (!seenHeader) throw new Error('Not a backup file (no header).');
      if (o.t !== table) { await flush(); table = o.t; log(`restoring ${table}`); }
      buf.push(o.r);
      if (buf.length >= 1000) await flush();
    }
    await flush();
    if (!ended) throw new Error('The backup is incomplete (no end marker): the file was cut or damaged.');
    // serial / identity sequences continue after the restored ids
    const seqs: { t: string; c: string }[] = await qr.query(
      `SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = $1 AND (column_default LIKE 'nextval(%' OR is_identity = 'YES')`, [schema]);
    for (const s of seqs) {
      await qr.query(`SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${q(s.c)}) FROM ${q(schema)}.${q(s.t)}), 1), (SELECT MAX(${q(s.c)}) IS NOT NULL FROM ${q(schema)}.${q(s.t)}))`, [`${q(schema)}.${q(s.t)}`, s.c]);
    }
    await qr.commitTransaction();
    return { rows: total };
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}
