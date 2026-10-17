import { DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from './entities';
import { join } from 'path';

export function buildDbOptions(env: Record<string, any>): DataSourceOptions {
  return {
    type: 'mysql',
    host: env.DB_HOST,
    port: Number(env.DB_PORT ?? 3306),
    username: env.DB_USER,
    password: env.DB_PASS ?? env.DB_PASSWORD ?? '',
    database: env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: false,
    entities: ALL_ENTITIES,
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    // Schema changes go through migrations only (SRS 21) – never synchronize.
    synchronize: false,
    migrationsTableName: 'typeorm_migrations',
    logging: env.DB_LOGGING === 'true' ? ['error', 'warn', 'query'] : ['error'],
  };
}
