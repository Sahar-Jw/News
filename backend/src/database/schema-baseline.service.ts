import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { baselineMigrations } from './migration-history';
import { schemaState } from './schema-guard';

/**
 * When this start created the tables from the entities (a brand-new empty database), they already contain the result of every migration
 * shipped with this version. So those migrations are recorded as applied - without running them - and only migrations added in LATER
 * versions will run. Nothing happens on a database that was not created in this start.
 */
@Injectable()
export class SchemaBaselineService implements OnApplicationBootstrap {
  private readonly log = new Logger('SchemaBaseline');
  constructor(private readonly config: ConfigService) {}

  async onApplicationBootstrap() {
    if (!schemaState.createdNow) return;
    try {
      const c = this.config;
      const r = await baselineMigrations({
        DB_HOST: c.get('DB_HOST'), DB_PORT: c.get('DB_PORT'), DB_USER: c.get('DB_USER'), DB_PASS: c.get('DB_PASS'), DB_NAME: c.get('DB_NAME'),
        DB_SCHEMA: c.get('DB_SCHEMA'), DB_SSL: c.get('DB_SSL'), DB_SSL_REJECT_UNAUTHORIZED: c.get('DB_SSL_REJECT_UNAUTHORIZED'),
      });
      this.log.log(`New database: its tables were created from the entities, so ${r.recorded.length} migration(s) were recorded as already applied. Remove DB_SYNCHRONIZE from the environment.`);
    } catch (e) {
      this.log.error(`Could not record the migration history of the new database: ${(e as Error).message}. Run: npm run migration:baseline:prod -- all`);
    }
  }
}
