import { MigrationInterface, QueryRunner } from 'typeorm';

/** branding.meta_title_ar / meta_title_en – browser-tab (SEO) title of the site per language; empty = the site name is used. */
export class MetaTitles1793000000000 implements MigrationInterface {
  name = 'MetaTitles1793000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query("INSERT IGNORE INTO `site_settings` (`category`, `key`, `value`, `value_type`, `updated_at`) VALUES ('branding', 'meta_title_ar', NULL, 'text', UTC_TIMESTAMP()), ('branding', 'meta_title_en', NULL, 'text', UTC_TIMESTAMP())");
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM `site_settings` WHERE `category` = 'branding' AND `key` IN ('meta_title_ar', 'meta_title_en')");
  }
}
