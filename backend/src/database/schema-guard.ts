import { Client } from 'pg';

/**
 * TypeORM "synchronize" makes the database look like the entity classes: it adds, ALTERS and DROPS columns, indexes and constraints.
 * That is how a brand-new EMPTY database gets its tables, but on a database that holds data it is dangerous (it can drop columns with
 * their data, or fail half-way like `column "created_at" of relation "roles" contains null values` and stop the API from starting).
 *
 * So DB_SYNCHRONIZE=true is honoured ONLY when the database has no tables yet (the `users` table does not exist). Once the tables exist
 * the setting is ignored (with a warning), and from then on the schema changes only through migrations.
 */
export async function mayCreateSchema(env: Record<string, any>, log: (msg: string) => void = console.warn): Promise<boolean> {
  if (env.DB_SYNCHRONIZE !== 'true') return false; // note: the string "false" must NOT switch it on
  const schema = env.DB_SCHEMA || 'public';
  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT ?? 5432),
    user: env.DB_USER,
    password: env.DB_PASS ?? env.DB_PASSWORD ?? '',
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
    connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    const r = await client.query('SELECT to_regclass($1) AS t', [`"${schema.replace(/"/g, '""')}".users`]);
    const empty = r.rows[0]?.t === null;
    if (!empty) log('DB_SYNCHRONIZE=true was IGNORED: the database already has tables, and synchronizing a database with data can drop columns. Remove DB_SYNCHRONIZE from the environment.');
    return empty;
  } catch (e) {
    log(`DB_SYNCHRONIZE not applied (could not check the database: ${(e as Error).message})`);
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}
