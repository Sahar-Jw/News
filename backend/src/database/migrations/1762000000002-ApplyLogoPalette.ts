import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * New look based on the logo's colours: emerald green, deep forest green and antique gold.
 * The brand colours live in Settings (site_settings, category "appearance"), so the stored values have to change too.
 * Header / footer / breaking-bar colours are cleared so the built-in green + gold look is used.
 * Colours can still be changed afterwards from Settings -> appearance.
 */
export class ApplyLogoPalette1762000000002 implements MigrationInterface {
  name = 'ApplyLogoPalette1762000000002';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES
        ('appearance', 'primary_color',   '#0a5c3d', 'color', now()),
        ('appearance', 'secondary_color', '#043323', 'color', now()),
        ('appearance', 'accent_color',    '#bd9f6e', 'color', now())
      ON CONFLICT ("category", "key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now()
    `);
    await q.query(`
      UPDATE "site_settings" SET "value" = NULL, "updated_at" = now()
      WHERE "category" = 'appearance'
        AND "key" IN ('header_background', 'footer_background', 'breaking_bg_color', 'breaking_label_bg_color')
        AND "value" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // the previous colours are not recoverable; pick colours again in Settings -> appearance if you want to go back
  }
}
