import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The media center now has only News, Press materials and the Media Kit: the settings that picked the news category
 * of the removed tabs (official statements, interviews, media coverage) are no longer used. Idempotent.
 */
export class RemoveMediaExtraTabSettings1766300000000 implements MigrationInterface {
  name = 'RemoveMediaExtraTabSettings1766300000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'media' AND "key" IN ('statements_category', 'interviews_category', 'coverage_category')`);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ('media', 'statements_category', 'بيانات رسمية', 'text', now()),
             ('media', 'interviews_category', 'مقابلات', 'text', now()),
             ('media', 'coverage_category', 'تغطيات إعلامية', 'text', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }
}
