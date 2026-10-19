import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * New colour theme: ultramarine primary, midnight-navy secondary, orange accent. Only values that are still the old
 * defaults are changed, so colours you picked yourself in Settings stay.
 */
export class ThemeColors1792600000000 implements MigrationInterface {
  name = 'ThemeColors1792600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query("INSERT IGNORE INTO `site_settings` (`category`, `key`, `value`, `value_type`, `updated_at`) VALUES ('appearance', 'accent_color', '#ff7a2f', 'color', UTC_TIMESTAMP())");
    await q.query("UPDATE `site_settings` SET `value` = '#2748e8', `updated_at` = UTC_TIMESTAMP() WHERE `category` = 'appearance' AND `key` = 'primary_color' AND LOWER(`value`) = '#0b5ed7'");
    await q.query("UPDATE `site_settings` SET `value` = '#0a1236', `updated_at` = UTC_TIMESTAMP() WHERE `category` = 'appearance' AND `key` = 'secondary_color' AND LOWER(`value`) = '#1f2937'");
    await q.query("UPDATE `site_settings` SET `value` = NULL, `updated_at` = UTC_TIMESTAMP() WHERE `category` = 'appearance' AND `key` = 'header_background' AND LOWER(`value`) IN ('#ffffff', '#fff')");
    await q.query("UPDATE `site_settings` SET `value` = NULL, `updated_at` = UTC_TIMESTAMP() WHERE `category` = 'appearance' AND `key` = 'footer_background' AND LOWER(`value`) = '#111827'");
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("UPDATE `site_settings` SET `value` = '#0b5ed7' WHERE `category` = 'appearance' AND `key` = 'primary_color' AND LOWER(`value`) = '#2748e8'");
    await q.query("UPDATE `site_settings` SET `value` = '#1f2937' WHERE `category` = 'appearance' AND `key` = 'secondary_color' AND LOWER(`value`) = '#0a1236'");
    await q.query("DELETE FROM `site_settings` WHERE `category` = 'appearance' AND `key` = 'accent_color'");
  }
}
