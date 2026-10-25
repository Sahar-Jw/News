import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissions that were missing from "Roles & Permissions" (until now these actions rode on a broader permission):
 *
 *   occasions.export       exporting the occasions table            (used to need only occasions.read)
 *   users.password.reset   setting another user's password          (used to need only users.update)
 *   users.cv.download      downloading a user's private CV file     (used to need only users.read)
 *   news.feature           marking news as featured                 (used to need only create / update news)
 *
 * Existing roles keep exactly the access they had before (same convention as GranularPermissions):
 * a role receives the new permission when it held the broader one it was carved out of. An administrator can then
 * remove it per role from the Roles & Permissions page. technical_admin always receives every permission.
 *
 * (Code change shipped with this migration, no SQL involved: `PATCH /admin/users/:id` with `isActive` now needs
 * users.activate. Before, users.update alone was enough to activate / deactivate an account.)
 */
export class PermissionsUpdate1793500000000 implements MigrationInterface {
  name = 'PermissionsUpdate1793500000000';

  private readonly PERMS: [string, string, string, string][] = [
    ['occasions.export', 'occasions', 'تصدير المناسبات', 'Export occasions'],
    ['users.password.reset', 'users', 'تغيير كلمة مرور مستخدم', "Set a user's password"],
    ['users.cv.download', 'users', 'تنزيل السير الذاتية للمستخدمين', "Download users' CV files"],
    ['news.feature', 'news', 'تمييز الأخبار (إظهارها كمميزة)', 'Mark news as featured'],
  ];

  /** [new code, SQL condition on the permission code a role must already hold to receive it] */
  private readonly GRANT: [string, string, string[]][] = [
    ['occasions.export', 'po.code = ?', ['occasions.read']],
    ['users.password.reset', 'po.code = ?', ['users.update']],
    ['users.cv.download', 'po.code = ?', ['users.read']],
    // featuring was open to anyone who could create or edit news (regular news or any special section)
    ['news.feature', "(po.code LIKE 'news.create%' OR po.code LIKE 'news.update%')", []],
  ];

  public async up(q: QueryRunner): Promise<void> {
    for (const [code, module, ar, en] of this.PERMS) {
      await q.query('INSERT IGNORE INTO `permissions` (`code`, `name_ar`, `name_en`, `module`) VALUES (?, ?, ?, ?)', [code, ar, en, module]);
    }
    for (const [newCode, cond, params] of this.GRANT) {
      await q.query(
        `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`, \`created_at\`)
         SELECT DISTINCT rp.role_id, pn.id, UTC_TIMESTAMP()
           FROM \`role_permissions\` rp
           JOIN \`permissions\` po ON po.id = rp.permission_id AND ${cond}
           JOIN \`permissions\` pn ON pn.code = ?`,
        [...params, newCode],
      );
    }
    // technical_admin holds every permission, always
    await q.query(
      `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`, \`created_at\`)
       SELECT r.id, p.id, UTC_TIMESTAMP() FROM \`roles\` r JOIN \`permissions\` p ON p.code IN (?, ?, ?, ?) WHERE r.code = 'technical_admin'`,
      this.PERMS.map((p) => p[0]),
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    // role_permissions rows go with them (ON DELETE CASCADE)
    await q.query('DELETE FROM `permissions` WHERE `code` IN (?, ?, ?, ?)', this.PERMS.map((p) => p[0]));
  }
}
