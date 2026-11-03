import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMS: [string, string, string][] = [
  ['membership.read', 'عرض طلبات الانتساب ومرفقاتها', 'View membership applications and their documents'],
  ['membership.update', 'معالجة طلبات الانتساب وتعديل محتوى الصفحة', 'Process applications and edit the page content'],
  ['membership.delete', 'حذف طلبات الانتساب', 'Delete membership applications'],
  ['membership.export', 'تصدير طلبات الانتساب', 'Export membership applications'],
];

const STEPS_AR = ['قدّم الطلب', 'ارفع الوثائق', 'ادفع الرسوم', 'المراجعة', 'استلم الانتساب'].join('\n');
const STEPS_EN = ['Submit the request', 'Upload the documents', 'Pay the fees', 'Review', 'Receive the membership'].join('\n');

/**
 * Page 15 (Membership):
 *  - membership_settings: one row with the page texts (conditions, documents, fees, steps) and the notification address
 *  - membership_applications + membership_files (documents are stored under private/membership/, readable with membership.read)
 *  - membership.* permissions (granted to technical_admin) and a "Membership" link in the Services group of the editable main menu.
 * The conditions / documents / fees texts start empty: the chamber writes its approved rules from the admin screen. Idempotent.
 */
export class AddMembership1763300000000 implements MigrationInterface {
  name = 'AddMembership1763300000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "membership_settings" (
        "id" integer PRIMARY KEY,
        "conditions_ar" text, "conditions_en" text,
        "documents_ar" text, "documents_en" text,
        "fees_ar" text, "fees_en" text,
        "steps_ar" text, "steps_en" text,
        "notify_email" varchar(190),
        "is_open" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
    await r.query(`INSERT INTO "membership_settings" ("id", "steps_ar", "steps_en") VALUES (1, ${q(STEPS_AR)}, ${q(STEPS_EN)}) ON CONFLICT ("id") DO NOTHING`);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "membership_applications" (
        "id" BIGSERIAL PRIMARY KEY,
        "company_name" varchar(255) NOT NULL,
        "activity" varchar(255) NOT NULL,
        "manager_name" varchar(150) NOT NULL,
        "phone" varchar(50) NOT NULL,
        "email" varchar(190) NOT NULL,
        "address" varchar(500),
        "message" text,
        "status" varchar(20) NOT NULL DEFAULT 'new',
        "staff_notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_membership_applications_status" ON "membership_applications" ("status", "created_at")`);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "membership_files" (
        "id" BIGSERIAL PRIMARY KEY,
        "application_id" bigint NOT NULL REFERENCES "membership_applications"("id") ON DELETE CASCADE,
        "original_name" varchar(255) NOT NULL,
        "path" varchar(500) NOT NULL,
        "size" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_membership_files_application" ON "membership_files" ("application_id")`);

    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'membership')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'membership'
      ON CONFLICT DO NOTHING
    `);

    // the editable main menu: add the link to the Services group once (skipped when the menu tables or the group do not exist)
    const hasNav = (await r.query(`SELECT to_regclass('public.nav_items') AS t`))[0]?.t;
    if (hasNav) {
      await r.query(`
        INSERT INTO "nav_items" ("group_id", "title_ar", "title_en", "url", "sort_order")
        SELECT g."id", 'للانتساب', 'Membership', '/membership', COALESCE((SELECT MAX("sort_order") + 1 FROM "nav_items" WHERE "group_id" = g."id"), 0)
        FROM "nav_groups" g
        WHERE g."title_ar" = 'الخدمات' AND NOT EXISTS (SELECT 1 FROM "nav_items" WHERE "url" = '/membership')
        ORDER BY g."id" LIMIT 1
      `);
    }
  }

  public async down(r: QueryRunner): Promise<void> {
    const hasNav = (await r.query(`SELECT to_regclass('public.nav_items') AS t`))[0]?.t;
    if (hasNav) await r.query(`DELETE FROM "nav_items" WHERE "url" = '/membership'`);
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'membership'`);
    await r.query(`DROP TABLE IF EXISTS "membership_files"`);
    await r.query(`DROP TABLE IF EXISTS "membership_applications"`);
    await r.query(`DROP TABLE IF EXISTS "membership_settings"`);
  }
}
