import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Read / update / delete become per-section too (create already was).
 *
 *   news.read | news.update | news.delete             -> regular news ONLY
 *   news.read.<section> | news.update.<section> | ... -> that one section only
 *
 * Roles keep exactly the access they have today: a role that holds news.read / news.update / news.delete is granted
 * the matching permission for every section. Then open "Roles & permissions" and untick what each role must NOT do.
 * (To start strict instead, remove the GRANT step: such roles keep regular news only.)
 */
export class NewsCrudPerSection1792800000000 implements MigrationInterface {
  name = 'NewsCrudPerSection1792800000000';

  private readonly SECTIONS: [string, string, string][] = [
    ['breaking', 'الأخبار العاجلة', 'Breaking news'],
    ['services', 'الخدمات', 'Services'],
    ['team', 'الفريق', 'Team'],
    ['testimonials', 'آراء العملاء', 'Testimonials'],
    ['partners', 'الشركاء', 'Partners'],
    ['experts', 'الخبراء', 'Experts'],
    ['statistics', 'الإحصائيات', 'Statistics'],
    ['company_overview', 'الشركات الشريكة', 'Partner companies'],
  ];
  private readonly ACTIONS: [string, string, string][] = [
    ['read', 'عرض', 'View'],
    ['create', 'إضافة إلى', 'Create in'],
    ['update', 'تعديل', 'Update'],
    ['delete', 'حذف من', 'Delete from'],
  ];

  public async up(q: QueryRunner): Promise<void> {
    for (const [sec, secAr, secEn] of this.SECTIONS) {
      for (const [act, actAr, actEn] of this.ACTIONS) {
        // INSERT ... ON DUPLICATE: news.create.<section> already exist, they only get a clearer name + module
        await q.query(
          `INSERT INTO \`permissions\` (\`code\`, \`name_ar\`, \`name_en\`, \`module\`) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE \`name_ar\` = VALUES(\`name_ar\`), \`name_en\` = VALUES(\`name_en\`), \`module\` = VALUES(\`module\`)`,
          [`news.${act}.${sec}`, `${actAr} ${secAr}`, `${actEn} ${secEn}`, `news.${sec}`],
        );
      }
    }
    await q.query("UPDATE `permissions` SET `name_ar` = 'عرض الأخبار العادية', `name_en` = 'View regular news' WHERE `code` = 'news.read'");
    await q.query("UPDATE `permissions` SET `name_ar` = 'تعديل الأخبار العادية', `name_en` = 'Update regular news' WHERE `code` = 'news.update'");
    await q.query("UPDATE `permissions` SET `name_ar` = 'حذف الأخبار العادية', `name_en` = 'Delete regular news' WHERE `code` = 'news.delete'");

    // GRANT: keep today's access (see header comment)
    for (const act of ['read', 'update', 'delete']) {
      await q.query(
        `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`, \`created_at\`)
         SELECT rp.role_id, pn.id, UTC_TIMESTAMP()
           FROM \`role_permissions\` rp
           JOIN \`permissions\` po ON po.id = rp.permission_id AND po.code = ?
           JOIN \`permissions\` pn ON pn.code LIKE ?`,
        [`news.${act}`, `news.${act}.%`],
      );
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    // news.create.<section> stay (they predate this migration); only the new ones are removed (role links cascade)
    await q.query("DELETE FROM `permissions` WHERE `code` LIKE 'news.read.%' OR `code` LIKE 'news.update.%' OR `code` LIKE 'news.delete.%'");
    await q.query("UPDATE `permissions` SET `name_ar` = 'عرض المحتوى', `name_en` = 'View content' WHERE `code` = 'news.read'");
    await q.query("UPDATE `permissions` SET `name_ar` = 'تعديل المحتوى', `name_en` = 'Update content' WHERE `code` = 'news.update'");
    await q.query("UPDATE `permissions` SET `name_ar` = 'حذف المحتوى', `name_en` = 'Delete content' WHERE `code` = 'news.delete'");
  }
}
