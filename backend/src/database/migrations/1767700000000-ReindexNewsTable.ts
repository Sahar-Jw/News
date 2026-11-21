import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A damaged index on `news` (see ReindexNewsTitle) can make PostgreSQL answer "which categories exist" with values that no longer exist
 * and without ones that do. REINDEX TABLE rebuilds every index of the table from its data. Safe to run again; the data is not touched.
 */
export class ReindexNewsTable1767700000000 implements MigrationInterface {
  name = 'ReindexNewsTable1767700000000';

  public async up(r: QueryRunner): Promise<void> {
    // Maintenance only: if the rebuild cannot be done right now (table busy, damaged file ...) the application still starts - the failure
    // is a warning in the database log, and the index can be rebuilt later by hand: REINDEX TABLE news;
    await r.query(`DO $$
      BEGIN
        REINDEX TABLE "news";
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'REINDEX TABLE news skipped: %', SQLERRM;
      END $$;`);
  }

  public async down(): Promise<void> {
    // nothing to undo
  }
}
