import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A damaged index on `news` (see ReindexNewsTitle) can make PostgreSQL answer "which categories exist" with values that no longer exist
 * and without ones that do. REINDEX TABLE rebuilds every index of the table from its data. Safe to run again; the data is not touched.
 */
export class ReindexNewsTable1767700000000 implements MigrationInterface {
  name = 'ReindexNewsTable1767700000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query('REINDEX TABLE "news"');
  }

  public async down(): Promise<void> {
    // nothing to undo
  }
}
