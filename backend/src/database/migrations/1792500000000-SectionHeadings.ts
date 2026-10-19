import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Optional "eyebrow" (small label above) and "subtitle" (line below) for every home section title, per language,
 * editable from Settings (category sections_home; empty = not shown). Also renames the old
 * "About the company" section to "Partner Companies" unless the title was customised.
 */
export class SectionHeadings1792500000000 implements MigrationInterface {
  name = 'SectionHeadings1792500000000';

  private readonly CODES = ['featured', 'news', 'team', 'services', 'testimonials', 'partners', 'experts', 'statistics', 'company', 'contact'];

  public async up(q: QueryRunner): Promise<void> {
    for (const code of this.CODES) {
      for (const field of ['eyebrow', 'subtitle']) {
        for (const lang of ['ar', 'en']) {
          await q.query(
            "INSERT IGNORE INTO `site_settings` (`category`, `key`, `value`, `value_type`, `updated_at`) VALUES ('sections_home', ?, NULL, 'text', UTC_TIMESTAMP())",
            [`${code}_${field}_${lang}`],
          );
        }
      }
    }
    await q.query("UPDATE `site_settings` SET `value` = 'الشركات الشريكة', `updated_at` = UTC_TIMESTAMP() WHERE `category` = 'sections_home' AND `key` = 'company_title_ar' AND (`value` IS NULL OR `value` = 'نبذة عن الشركة')");
    await q.query("UPDATE `site_settings` SET `value` = 'Partner Companies', `updated_at` = UTC_TIMESTAMP() WHERE `category` = 'sections_home' AND `key` = 'company_title_en' AND (`value` IS NULL OR `value` = 'About the Company')");
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM `site_settings` WHERE `category` = 'sections_home' AND (`key` LIKE '%\\_eyebrow\\_%' OR `key` LIKE '%\\_subtitle\\_%')");
  }
}
