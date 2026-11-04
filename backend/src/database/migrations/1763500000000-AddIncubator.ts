import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMS: [string, string, string][] = [
  ['incubator.read', 'عرض مشاريع الحاضنة', 'View incubator projects'],
  ['incubator.create', 'إضافة مشروع للحاضنة', 'Create incubator projects'],
  ['incubator.update', 'تعديل مشاريع الحاضنة', 'Update incubator projects'],
  ['incubator.delete', 'حذف مشاريع الحاضنة', 'Delete incubator projects'],
  ['incubator.applications.read', 'عرض طلبات الحاضنة', 'View incubator applications'],
  ['incubator.applications.update', 'معالجة طلبات الحاضنة', 'Process incubator applications'],
  ['incubator.applications.export', 'تصدير طلبات الحاضنة', 'Export incubator applications'],
  ['incubator.applications.delete', 'حذف طلبات الحاضنة', 'Delete incubator applications'],
];

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

/**
 * Business Incubator (P10): incubator_projects (incubated / graduated with their success stories), incubator_applications
 * ("submit your project" requests), the incubator.* permissions (granted to technical_admin) and the "incubator" settings
 * category (about, vision, goals, how it works, opportunities, news tag, notification e-mail, form switch). Idempotent.
 */
export class AddIncubator1763500000000 implements MigrationInterface {
  name = 'AddIncubator1763500000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "incubator_projects" (
        "id" BIGSERIAL PRIMARY KEY,
        "status" varchar(20) NOT NULL DEFAULT 'incubated',
        "name_ar" varchar(190) NOT NULL,
        "name_en" varchar(190),
        "sector_ar" varchar(150),
        "sector_en" varchar(150),
        "founder_ar" varchar(150),
        "founder_en" varchar(150),
        "summary_ar" text,
        "summary_en" text,
        "story_ar" text,
        "story_en" text,
        "joined_year" int,
        "website" varchar(500),
        "image" varchar(500),
        "sort_order" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_incubator_projects_status" ON "incubator_projects" ("status", "sort_order")`);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "incubator_applications" (
        "id" BIGSERIAL PRIMARY KEY,
        "status" varchar(20) NOT NULL DEFAULT 'new',
        "project_name" varchar(190) NOT NULL,
        "founder_name" varchar(150) NOT NULL,
        "email" varchar(190) NOT NULL,
        "phone" varchar(30) NOT NULL,
        "sector" varchar(150),
        "stage" varchar(20),
        "description" text NOT NULL,
        "admin_note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_incubator_applications_status" ON "incubator_applications" ("status", "created_at")`);

    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'incubator')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'incubator'
      ON CONFLICT DO NOTHING
    `);

    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ('incubator', 'about_ar', NULL, 'text', now()),
             ('incubator', 'about_en', NULL, 'text', now()),
             ('incubator', 'vision_ar', NULL, 'text', now()),
             ('incubator', 'vision_en', NULL, 'text', now()),
             ('incubator', 'goals_ar', NULL, 'text', now()),
             ('incubator', 'goals_en', NULL, 'text', now()),
             ('incubator', 'how_ar', NULL, 'text', now()),
             ('incubator', 'how_en', NULL, 'text', now()),
             ('incubator', 'opportunities_ar', NULL, 'text', now()),
             ('incubator', 'opportunities_en', NULL, 'text', now()),
             ('incubator', 'news_topic_ar', 'حاضنة الأعمال', 'text', now()),
             ('incubator', 'news_topic_en', 'Business Incubator', 'text', now()),
             ('incubator', 'officer_email', NULL, 'text', now()),
             ('incubator', 'apply_open', 'true', 'boolean', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'incubator'`);
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'incubator'`);
    await r.query(`DROP TABLE IF EXISTS "incubator_applications"`);
    await r.query(`DROP TABLE IF EXISTS "incubator_projects"`);
  }
}
