import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public news filters (category + date range, sort by newest/oldest/most viewed).
 * No new columns: only indexes so the filtered list stays fast as the table grows.
 */
export class AddNewsFilterIndexes1762600000000 implements MigrationInterface {
  name = 'AddNewsFilterIndexes1762600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_news_category_date" ON "news" ("language", "main_category", "publish_at")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_news_views" ON "news" ("language", "view_count")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_news_views"`);
    await q.query(`DROP INDEX IF EXISTS "idx_news_category_date"`);
  }
}
