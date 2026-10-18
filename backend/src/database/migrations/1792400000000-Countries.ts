import { MigrationInterface, QueryRunner } from 'typeorm';

const T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

/**
 * Countries list for the profile form (users.country keeps storing the English name, so no change to `users`),
 * plus the `countries.create` permission, granted to every role that can already create cities.
 */
export class Countries1792400000000 implements MigrationInterface {
  name = 'Countries1792400000000';

  private readonly SEED: [string, string, string][] = [
    ['saudi-arabia', 'السعودية', 'Saudi Arabia'],
    ['egypt', 'مصر', 'Egypt'],
    ['jordan', 'الأردن', 'Jordan'],
    ['lebanon', 'لبنان', 'Lebanon'],
    ['syria', 'سوريا', 'Syria'],
    ['iraq', 'العراق', 'Iraq'],
    ['palestine', 'فلسطين', 'Palestine'],
    ['kuwait', 'الكويت', 'Kuwait'],
    ['qatar', 'قطر', 'Qatar'],
    ['bahrain', 'البحرين', 'Bahrain'],
    ['oman', 'عُمان', 'Oman'],
    ['uae', 'الإمارات العربية المتحدة', 'United Arab Emirates'],
    ['yemen', 'اليمن', 'Yemen'],
    ['libya', 'ليبيا', 'Libya'],
    ['tunisia', 'تونس', 'Tunisia'],
    ['algeria', 'الجزائر', 'Algeria'],
    ['morocco', 'المغرب', 'Morocco'],
    ['sudan', 'السودان', 'Sudan'],
    ['mauritania', 'موريتانيا', 'Mauritania'],
    ['somalia', 'الصومال', 'Somalia'],
    ['djibouti', 'جيبوتي', 'Djibouti'],
    ['comoros', 'جزر القمر', 'Comoros'],
    ['turkey', 'تركيا', 'Turkey'],
    ['united-states', 'الولايات المتحدة', 'United States'],
    ['united-kingdom', 'المملكة المتحدة', 'United Kingdom'],
    ['germany', 'ألمانيا', 'Germany'],
    ['france', 'فرنسا', 'France'],
    ['canada', 'كندا', 'Canada'],
  ];

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS \`countries\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`code\` VARCHAR(50) NOT NULL,
      \`name_ar\` VARCHAR(100) NOT NULL,
      \`name_en\` VARCHAR(100) NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_countries_code\` (\`code\`)
    ) ${T}`);
    for (const [code, ar, en] of this.SEED) {
      await q.query('INSERT IGNORE INTO `countries` (`code`, `name_ar`, `name_en`) VALUES (?, ?, ?)', [code, ar, en]);
    }
    await q.query(
      "INSERT IGNORE INTO `permissions` (`code`, `name_ar`, `name_en`, `module`) VALUES ('countries.create', 'إضافة دولة', 'Create countries', 'cities')",
    );
    await q.query(
      `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`, \`created_at\`)
       SELECT rp.role_id, pn.id, UTC_TIMESTAMP()
         FROM \`role_permissions\` rp
         JOIN \`permissions\` po ON po.id = rp.permission_id AND po.code = 'cities.create'
         JOIN \`permissions\` pn ON pn.code = 'countries.create'`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM `permissions` WHERE `code` = 'countries.create'");
    await q.query('DROP TABLE IF EXISTS `countries`');
  }
}
