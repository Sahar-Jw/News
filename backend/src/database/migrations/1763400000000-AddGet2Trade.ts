import { MigrationInterface, QueryRunner } from 'typeorm';

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

const PERMS: [string, string, string][] = [
  ['get2trade.read', 'عرض غيت تو تريد (المساحات والباقات والطلبات)', 'View Get2Trade (spaces, packages, bookings)'],
  ['get2trade.create', 'إضافة مساحة أو باقة', 'Create Get2Trade spaces and packages'],
  ['get2trade.update', 'تعديل غيت تو تريد ومعالجة الطلبات', 'Edit Get2Trade and process bookings'],
  ['get2trade.delete', 'حذف مساحة أو باقة أو طلب', 'Delete Get2Trade spaces, packages and bookings'],
  ['get2trade.export', 'تصدير طلبات غيت تو تريد', 'Export Get2Trade bookings'],
];

/**
 * Get2Trade (page 12, flexible offices): the page content (one settings row), packages, bookable spaces and the
 * booking/inquiry requests, their permissions (granted to technical_admin) and a link in the "Development & business"
 * menu group. Deleting a space or package keeps the requests that mention it. Idempotent.
 */
export class AddGet2Trade1763400000000 implements MigrationInterface {
  name = 'AddGet2Trade1763400000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "g2t_settings" (
        "id" int PRIMARY KEY,
        "about_ar" text, "about_en" text,
        "services_ar" text, "services_en" text,
        "news_topic_ar" varchar(100), "news_topic_en" varchar(100),
        "notify_email" varchar(190),
        "is_open" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`
      INSERT INTO "g2t_settings" ("id", "news_topic_ar", "news_topic_en") VALUES (1, 'غيت تو تريد', 'Get2Trade')
      ON CONFLICT ("id") DO NOTHING
    `);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "g2t_packages" (
        "id" BIGSERIAL PRIMARY KEY,
        "name_ar" varchar(150) NOT NULL,
        "name_en" varchar(150),
        "features_ar" text, "features_en" text,
        "price_ar" varchar(150), "price_en" varchar(150),
        "sort_order" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "g2t_spaces" (
        "id" BIGSERIAL PRIMARY KEY,
        "kind" varchar(20) NOT NULL DEFAULT 'office',
        "name_ar" varchar(150) NOT NULL,
        "name_en" varchar(150),
        "description_ar" text, "description_en" text,
        "capacity" int,
        "area_sqm" int,
        "price_ar" varchar(150), "price_en" varchar(150),
        "image" varchar(500),
        "is_available" boolean NOT NULL DEFAULT true,
        "sort_order" int NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "g2t_bookings" (
        "id" BIGSERIAL PRIMARY KEY,
        "kind" varchar(10) NOT NULL DEFAULT 'booking',
        "space_id" bigint REFERENCES "g2t_spaces" ("id") ON DELETE SET NULL,
        "package_id" bigint REFERENCES "g2t_packages" ("id") ON DELETE SET NULL,
        "name" varchar(150) NOT NULL,
        "company" varchar(150),
        "phone" varchar(50) NOT NULL,
        "email" varchar(190) NOT NULL,
        "start_date" date,
        "people" int,
        "message" text,
        "status" varchar(20) NOT NULL DEFAULT 'new',
        "staff_notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_g2t_bookings_status" ON "g2t_bookings" ("status", "created_at")`);

    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'get2trade')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'get2trade'
      ON CONFLICT DO NOTHING
    `);

    // the menu is editable now: add the link once to the "Development & business" group (skipped when the group is gone or the link exists)
    await r.query(`
      INSERT INTO "nav_items" ("group_id", "title_ar", "title_en", "url", "sort_order")
      SELECT g."id", 'غيت تو تريد', 'Get2Trade', '/get2trade', COALESCE((SELECT MAX("sort_order") + 1 FROM "nav_items" WHERE "group_id" = g."id"), 0)
      FROM "nav_groups" g
      WHERE g."title_ar" = 'التطوير والأعمال'
        AND NOT EXISTS (SELECT 1 FROM "nav_items" i WHERE i."url" = '/get2trade')
      ORDER BY g."id" LIMIT 1
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "nav_items" WHERE "url" = '/get2trade'`);
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'get2trade'`);
    await r.query(`DROP TABLE IF EXISTS "g2t_bookings"`);
    await r.query(`DROP TABLE IF EXISTS "g2t_spaces"`);
    await r.query(`DROP TABLE IF EXISTS "g2t_packages"`);
    await r.query(`DROP TABLE IF EXISTS "g2t_settings"`);
  }
}
