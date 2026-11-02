import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMS: [string, string, string][] = [
  ['services.read', 'عرض الخدمات', 'View services'],
  ['services.create', 'إضافة خدمة', 'Create services'],
  ['services.update', 'تعديل خدمة', 'Update services'],
  ['services.delete', 'حذف خدمة', 'Delete services'],
];

/** One-Stop window settings: opening hours + a temporary notice with an optional date range (YYYY-MM-DD). */
const SETTINGS = ['hours_ar', 'hours_en', 'days_ar', 'days_en', 'notice_ar', 'notice_en', 'notice_from', 'notice_to'];

/**
 * One-Stop window (page 8): one `services` table that also serves the Services page later,
 * its permissions (granted to technical_admin) and the opening-hours settings. Idempotent.
 */
export class AddServicesAndOneStop1762700000000 implements MigrationInterface {
  name = 'AddServicesAndOneStop1762700000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "services" (
        "id" BIGSERIAL PRIMARY KEY,
        "kind" varchar(30) NOT NULL DEFAULT 'other',
        "name_ar" varchar(255) NOT NULL,
        "name_en" varchar(255),
        "description_ar" text,
        "description_en" text,
        "audience_ar" varchar(500),
        "audience_en" varchar(500),
        "documents_ar" text,
        "documents_en" text,
        "steps_ar" text,
        "steps_en" text,
        "location_ar" varchar(255),
        "location_en" varchar(255),
        "department_ar" varchar(150),
        "department_en" varchar(150),
        "duration_ar" varchar(100),
        "duration_en" varchar(100),
        "fee_ar" varchar(150),
        "fee_en" varchar(150),
        "form_url" varchar(500),
        "image" varchar(500),
        "sort_order" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_services_active_order" ON "services" ("is_active", "sort_order")`);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_services_kind" ON "services" ("kind")`);

    const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'services')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'services'
      ON CONFLICT DO NOTHING
    `);

    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ${SETTINGS.map((k) => `('one_stop', ${q(k)}, NULL, 'text', now())`).join(', ')}
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'one_stop'`);
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'services'`);
    await r.query(`DROP TABLE IF EXISTS "services"`);
  }
}
