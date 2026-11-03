import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMS: [string, string, string][] = [
  ['expo.read', 'عرض محتوى المعرض', 'View EXPO content'],
  ['expo.create', 'إضافة عارض أو راعٍ أو جلسة', 'Create EXPO exhibitors, sponsors and sessions'],
  ['expo.update', 'تعديل محتوى المعرض', 'Update EXPO content'],
  ['expo.delete', 'حذف محتوى المعرض', 'Delete EXPO content'],
  ['expo.applications.read', 'عرض طلبات المعرض', 'View EXPO applications'],
  ['expo.applications.update', 'معالجة طلبات المعرض', 'Process EXPO applications'],
  ['expo.applications.export', 'تصدير طلبات المعرض', 'Export EXPO applications'],
  ['expo.applications.delete', 'حذف طلبات المعرض', 'Delete EXPO applications'],
];

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

/**
 * DCC EXPO (page 14): expo_items (exhibitors, sponsors and programme sessions, told apart by "kind"), expo_applications
 * (stand requests, visitor registrations and information requests), their permissions (granted to technical_admin) and the
 * "expo" settings category (event info, identity colours, contact). Idempotent.
 */
export class AddDccExpo1763200000000 implements MigrationInterface {
  name = 'AddDccExpo1763200000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "expo_items" (
        "id" BIGSERIAL PRIMARY KEY,
        "kind" varchar(20) NOT NULL,
        "name_ar" varchar(255) NOT NULL,
        "name_en" varchar(255),
        "description_ar" text,
        "description_en" text,
        "sector_ar" varchar(150),
        "sector_en" varchar(150),
        "category" varchar(30),
        "person_ar" varchar(150),
        "person_en" varchar(150),
        "place_ar" varchar(150),
        "place_en" varchar(150),
        "starts_at" timestamptz,
        "ends_at" timestamptz,
        "website" varchar(500),
        "logo" varchar(500),
        "sort_order" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_expo_items_kind" ON "expo_items" ("kind", "sort_order")`);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "expo_applications" (
        "id" BIGSERIAL PRIMARY KEY,
        "kind" varchar(20) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'new',
        "name" varchar(150) NOT NULL,
        "company" varchar(190),
        "email" varchar(190) NOT NULL,
        "phone" varchar(30) NOT NULL,
        "sector" varchar(150),
        "message" text,
        "admin_note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_expo_applications_kind" ON "expo_applications" ("kind", "status")`);

    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'expo')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'expo'
      ON CONFLICT DO NOTHING
    `);

    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ('expo', 'name_ar', 'DCC EXPO', 'text', now()),
             ('expo', 'name_en', 'DCC EXPO', 'text', now()),
             ('expo', 'tagline_ar', 'معرض غرفة تجارة دمشق', 'text', now()),
             ('expo', 'tagline_en', 'Damascus Chamber of Commerce Expo', 'text', now()),
             ('expo', 'about_ar', NULL, 'text', now()),
             ('expo', 'about_en', NULL, 'text', now()),
             ('expo', 'why_ar', NULL, 'text', now()),
             ('expo', 'why_en', NULL, 'text', now()),
             ('expo', 'start_date', NULL, 'text', now()),
             ('expo', 'end_date', NULL, 'text', now()),
             ('expo', 'venue_ar', NULL, 'text', now()),
             ('expo', 'venue_en', NULL, 'text', now()),
             ('expo', 'hero_image', NULL, 'file', now()),
             ('expo', 'logo', NULL, 'file', now()),
             ('expo', 'primary_color', '#4b1d7a', 'color', now()),
             ('expo', 'accent_color', '#c9a227', 'color', now()),
             ('expo', 'contact_email', NULL, 'text', now()),
             ('expo', 'contact_phone', NULL, 'text', now()),
             ('expo', 'news_topic_ar', 'المعرض', 'text', now()),
             ('expo', 'news_topic_en', 'EXPO', 'text', now()),
             ('expo', 'register_open', 'true', 'boolean', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'expo'`);
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'expo'`);
    await r.query(`DROP TABLE IF EXISTS "expo_applications"`);
    await r.query(`DROP TABLE IF EXISTS "expo_items"`);
  }
}
