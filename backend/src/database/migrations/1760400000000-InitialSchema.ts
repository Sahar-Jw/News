import { MigrationInterface, QueryRunner } from 'typeorm';

const T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

export class InitialSchema1760400000000 implements MigrationInterface {
  name = 'InitialSchema1760400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE \`roles\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`code\` VARCHAR(50) NOT NULL,
      \`name_ar\` VARCHAR(100) NOT NULL,
      \`name_en\` VARCHAR(100) NOT NULL,
      \`numeric_value\` INT NULL,
      \`string_value\` VARCHAR(100) NULL,
      \`type\` VARCHAR(50) NULL,
      \`created_at\` DATETIME NOT NULL,
      \`updated_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_roles_code\` (\`code\`),
      UNIQUE KEY \`uq_roles_name_ar\` (\`name_ar\`),
      UNIQUE KEY \`uq_roles_name_en\` (\`name_en\`)
    ) ${T}`);

    await q.query(`CREATE TABLE \`permissions\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`code\` VARCHAR(100) NOT NULL,
      \`name_ar\` VARCHAR(150) NOT NULL,
      \`name_en\` VARCHAR(150) NOT NULL,
      \`module\` VARCHAR(50) NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_permissions_code\` (\`code\`)
    ) ${T}`);

    await q.query(`CREATE TABLE \`role_permissions\` (
      \`role_id\` BIGINT UNSIGNED NOT NULL,
      \`permission_id\` BIGINT UNSIGNED NOT NULL,
      \`created_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`role_id\`, \`permission_id\`),
      KEY \`idx_rp_permission\` (\`permission_id\`),
      CONSTRAINT \`fk_rp_role\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_rp_permission\` FOREIGN KEY (\`permission_id\`) REFERENCES \`permissions\` (\`id\`) ON DELETE CASCADE
    ) ${T}`);

    await q.query(`CREATE TABLE \`cities\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`code\` VARCHAR(50) NOT NULL,
      \`name_ar\` VARCHAR(100) NOT NULL,
      \`name_en\` VARCHAR(100) NOT NULL,
      \`numeric_value\` INT NULL,
      \`string_value\` VARCHAR(100) NULL,
      \`type\` VARCHAR(50) NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_cities_code\` (\`code\`)
    ) ${T}`);

    await q.query(`CREATE TABLE \`users\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`full_name\` VARCHAR(150) NOT NULL,
      \`email\` VARCHAR(190) NOT NULL,
      \`password_hash\` VARCHAR(255) NOT NULL,
      \`role_id\` BIGINT UNSIGNED NOT NULL,
      \`phone\` VARCHAR(30) NULL,
      \`gender\` ENUM('male','female') NULL,
      \`country\` VARCHAR(100) NULL,
      \`city_id\` BIGINT UNSIGNED NULL,
      \`nationality\` VARCHAR(100) NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 0,
      \`avatar_path\` VARCHAR(255) NULL,
      \`bio\` TEXT NULL,
      \`cv_path\` VARCHAR(255) NULL,
      \`social_link\` VARCHAR(500) NULL,
      \`is_expert\` TINYINT(1) NOT NULL DEFAULT 0,
      \`is_researcher\` TINYINT(1) NOT NULL DEFAULT 0,
      \`created_at\` DATETIME NOT NULL,
      \`updated_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_users_email\` (\`email\`),
      KEY \`idx_users_role\` (\`role_id\`),
      KEY \`idx_users_city\` (\`city_id\`),
      CONSTRAINT \`fk_users_role\` FOREIGN KEY (\`role_id\`) REFERENCES \`roles\` (\`id\`) ON DELETE RESTRICT,
      CONSTRAINT \`fk_users_city\` FOREIGN KEY (\`city_id\`) REFERENCES \`cities\` (\`id\`) ON DELETE SET NULL
    ) ${T}`);

    await q.query(`CREATE TABLE \`news\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`title\` VARCHAR(255) NOT NULL,
      \`subject\` VARCHAR(500) NULL,
      \`main_category\` VARCHAR(100) NOT NULL,
      \`subcategory\` VARCHAR(100) NULL,
      \`topics\` JSON NULL,
      \`body\` MEDIUMTEXT NULL,
      \`images\` JSON NULL,
      \`rating\` TINYINT UNSIGNED NULL,
      \`is_featured\` TINYINT(1) NOT NULL DEFAULT 0,
      \`publish_at\` DATETIME NULL,
      \`status\` ENUM('draft','scheduled','published') NOT NULL DEFAULT 'draft',
      \`language\` ENUM('ar','en') NOT NULL,
      \`visibility\` ENUM('public','members') NOT NULL DEFAULT 'public',
      \`view_count\` INT UNSIGNED NOT NULL DEFAULT 0,
      \`created_by\` BIGINT UNSIGNED NULL,
      \`created_at\` DATETIME NOT NULL,
      \`updated_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_news_status_publish\` (\`status\`, \`publish_at\`),
      KEY \`idx_news_listing\` (\`language\`, \`status\`, \`visibility\`, \`main_category\`),
      KEY \`idx_news_featured\` (\`is_featured\`, \`publish_at\`),
      KEY \`idx_news_title\` (\`title\`(191)),
      KEY \`idx_news_created_by\` (\`created_by\`),
      CONSTRAINT \`chk_news_rating\` CHECK (\`rating\` IS NULL OR (\`rating\` BETWEEN 1 AND 5)),
      CONSTRAINT \`fk_news_user\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
    ) ${T}`);

    await q.query(`CREATE TABLE \`audit_logs\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`category\` VARCHAR(50) NOT NULL,
      \`action\` VARCHAR(100) NOT NULL,
      \`description\` VARCHAR(500) NOT NULL,
      \`details\` JSON NULL,
      \`actor_id\` BIGINT UNSIGNED NULL,
      \`entity_type\` VARCHAR(50) NULL,
      \`entity_id\` BIGINT UNSIGNED NULL,
      \`created_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_audit_created_category\` (\`created_at\`, \`category\`),
      KEY \`idx_audit_actor\` (\`actor_id\`),
      CONSTRAINT \`fk_audit_actor\` FOREIGN KEY (\`actor_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
    ) ${T}`);

    await q.query(`CREATE TABLE \`site_settings\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`category\` VARCHAR(50) NOT NULL,
      \`key\` VARCHAR(100) NOT NULL,
      \`value\` TEXT NULL,
      \`value_type\` ENUM('text','number','boolean','url','color','file','json') NOT NULL DEFAULT 'text',
      \`updated_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_settings_category_key\` (\`category\`, \`key\`)
    ) ${T}`);

    await q.query(`CREATE TABLE \`contact_messages\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(150) NOT NULL,
      \`email\` VARCHAR(190) NOT NULL,
      \`subject\` VARCHAR(255) NOT NULL,
      \`message\` TEXT NOT NULL,
      \`is_read\` TINYINT(1) NOT NULL DEFAULT 0,
      \`read_at\` DATETIME NULL,
      \`created_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_contact_read_created\` (\`is_read\`, \`created_at\`)
    ) ${T}`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['contact_messages', 'site_settings', 'audit_logs', 'news', 'users', 'cities', 'role_permissions', 'permissions', 'roles']) {
      await q.query(`DROP TABLE IF EXISTS \`${t}\``);
    }
    await q.query('SET FOREIGN_KEY_CHECKS = 1');
  }
}
