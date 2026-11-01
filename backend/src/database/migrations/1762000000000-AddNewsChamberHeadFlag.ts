import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * News that mention "رئيس الغرفة" (title, subject or body) also appear in the home featured carousel.
 * The flag is maintained by the News entity on every save; this migration adds the column and fills it for the existing rows.
 */
export class AddNewsChamberHeadFlag1762000000000 implements MigrationInterface {
  name = 'AddNewsChamberHeadFlag1762000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "mentions_chamber_head" boolean NOT NULL DEFAULT false`);

    // Backfill: same rule as mentionsChamberHead() in common/utils/text.ts
    // (HTML tags removed from the body, tatweel/diacritics ignored, any run of spaces between the two words).
    await q.query(`
      UPDATE "news"
      SET "mentions_chamber_head" = true
      WHERE regexp_replace(
              regexp_replace(
                coalesce("title", '') || ' ' || coalesce("subject", '') || ' ' ||
                replace(regexp_replace(coalesce("body", ''), '<[^>]+>', '', 'g'), '&nbsp;', ' '),
                '[\\u0640\\u064B-\\u065F\\u0670]', '', 'g'
              ),
              '\\s+', ' ', 'g'
            ) ~ 'رئيس[\\s\\u00A0]+الغرفة'
    `);

    await q.query(`CREATE INDEX IF NOT EXISTS "idx_news_chamber_head" ON "news" ("publish_at") WHERE "mentions_chamber_head" = true`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_news_chamber_head"`);
    await q.query(`ALTER TABLE "news" DROP COLUMN IF EXISTS "mentions_chamber_head"`);
  }
}
