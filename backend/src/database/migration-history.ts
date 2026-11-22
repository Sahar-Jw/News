import { readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

/**
 * Migration history = the table `typeorm_migrations`: one row per migration that has already run on THIS database.
 * TypeORM runs every migration of the code that has no row there. A database whose tables were created by "synchronize" (or restored
 * from a dump without that table) has NO rows, so "run migrations" would replay all of them on tables that already have the result.
 *
 * This file does three things:
 *  - migrationsInCode():  the migrations shipped with the code (name = ClassName + timestamp, exactly what TypeORM stores).
 *  - historyState():      does the database have tables, and how many migrations are recorded?
 *  - baselineMigrations(): records migrations as "already applied" WITHOUT running them (up to an optional timestamp).
 */

export interface PgEnv { [k: string]: any }
export interface CodeMigration { timestamp: number; name: string }

/** Files are `<timestamp>-<Name>.ts|js`; the class (and the name TypeORM stores) is `<Name><timestamp>`. */
export function migrationsInCode(dir = join(__dirname, 'migrations')): CodeMigration[] {
  return readdirSync(dir)
    .filter((f) => /^\d+-[A-Za-z0-9]+\.(ts|js)$/.test(f) && !f.endsWith('.d.ts'))
    .map((f) => {
      const [, ts, name] = /^(\d+)-([A-Za-z0-9]+)\./.exec(f)!;
      return { timestamp: Number(ts), name: `${name}${ts}` };
    })
    .sort((a, b) => a.timestamp - b.timestamp || a.name.localeCompare(b.name));
}

function client(env: PgEnv): Client {
  return new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT ?? 5432),
    user: env.DB_USER,
    password: env.DB_PASS ?? env.DB_PASSWORD ?? '',
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
    connectionTimeoutMillis: 10_000,
  });
}
const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
const schemaOf = (env: PgEnv) => env.DB_SCHEMA || 'public';
const TABLE = 'typeorm_migrations'; // must match migrationsTableName in db-options.ts

export interface HistoryState {
  hasTables: boolean; // the app's `users` table exists
  hasHistoryTable: boolean;
  recorded: string[]; // names of the migrations recorded as applied
}

export async function historyState(env: PgEnv, c?: Client): Promise<HistoryState> {
  const own = !c;
  const cl = c ?? client(env);
  if (own) await cl.connect();
  try {
    const s = schemaOf(env);
    const t = await cl.query('SELECT to_regclass($1) AS users, to_regclass($2) AS hist', [`${q(s)}.users`, `${q(s)}.${q(TABLE)}`]);
    const hasHistoryTable = t.rows[0].hist !== null;
    const recorded = hasHistoryTable ? (await cl.query(`SELECT name FROM ${q(s)}.${q(TABLE)}`)).rows.map((r) => String(r.name)) : [];
    return { hasTables: t.rows[0].users !== null, hasHistoryTable, recorded };
  } finally {
    if (own) await cl.end().catch(() => undefined);
  }
}

export interface BaselineResult { recorded: string[]; skippedAlreadyRecorded: number; leftPending: string[]; note?: string }

/**
 * Records the code's migrations as applied without running them. `upTo` = only migrations with timestamp <= upTo (the rest stay
 * pending and run normally); undefined = all of them. Safe to repeat: names already recorded are left alone.
 * Refuses to touch a database that has no tables (nothing to baseline: let synchronize / the migrations build it).
 */
export async function baselineMigrations(env: PgEnv, upTo?: number, dir?: string): Promise<BaselineResult> {
  const cl = client(env);
  await cl.connect();
  try {
    const s = schemaOf(env);
    const st = await historyState(env, cl);
    if (!st.hasTables) return { recorded: [], skippedAlreadyRecorded: 0, leftPending: [], note: 'the database has no tables yet: nothing to record' };
    const all = migrationsInCode(dir);
    const have = new Set(st.recorded);
    const wanted = all.filter((m) => upTo === undefined || m.timestamp <= upTo);
    const toAdd = wanted.filter((m) => !have.has(m.name));
    await cl.query('BEGIN');
    try {
      // same shape TypeORM creates itself
      await cl.query(`CREATE TABLE IF NOT EXISTS ${q(s)}.${q(TABLE)} ("id" SERIAL NOT NULL, "timestamp" bigint NOT NULL, "name" character varying NOT NULL, CONSTRAINT ${q(`PK_${TABLE}`)} PRIMARY KEY ("id"))`);
      for (const m of toAdd) await cl.query(`INSERT INTO ${q(s)}.${q(TABLE)} ("timestamp", "name") VALUES ($1, $2)`, [m.timestamp, m.name]);
      await cl.query('COMMIT');
    } catch (e) {
      await cl.query('ROLLBACK').catch(() => undefined);
      throw e;
    }
    return {
      recorded: toAdd.map((m) => m.name),
      skippedAlreadyRecorded: wanted.length - toAdd.length,
      leftPending: all.filter((m) => !wanted.includes(m) && !have.has(m.name)).map((m) => m.name),
    };
  } finally {
    await cl.end().catch(() => undefined);
  }
}

/** Parses MIGRATIONS_BASELINE: "all" / "true" / "1" -> every migration; a number -> migrations up to that timestamp; empty -> off. */
export function parseBaselineSetting(v: unknown): { on: boolean; upTo?: number } {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s || s === 'false' || s === '0' || s === 'no') return { on: false };
  if (/^\d{10,}$/.test(s)) return { on: true, upTo: Number(s) };
  return { on: true };
}

/**
 * Decides, once at start-up, whether "run migrations on start" is safe, and applies MIGRATIONS_BASELINE when asked. Never throws:
 * on any doubt migrations are simply NOT run (the API still starts) and the reason is logged.
 */
export async function prepareMigrations(
  env: PgEnv,
  opts: { schemaCreatedNow: boolean },
  log: (msg: string) => void = console.warn,
): Promise<{ run: boolean }> {
  const wantRun = env.RUN_MIGRATIONS_ON_START === 'true';
  try {
    const base = parseBaselineSetting(env.MIGRATIONS_BASELINE);
    if (base.on && !opts.schemaCreatedNow) {
      const r = await baselineMigrations(env, base.upTo);
      log(`MIGRATIONS_BASELINE: recorded ${r.recorded.length} migration(s) as already applied (${r.skippedAlreadyRecorded} were already recorded; ${r.leftPending.length} left pending${r.note ? `; ${r.note}` : ''}). Remove MIGRATIONS_BASELINE from the environment now - it is only needed once.`);
    }
    if (!wantRun) return { run: false };
    if (opts.schemaCreatedNow) return { run: false }; // the tables were just built from the entities; the baseline step records the history after it
    const st = await historyState(env);
    if (st.hasTables && st.recorded.length === 0) {
      log('RUN_MIGRATIONS_ON_START=true was IGNORED: this database has tables but no migration history, so every migration would run again on tables that already have their result. Set MIGRATIONS_BASELINE=all (or a timestamp, see the README), restart once, then remove it.');
      return { run: false };
    }
    return { run: true };
  } catch (e) {
    log(`Migrations were NOT run (could not check the migration history: ${(e as Error).message})`);
    return { run: false };
  }
}
