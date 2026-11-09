import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Media Kit settings of the media center: an on/off switch ("approved"), the logo files, the visual-identity guide and text,
 * the introduction text, and the gallery album that holds the photos of the chamber's building.
 * Idempotent; existing values are never overwritten.
 */
export class AddMediaKitSettings1765100000000 implements MigrationInterface {
  name = 'AddMediaKitSettings1765100000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES
        ('media', 'kit_enabled', 'false', 'boolean', now()),
        ('media', 'kit_logo', NULL, 'file', now()),
        ('media', 'kit_logo_alt', NULL, 'file', now()),
        ('media', 'kit_identity_file', NULL, 'file', now()),
        ('media', 'kit_identity_ar', NULL, 'text', now()),
        ('media', 'kit_identity_en', NULL, 'text', now()),
        ('media', 'kit_about_ar', NULL, 'text', now()),
        ('media', 'kit_about_en', NULL, 'text', now()),
        ('media', 'kit_hq_album', NULL, 'number', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'media' AND "key" LIKE 'kit\\_%'`);
  }
}
