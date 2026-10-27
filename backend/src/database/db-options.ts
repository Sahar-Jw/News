import { DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from './entities';
import { join } from 'path';

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
    extra: { options: '-c timezone=UTC' },
    entities: ALL_ENTITIES,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    // Schema changes go through migrations only (SRS 21) – never synchronize.
    synchronize: false,
    migrationsTableName: 'typeorm_migrations',
    logging: env.DB_LOGGING === 'true' ? ['error', 'warn', 'query'] : ['error'],
  };
}
