import { MigrationInterface, QueryRunner } from 'typeorm';

/** The Facebook page card was removed from the home page, so its setting row is no longer needed. */
export class RemoveFacebookPageSetting1762000000001 implements MigrationInterface {
  name = 'RemoveFacebookPageSetting1762000000001';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "site_settings" WHERE "category" = 'social' AND "key" = 'facebook_page_url'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    // restore an empty setting row (the old value is not recoverable)
    await q.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ('social', 'facebook_page_url', NULL, 'url', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }
}
