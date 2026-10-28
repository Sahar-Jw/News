import { DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from './entities';
import { join } from 'path';
import { AuditChangeSubscriber } from '../modules/audit/audit.subscriber';

// node-postgres returns BIGINT (int8, e.g. ids and COUNT(*)) as strings and DATE as JS Date objects.
// The app expects numbers and plain "YYYY-MM-DD" strings (as it got from the MySQL driver), so parse them that way.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { types } = require('pg');
types.setTypeParser(20, (v: string) => Number(v)); // int8 / bigint
types.setTypeParser(1082, (v: string) => v); // date

export function buildDbOptions(env: Record<string, any>): DataSourceOptions {
  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: Number(env.DB_PORT ?? 5432),
    username: env.DB_USER,
    password: env.DB_PASS ?? env.DB_PASSWORD ?? '',
    database: env.DB_NAME,
    schema: env.DB_SCHEMA || 'public',
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
    // Keep the session in UTC (was `timezone: 'Z'` for MySQL).
    // Pool + timeouts: under load requests queue for a connection instead of opening unlimited ones, a runaway query is
    // killed after DB_STATEMENT_TIMEOUT_MS, and a client that dies inside a transaction cannot hold its locks forever.
    extra: {
      options: `-c timezone=UTC -c statement_timeout=${Number(env.DB_STATEMENT_TIMEOUT_MS ?? 20000)} -c idle_in_transaction_session_timeout=30000`,
      max: Number(env.DB_POOL_MAX ?? 20),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    },
    entities: ALL_ENTITIES,
    subscribers: [AuditChangeSubscriber],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    // Schema changes go through migrations only (SRS 21) – never synchronize.
    synchronize: false,
    migrationsTableName: 'typeorm_migrations',
    logging: env.DB_LOGGING === 'true' ? ['error', 'warn', 'query'] : ['error'],
  };
}
