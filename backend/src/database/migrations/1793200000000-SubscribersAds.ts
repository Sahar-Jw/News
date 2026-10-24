import { MigrationInterface, QueryRunner } from 'typeorm';

const T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

/**
 * Tools: newsletter subscribers + ads, the "subscribe" home section and its settings.
 * Also removes the two occasion-list permissions (the occasions table itself already has the upcoming / previous filter).
 */
export class SubscribersAds1793200000000 implements MigrationInterface {
  name = 'SubscribersAds1793200000000';

  private readonly PERMS: [string, string, string, string][] = [
    ['subscribers.read', 'subscribers', 'عرض المشتركين', 'View subscribers'],
    ['subscribers.update', 'subscribers', 'تفعيل / تعطيل مشترك', 'Activate / deactivate subscribers'],
    ['subscribers.delete', 'subscribers', 'حذف مشترك', 'Delete subscribers'],
    ['subscribers.export', 'subscribers', 'تصدير المشتركين', 'Export subscribers'],
    ['ads.read', 'ads', 'عرض الإعلانات', 'View ads'],
    ['ads.create', 'ads', 'إضافة إعلان', 'Create ads'],
    ['ads.update', 'ads', 'تعديل إعلان', 'Update ads'],
    ['ads.delete', 'ads', 'حذف إعلان', 'Delete ads'],
  ];

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS \`subscribers\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`email\` VARCHAR(190) NOT NULL,
      \`is_verified\` TINYINT(1) NOT NULL DEFAULT 0,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`verified_at\` DATETIME NULL,
      \`remember_token\` VARCHAR(64) NOT NULL,
      \`created_at\` DATETIME NOT NULL,
      \`updated_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_subscribers_email\` (\`email\`),
      UNIQUE KEY \`uq_subscribers_token\` (\`remember_token\`)
    ) ${T}`);
    await q.query(`CREATE TABLE IF NOT EXISTS \`ads\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`owner_company\` VARCHAR(255) NOT NULL,
      \`link_url\` VARCHAR(500) NOT NULL,
      \`placement\` ENUM('golden','bronze','silver') NOT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`start_date\` DATE NOT NULL,
      \`end_date\` DATE NOT NULL,
      \`images\` JSON NULL,
      \`created_by\` BIGINT UNSIGNED NULL,
      \`created_at\` DATETIME NOT NULL,
      \`updated_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_ads_show\` (\`placement\`, \`is_active\`, \`start_date\`, \`end_date\`),
      KEY \`idx_ads_created_by\` (\`created_by\`),
      CONSTRAINT \`fk_ads_user\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
    ) ${T}`);

    for (const [code, module, ar, en] of this.PERMS) {
      await q.query('INSERT IGNORE INTO `permissions` (`code`, `name_ar`, `name_en`, `module`) VALUES (?, ?, ?, ?)', [code, ar, en, module]);
    }
    await q.query(
      `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`, \`created_at\`)
       SELECT r.id, p.id, UTC_TIMESTAMP() FROM \`roles\` r JOIN \`permissions\` p ON p.module IN ('subscribers', 'ads') WHERE r.code = 'technical_admin'`,
    );
    // role_permissions rows go with them (ON DELETE CASCADE)
    await q.query("DELETE FROM `permissions` WHERE `code` IN ('occasions.upcoming.read', 'occasions.previous.read')");

    // home section "subscribe": goes just before "contact" unless the order was already changed
    await q.query("UPDATE `site_settings` SET `value` = '12', `updated_at` = UTC_TIMESTAMP() WHERE `category` = 'sections_home' AND `key` = 'contact_order' AND `value` = '11'");
    const rows: [string, string, string | null][] = [
      ['subscribe_title_ar', 'text', 'اشترك في نشرتنا'],
      ['subscribe_title_en', 'text', 'Subscribe to our newsletter'],
      ['subscribe_order', 'number', '11'],
      ['subscribe_visible', 'boolean', 'true'],
      ['subscribe_eyebrow_ar', 'text', null],
      ['subscribe_eyebrow_en', 'text', null],
      ['subscribe_subtitle_ar', 'text', null],
      ['subscribe_subtitle_en', 'text', null],
    ];
    for (const [key, type, value] of rows) {
      await q.query("INSERT IGNORE INTO `site_settings` (`category`, `key`, `value`, `value_type`, `updated_at`) VALUES ('sections_home', ?, ?, ?, UTC_TIMESTAMP())", [key, value, type]);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM `site_settings` WHERE `category` = 'sections_home' AND `key` LIKE 'subscribe\\_%'");
    await q.query("UPDATE `site_settings` SET `value` = '11' WHERE `category` = 'sections_home' AND `key` = 'contact_order' AND `value` = '12'");
    await q.query("DELETE FROM `permissions` WHERE `module` IN ('subscribers', 'ads')");
    await q.query('DROP TABLE IF EXISTS `ads`');
    await q.query('DROP TABLE IF EXISTS `subscribers`');
    for (const [code, ar, en] of [['occasions.upcoming.read', 'عرض المناسبات القادمة', 'View upcoming occasions'], ['occasions.previous.read', 'عرض المناسبات السابقة', 'View previous occasions']]) {
      await q.query('INSERT IGNORE INTO `permissions` (`code`, `name_ar`, `name_en`, `module`) VALUES (?, ?, ?, ?)', [code, ar, en, 'occasions']);
    }
  }
}
