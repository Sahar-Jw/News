import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1. news.pdf – optional PDF attached to a news record (relative storage path).
 * 2. appearance.breaking_bg_color – background colour of the breaking-news bar (empty = built-in red gradient).
 */
export class NewsPdfBreakingColor1792900000000 implements MigrationInterface {
  name = 'NewsPdfBreakingColor1792900000000';

  public async up(q: QueryRunner): Promise<void> {
    const col = await q.query("SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'news' AND COLUMN_NAME = 'pdf'");
    if (!Number(col[0].c)) await q.query('ALTER TABLE `news` ADD COLUMN `pdf` varchar(255) NULL AFTER `images`');
    await q.query("INSERT IGNORE INTO `site_settings` (`category`, `key`, `value`, `value_type`, `updated_at`) VALUES ('appearance', 'breaking_bg_color', NULL, 'color', UTC_TIMESTAMP())");
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM `site_settings` WHERE `category` = 'appearance' AND `key` = 'breaking_bg_color'");
    await q.query('ALTER TABLE `news` DROP COLUMN `pdf`');
  }
}
