import { MigrationInterface, QueryRunner } from 'typeorm';
import { DEFAULT_APPOINTMENT_STATUSES } from '../../modules/appointments/appointment-statuses';

const T = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

/** Tools: customers, dates (appointments), their permissions and the editable list of date statuses. */
export class CustomersAppointments1793400000000 implements MigrationInterface {
  name = 'CustomersAppointments1793400000000';

  private readonly PERMS: [string, string, string, string][] = [
    ['customers.read', 'customers', 'عرض العملاء', 'View customers'],
    ['customers.create', 'customers', 'إضافة عميل', 'Create customers'],
    ['customers.update', 'customers', 'تعديل عميل', 'Update customers'],
    ['customers.delete', 'customers', 'حذف عميل', 'Delete customers'],
    ['customers.export', 'customers', 'تصدير العملاء', 'Export customers'],
    ['appointments.read', 'appointments', 'عرض المواعيد', 'View dates'],
    ['appointments.create', 'appointments', 'إضافة موعد', 'Create dates'],
    ['appointments.update', 'appointments', 'تعديل موعد', 'Update dates'],
    ['appointments.delete', 'appointments', 'حذف موعد', 'Delete dates'],
    ['appointments.export', 'appointments', 'تصدير المواعيد', 'Export dates'],
    ['appointments.dashboard', 'appointments', 'لوحة المواعيد', 'Dates dashboard'],
  ];

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS \`customers\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(150) NOT NULL,
      \`phone\` VARCHAR(30) NOT NULL,
      \`age\` TINYINT UNSIGNED NULL,
      \`gender\` ENUM('male','female') NULL,
      \`procedures\` TEXT NULL,
      \`created_by\` BIGINT UNSIGNED NULL,
      \`created_at\` DATETIME NOT NULL,
      \`updated_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_customers_name\` (\`name\`),
      KEY \`idx_customers_phone\` (\`phone\`),
      KEY \`idx_customers_created_by\` (\`created_by\`),
      CONSTRAINT \`fk_customers_creator\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
    ) ${T}`);
    await q.query(`CREATE TABLE IF NOT EXISTS \`appointments\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`customer_id\` BIGINT UNSIGNED NOT NULL,
      \`appointment_date\` DATE NOT NULL,
      \`appointment_time\` TIME NOT NULL,
      \`status\` VARCHAR(50) NOT NULL,
      \`procedures\` TEXT NULL,
      \`created_by\` BIGINT UNSIGNED NULL,
      \`created_at\` DATETIME NOT NULL,
      \`updated_at\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_appointments_when\` (\`appointment_date\`, \`appointment_time\`),
      KEY \`idx_appointments_status\` (\`status\`),
      KEY \`idx_appointments_customer\` (\`customer_id\`),
      KEY \`idx_appointments_created_by\` (\`created_by\`),
      CONSTRAINT \`fk_appointments_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE RESTRICT,
      CONSTRAINT \`fk_appointments_creator\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
    ) ${T}`);
    for (const [code, module, ar, en] of this.PERMS) {
      await q.query('INSERT IGNORE INTO `permissions` (`code`, `name_ar`, `name_en`, `module`) VALUES (?, ?, ?, ?)', [code, ar, en, module]);
    }
    await q.query(
      `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`, \`created_at\`)
       SELECT r.id, p.id, UTC_TIMESTAMP() FROM \`roles\` r JOIN \`permissions\` p ON p.module IN ('customers', 'appointments') WHERE r.code = 'technical_admin'`,
    );
    await q.query(
      "INSERT IGNORE INTO `site_settings` (`category`, `key`, `value`, `value_type`, `updated_at`) VALUES ('appointments', 'statuses', ?, 'json', UTC_TIMESTAMP())",
      [JSON.stringify(DEFAULT_APPOINTMENT_STATUSES)],
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query("DELETE FROM `site_settings` WHERE `category` = 'appointments'");
    await q.query("DELETE FROM `permissions` WHERE `module` IN ('customers', 'appointments')");
    await q.query('DROP TABLE IF EXISTS `appointments`');
    await q.query('DROP TABLE IF EXISTS `customers`');
  }
}
