import { MigrationInterface, QueryRunner } from 'typeorm';

const T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

/** Tools: occasions + image gallery (tables and their permissions). */
export class OccasionsGallery1793100000000 implements MigrationInterface {
  name = 'OccasionsGallery1793100000000';

  private readonly PERMS: [string, string, string, string][] = [
    ['occasions.read', 'occasions', 'عرض جدول المناسبات', 'View occasions table'],
    ['occasions.create', 'occasions', 'إضافة مناسبة', 'Create occasions'],
    ['occasions.update', 'occasions', 'تعديل مناسبة', 'Update occasions'],
    ['occasions.delete', 'occasions', 'حذف مناسبة', 'Delete occasions'],
    ['occasions.upcoming.read', 'occasions', 'عرض المناسبات القادمة', 'View upcoming occasions'],
    ['occasions.previous.read', 'occasions', 'عرض المناسبات السابقة', 'View previous occasions'],
    ['gallery.read', 'gallery', 'عرض معرض الصور', 'View image gallery'],
    ['gallery.create', 'gallery', 'إضافة معرض صور', 'Create galleries'],
    ['gallery.update', 'gallery', 'تعديل معرض صور', 'Update galleries'],
    ['gallery.delete', 'gallery', 'حذف معرض صور', 'Delete galleries'],
  ];

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS \`occasions\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`title_ar\` VARCHAR(255) NOT NULL,
      \`title_en\` VARCHAR(255) NOT NULL,
      \`event_date\` DATE NOT NULL,
      \`images\` JSON NULL,
      \`created_by\` BIGINT UNSIGNED NULL,
      \`created_at\` DATETIME NOT NULL,
      \`updated_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_occasions_date\` (\`event_date\`),
      KEY \`idx_occasions_created_by\` (\`created_by\`),
      CONSTRAINT \`fk_occasions_user\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
    ) ${T}`);
    await q.query(`CREATE TABLE IF NOT EXISTS \`galleries\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`title_ar\` VARCHAR(255) NOT NULL,
      \`title_en\` VARCHAR(255) NOT NULL,
      \`images\` JSON NULL,
      \`created_by\` BIGINT UNSIGNED NULL,
      \`created_at\` DATETIME NOT NULL,
      \`updated_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_galleries_created_by\` (\`created_by\`),
      CONSTRAINT \`fk_galleries_user\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
    ) ${T}`);
    for (const [code, module, ar, en] of this.PERMS) {
      await q.query('INSERT IGNORE INTO `permissions` (`code`, `name_ar`, `name_en`, `module`) VALUES (?, ?, ?, ?)', [code, ar, en, module]);
    }
    // technical_admin always holds every permission
    await q.query(
      `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`, \`created_at\`)
       SELECT r.id, p.id, UTC_TIMESTAMP() FROM \`roles\` r JOIN \`permissions\` p ON p.module IN ('occasions', 'gallery') WHERE r.code = 'technical_admin'`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM `permissions` WHERE `module` IN ('occasions', 'gallery')");
    await q.query('DROP TABLE IF EXISTS `galleries`');
    await q.query('DROP TABLE IF EXISTS `occasions`');
  }
}
