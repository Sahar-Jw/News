import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMS: [string, string, string][] = [
  ['courses.read', 'عرض الدورات والمدربين', 'View courses and trainers'],
  ['courses.create', 'إضافة دورة أو مدرب', 'Create courses and trainers'],
  ['courses.update', 'تعديل دورة أو مدرب', 'Update courses and trainers'],
  ['courses.delete', 'حذف دورة أو مدرب', 'Delete courses and trainers'],
  ['registrations.read', 'عرض المسجلين في الدورات', 'View course registrations'],
  ['registrations.export', 'تصدير المسجلين في الدورات', 'Export course registrations'],
  ['registrations.delete', 'حذف تسجيل في دورة', 'Delete course registrations'],
];

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

/**
 * Administrative Training Center (page 9): trainers, courses and course registrations, their permissions
 * (granted to technical_admin) and two settings: the training officer's e-mail and the news topic of the "center news" tab.
 * Current vs archive is computed from the dates when the list is queried, so no scheduled job is needed. Idempotent.
 */
export class AddTrainingCenter1763000000000 implements MigrationInterface {
  name = 'AddTrainingCenter1763000000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "trainers" (
        "id" BIGSERIAL PRIMARY KEY,
        "name_ar" varchar(150) NOT NULL,
        "name_en" varchar(150),
        "bio_ar" text,
        "bio_en" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "courses" (
        "id" BIGSERIAL PRIMARY KEY,
        "kind" varchar(20) NOT NULL DEFAULT 'course',
        "name_ar" varchar(255) NOT NULL,
        "name_en" varchar(255),
        "field_ar" varchar(150),
        "field_en" varchar(150),
        "topics_ar" text,
        "topics_en" text,
        "audience_ar" varchar(255),
        "audience_en" varchar(255),
        "trainer_id" bigint REFERENCES "trainers" ("id") ON DELETE SET NULL,
        "start_date" date NOT NULL,
        "end_date" date,
        "hours" int,
        "location_ar" varchar(255),
        "location_en" varchar(255),
        "fee_ar" varchar(150),
        "fee_en" varchar(150),
        "capacity" int,
        "registration_closed" boolean NOT NULL DEFAULT false,
        "image" varchar(500),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_courses_dates" ON "courses" ("start_date", "end_date")`);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_courses_trainer" ON "courses" ("trainer_id")`);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "course_registrations" (
        "id" BIGSERIAL PRIMARY KEY,
        "course_id" bigint NOT NULL REFERENCES "courses" ("id") ON DELETE CASCADE,
        "name" varchar(150) NOT NULL,
        "email" varchar(190) NOT NULL,
        "phone" varchar(30) NOT NULL,
        "organization" varchar(150),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_course_registration_email" ON "course_registrations" ("course_id", "email")`);

    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'training')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'training'
      ON CONFLICT DO NOTHING
    `);

    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ('training', 'officer_email', NULL, 'text', now()),
             ('training', 'news_topic_ar', 'مركز التدريب', 'text', now()),
             ('training', 'news_topic_en', 'Training Center', 'text', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'training'`);
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'training'`);
    await r.query(`DROP TABLE IF EXISTS "course_registrations"`);
    await r.query(`DROP TABLE IF EXISTS "courses"`);
    await r.query(`DROP TABLE IF EXISTS "trainers"`);
  }
}
