import { MigrationInterface, QueryRunner } from 'typeorm';

const T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

/**
 * - password reset by e-mail: table `password_resets` + `users.password_changed_at`
 * - repairs `ads` / `subscribers` when a table with that name already existed with other columns
 *   (CREATE TABLE IF NOT EXISTS skipped it): the old table is renamed to <name>_old_<date> (data kept) and recreated
 * - subscribers that never confirmed their e-mail become inactive (they activate by confirming)
 */
export class PasswordResetAndTableFix1793300000000 implements MigrationInterface {
  name = 'PasswordResetAndTableFix1793300000000';

  private async has(q: QueryRunner, table: string, column?: string): Promise<boolean> {
    const sql = column
      ? 'SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?'
      : 'SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?';
    const [r] = await q.query(sql, column ? [table, column] : [table]);
    return Number(r.c) > 0;
  }

  private async parkWrongTable(q: QueryRunner, table: string, mustHave: string) {
    if ((await this.has(q, table)) && !(await this.has(q, table, mustHave))) {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      await q.query(`RENAME TABLE \`${table}\` TO \`${table}_old_${stamp}\``);
    }
  }

  public async up(q: QueryRunner): Promise<void> {
    await this.parkWrongTable(q, 'ads', 'owner_company');
    await this.parkWrongTable(q, 'subscribers', 'remember_token');

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
      CONSTRAINT \`fk_ads_creator\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
    ) ${T}`);
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
    await q.query('UPDATE `subscribers` SET `is_active` = 0 WHERE `is_verified` = 0');

    if (!(await this.has(q, 'users', 'password_changed_at'))) {
      await q.query('ALTER TABLE `users` ADD COLUMN `password_changed_at` DATETIME NULL');
    }
    await q.query(`CREATE TABLE IF NOT EXISTS \`password_resets\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`user_id\` BIGINT UNSIGNED NOT NULL,
      \`token_hash\` CHAR(64) NOT NULL,
      \`expires_at\` DATETIME NOT NULL,
      \`used_at\` DATETIME NULL,
      \`created_at\` DATETIME NOT NULL,
      \`updated_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_password_resets_token\` (\`token_hash\`),
      KEY \`idx_password_resets_user\` (\`user_id\`),
      CONSTRAINT \`fk_password_resets_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
    ) ${T}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS `password_resets`');
    if (await this.has(q, 'users', 'password_changed_at')) await q.query('ALTER TABLE `users` DROP COLUMN `password_changed_at`');
  }
}
