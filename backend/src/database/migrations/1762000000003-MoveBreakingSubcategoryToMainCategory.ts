import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The imported database stored "الأخبار العاجلة" (breaking news) as the SUBCATEGORY of ordinary news.
 * The app shows the top "breaking" section only for news whose MAIN category is the special category BREAKING
 * (the one chosen from the dropdown, label "الأخبار العاجلة"), and BREAKING does not accept a subcategory.
 *
 * This migration SWAPS the two for every regular news row whose subcategory is a "breaking news" label:
 * main_category becomes 'BREAKING' and the old main category is kept in subcategory, so nothing is lost.
 * The old values are also saved in "news_breaking_migration_backup" so down() restores them exactly.
 * Note: saving such a row from the admin form clears its subcategory (BREAKING does not support one);
 * the original values stay in the backup table.
 *
 * Matching rule: the subcategory contains "عاجل" (covers عاجل / العاجلة / الأخبار العاجلة / أخبار عاجلة / خبر عاجل),
 * ignoring tatweel and diacritics. Rows that are already in a special category are never touched.
 */
export class MoveBreakingSubcategoryToMainCategory1762000000003 implements MigrationInterface {
  name = 'MoveBreakingSubcategoryToMainCategory1762000000003';

  private static readonly SPECIAL = `'STATISTICS','BREAKING','SERVICES','PARTNERS','EXPERTS','TEAM','TESTIMONIALS','COMPANY_OVERVIEW'`;

  // subcategory with tatweel / diacritics removed
  private static readonly CLEAN_SUB = `regexp_replace(coalesce("subcategory", ''), '[\\u0640\\u064B-\\u065F\\u0670]', '', 'g')`;

  public async up(q: QueryRunner): Promise<void> {
    const special = MoveBreakingSubcategoryToMainCategory1762000000003.SPECIAL;
    const sub = MoveBreakingSubcategoryToMainCategory1762000000003.CLEAN_SUB;

    await q.query(`
      CREATE TABLE IF NOT EXISTS "news_breaking_migration_backup" (
        "news_id" bigint PRIMARY KEY,
        "main_category" varchar(100) NOT NULL,
        "subcategory" varchar(100)
      )
    `);

    // 1) remember the original categories (never overwrite an existing backup row)
    await q.query(`
      INSERT INTO "news_breaking_migration_backup" ("news_id", "main_category", "subcategory")
      SELECT "id", "main_category", "subcategory"
      FROM "news"
      WHERE "main_category" NOT IN (${special})
        AND ${sub} LIKE '%عاجل%'
      ON CONFLICT ("news_id") DO NOTHING
    `);

    // 2) swap: BREAKING becomes the main category, the old main category moves to subcategory
    await q.query(`
      UPDATE "news"
      SET "subcategory" = "main_category", "main_category" = 'BREAKING'
      WHERE "id" IN (SELECT "news_id" FROM "news_breaking_migration_backup")
        AND "main_category" NOT IN (${special})
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE "news" n
      SET "main_category" = b."main_category", "subcategory" = b."subcategory"
      FROM "news_breaking_migration_backup" b
      WHERE n."id" = b."news_id" AND n."main_category" = 'BREAKING'
    `);
    await q.query(`DROP TABLE IF EXISTS "news_breaking_migration_backup"`);
  }
}
