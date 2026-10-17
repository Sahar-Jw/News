import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits the coarse permissions into one permission per action and removes "users.create".
 *
 *   roles.manage   -> roles.read, roles.create, roles.update, roles.delete
 *   cities.manage  -> cities.read, cities.create, cities.update, cities.delete
 *   users.update   -> (kept) + users.role.change   (changing a user's role is now separate)
 *   *.read         -> + news.export / users.export / audit.export / messages.export
 *   users.create   -> removed (users are only created by public self-registration)
 *
 * Existing roles keep exactly the access they had before; nothing is gained or lost until
 * an administrator edits a role.
 */
export class GranularPermissions1792300000000 implements MigrationInterface {
  name = 'GranularPermissions1792300000000';

  private readonly NEW: [string, string, string, string][] = [
    ['news.export', 'news', 'تصدير المحتوى', 'Export content'],
    ['users.role.change', 'users', 'تغيير دور مستخدم', "Change a user's role"],
    ['users.export', 'users', 'تصدير المستخدمين', 'Export users'],
    ['roles.read', 'roles', 'عرض الأدوار', 'View roles'],
    ['roles.create', 'roles', 'إنشاء دور', 'Create roles'],
    ['roles.update', 'roles', 'تعديل دور', 'Update roles'],
    ['roles.delete', 'roles', 'حذف دور', 'Delete roles'],
    ['cities.read', 'cities', 'عرض المدن', 'View cities'],
    ['cities.create', 'cities', 'إضافة مدينة', 'Create cities'],
    ['cities.update', 'cities', 'تعديل مدينة', 'Update cities'],
    ['cities.delete', 'cities', 'حذف مدينة', 'Delete cities'],
    ['audit.export', 'audit', 'تصدير سجل التدقيق', 'Export audit log'],
    ['messages.export', 'messages', 'تصدير رسائل التواصل', 'Export contact messages'],
  ];

  /** [old code, new code]: every role holding `old` also receives `new`. */
  private readonly GRANT: [string, string][] = [
    ['roles.manage', 'roles.read'],
    ['roles.manage', 'roles.create'],
    ['roles.manage', 'roles.update'],
    ['roles.manage', 'roles.delete'],
    ['cities.manage', 'cities.read'],
    ['cities.manage', 'cities.create'],
    ['cities.manage', 'cities.update'],
    ['cities.manage', 'cities.delete'],
    ['users.update', 'users.role.change'],
    ['news.read', 'news.export'],
    ['users.read', 'users.export'],
    ['audit.read', 'audit.export'],
    ['messages.read', 'messages.export'],
  ];

  public async up(q: QueryRunner): Promise<void> {
    for (const [code, module, ar, en] of this.NEW) {
      await q.query('INSERT IGNORE INTO `permissions` (`code`, `name_ar`, `name_en`, `module`) VALUES (?, ?, ?, ?)', [code, ar, en, module]);
    }
    for (const [oldCode, newCode] of this.GRANT) {
      await q.query(
        `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`, \`created_at\`)
         SELECT rp.role_id, pn.id, UTC_TIMESTAMP()
           FROM \`role_permissions\` rp
           JOIN \`permissions\` po ON po.id = rp.permission_id AND po.code = ?
           JOIN \`permissions\` pn ON pn.code = ?`,
        [oldCode, newCode],
      );
    }
    // role_permissions rows are removed automatically (ON DELETE CASCADE)
    await q.query("DELETE FROM `permissions` WHERE `code` IN ('users.create', 'roles.manage', 'cities.manage')");
  }

  public async down(q: QueryRunner): Promise<void> {
    const back: [string, string, string, string][] = [
      ['users.create', 'users', 'إضافة مستخدم', 'Create users'],
      ['roles.manage', 'roles', 'إدارة الأدوار', 'Manage roles'],
      ['cities.manage', 'cities', 'إدارة المدن', 'Manage cities'],
    ];
    for (const [code, module, ar, en] of back) {
      await q.query('INSERT IGNORE INTO `permissions` (`code`, `name_ar`, `name_en`, `module`) VALUES (?, ?, ?, ?)', [code, ar, en, module]);
    }
    // roles that could do everything on roles / cities get the old "manage" permission back
    for (const [oldCode, newCode] of [['roles.manage', 'roles.update'], ['cities.manage', 'cities.update']]) {
      await q.query(
        `INSERT IGNORE INTO \`role_permissions\` (\`role_id\`, \`permission_id\`, \`created_at\`)
         SELECT rp.role_id, po.id, UTC_TIMESTAMP()
           FROM \`role_permissions\` rp
           JOIN \`permissions\` pn ON pn.id = rp.permission_id AND pn.code = ?
           JOIN \`permissions\` po ON po.code = ?`,
        [newCode, oldCode],
      );
    }
    await q.query(
      "DELETE FROM `permissions` WHERE `code` IN ('news.export','users.role.change','users.export','roles.read','roles.create','roles.update','roles.delete','cities.read','cities.create','cities.update','cities.delete','audit.export','messages.export')",
    );
  }
}
