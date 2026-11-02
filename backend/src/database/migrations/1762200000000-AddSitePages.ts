import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMS: [string, string, string][] = [
  ['pages.read', 'عرض الصفحات الثابتة', 'View static pages'],
  ['pages.create', 'إضافة صفحة ثابتة', 'Create static pages'],
  ['pages.update', 'تعديل صفحة ثابتة', 'Update static pages'],
  ['pages.delete', 'حذف صفحة ثابتة', 'Delete static pages'],
];

/**
 * Static pages (P2 "About the chamber" and any later page of the same kind) + their permissions.
 * One starter page "about" is created INACTIVE and empty: write its text in Tools -> Pages, then switch it on.
 */
export class AddSitePages1762200000000 implements MigrationInterface {
  name = 'AddSitePages1762200000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "site_pages" (
        "id" BIGSERIAL PRIMARY KEY,
        "slug" varchar(100) NOT NULL,
        "title_ar" varchar(255) NOT NULL,
        "title_en" varchar(255),
        "body_ar" text,
        "body_en" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "show_in_footer" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_site_pages_slug" ON "site_pages" ("slug")`);
    await r.query(`
      INSERT INTO "site_pages" ("slug", "title_ar", "title_en", "sort_order", "is_active", "show_in_footer")
      VALUES ('about', 'عن الغرفة', 'About the chamber', 1, false, true)
      ON CONFLICT ("slug") DO NOTHING
    `);
    const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'pages')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'pages'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'pages'`);
    await r.query(`DROP TABLE IF EXISTS "site_pages"`);
  }
}
