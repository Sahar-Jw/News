import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMS: [string, string, string][] = [
  ['committees.read', 'عرض اللجان', 'View committees'],
  ['committees.create', 'إضافة لجنة', 'Create committees'],
  ['committees.update', 'تعديل لجنة وأعضائها وأنشطتها وأخبارها', 'Update committees, members, activities and linked news'],
  ['committees.delete', 'حذف لجنة', 'Delete committees'],
];

/**
 * Pages 6 and 11 (committees and the businesswomen committee):
 *  - committees (kind sector|women), committee_members, committee_activities (meeting|visit|recommendation|initiative)
 *  - content_links: generic news <-> entity links ("smart archiving"), used by committees now and by events/courses/expos later
 *  - committees.* permissions (granted to technical_admin). Idempotent.
 */
export class AddCommittees1762500000000 implements MigrationInterface {
  name = 'AddCommittees1762500000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "committees" (
        "id" BIGSERIAL PRIMARY KEY,
        "kind" varchar(20) NOT NULL DEFAULT 'sector',
        "name_ar" varchar(255) NOT NULL,
        "name_en" varchar(255),
        "summary_ar" text,
        "summary_en" text,
        "duties_ar" text,
        "duties_en" text,
        "chair_name_ar" varchar(255),
        "chair_name_en" varchar(255),
        "activity_tags_ar" text,
        "activity_tags_en" text,
        "logo" varchar(500),
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_committees_kind" ON "committees" ("kind", "is_active", "sort_order")`);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "committee_members" (
        "id" BIGSERIAL PRIMARY KEY,
        "committee_id" bigint NOT NULL REFERENCES "committees"("id") ON DELETE CASCADE,
        "role" varchar(20) NOT NULL DEFAULT 'member',
        "name_ar" varchar(255) NOT NULL,
        "name_en" varchar(255),
        "title_ar" varchar(255),
        "title_en" varchar(255),
        "photo" varchar(500),
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_committee_members_committee" ON "committee_members" ("committee_id", "sort_order")`);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "committee_activities" (
        "id" BIGSERIAL PRIMARY KEY,
        "committee_id" bigint NOT NULL REFERENCES "committees"("id") ON DELETE CASCADE,
        "kind" varchar(20) NOT NULL,
        "title_ar" varchar(255) NOT NULL,
        "title_en" varchar(255),
        "body_ar" text,
        "body_en" text,
        "event_date" date,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_committee_activities_committee" ON "committee_activities" ("committee_id", "kind", "event_date")`);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "content_links" (
        "id" BIGSERIAL PRIMARY KEY,
        "news_id" bigint NOT NULL REFERENCES "news"("id") ON DELETE CASCADE,
        "entity_type" varchar(30) NOT NULL,
        "entity_id" bigint NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_content_links" ON "content_links" ("news_id", "entity_type", "entity_id")`);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_content_links_entity" ON "content_links" ("entity_type", "entity_id")`);

    const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'committees')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'committees'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'committees'`);
    await r.query(`DROP TABLE IF EXISTS "content_links"`);
    await r.query(`DROP TABLE IF EXISTS "committee_activities"`);
    await r.query(`DROP TABLE IF EXISTS "committee_members"`);
    await r.query(`DROP TABLE IF EXISTS "committees"`);
  }
}
