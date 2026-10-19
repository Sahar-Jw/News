import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Create" is no longer one permission for everything. `news.create` now means regular news only, and each special
 * section has its own `news.create.<section>` permission.
 *
 * Roles that can create news today are given all of the new permissions, so nothing stops working the moment you
 * deploy; then open Roles & permissions and untick the sections each role should not create.
 * (Delete the last INSERT below to start strict instead: such roles keep regular news only.)
 */
export class NewsCreatePerSection1792700000000 implements MigrationInterface {
  name = 'NewsCreatePerSection1792700000000';

  private readonly NEW: [string, string, string][] = [
    ['news.create.breaking', 'إنشاء خبر عاجل', 'Create breaking news'],
    ['news.create.services', 'إضافة خدمة', 'Create service'],
    ['news.create.team', 'إضافة عضو فريق', 'Add team member'],
    ['news.create.testimonials', 'إضافة رأي عميل', 'Add testimonial'],
    ['news.create.partners', 'إضافة شريك', 'Add partner'],
    ['news.create.experts', 'إضافة خبير', 'Add expert'],
    ['news.create.statistics', 'إضافة إحصائية', 'Add statistic'],
    ['news.create.company_overview', 'إضافة شركة شريكة', 'Add partner company'],
  ];

  public async up(q: QueryRunner): Promise<void> {
    for (const [code, ar, en] of this.NEW) {
      await q.query('INSERT IGNORE INTO `permissions` (`code`, `name_ar`, `name_en`, `module`) VALUES (?, ?, ?, \'news\')', [code, ar, en]);
    }
    await q.query("UPDATE `permissions` SET `name_ar` = 'إنشاء الأخبار العادية', `name_en` = 'Create regular news' WHERE `code` = 'news.create'");
    await q.query(
      `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`, \`created_at\`)
       SELECT rp.role_id, pn.id, UTC_TIMESTAMP()
         FROM \`role_permissions\` rp
         JOIN \`permissions\` po ON po.id = rp.permission_id AND po.code = 'news.create'
         JOIN \`permissions\` pn ON pn.code LIKE 'news.create.%'`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM `permissions` WHERE `code` LIKE 'news.create.%'");
    await q.query("UPDATE `permissions` SET `name_ar` = 'إنشاء محتوى', `name_en` = 'Create content' WHERE `code` = 'news.create'");
  }
}
