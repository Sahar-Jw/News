import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "unable to remove tuple from secondary index in idx_news_title" (a 500 when a record's title is changed): that index is not part of the
 * application's schema (it was added by hand to the database) and its file is damaged, so PostgreSQL cannot update it any more.
 * REINDEX rebuilds it from the table. Only runs when the index exists; nothing else is touched. Safe to run again.
 */
export class ReindexNewsTitle1767600000000 implements MigrationInterface {
  name = 'ReindexNewsTitle1767600000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`DO $$
      BEGIN
        IF to_regclass('idx_news_title') IS NOT NULL THEN
          BEGIN
            REINDEX INDEX idx_news_title;
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'REINDEX idx_news_title skipped: %', SQLERRM; -- maintenance only: never stop the API from starting
          END;
        END IF;
      END $$;`);
  }

  public async down(): Promise<void> {
    // nothing to undo: a rebuilt index holds the same data
  }
}
