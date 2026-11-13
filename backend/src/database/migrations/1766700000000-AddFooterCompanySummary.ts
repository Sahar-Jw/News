import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The main footer now starts with the logo, the site name and a short company summary under them (the other footers already had a text).
 * The summary is edited in Settings -> Footer; while empty, the site description (Settings -> Identity) is shown instead. Idempotent.
 */
export class AddFooterCompanySummary1766700000000 implements MigrationInterface {
  name = 'AddFooterCompanySummary1766700000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ('footer', 'company_summary_ar', NULL, 'text', now()), ('footer', 'company_summary_en', NULL, 'text', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'footer' AND "key" IN ('company_summary_ar', 'company_summary_en')`);
  }
}
