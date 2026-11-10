import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Business incubator:
 *  - incubator_applications: economic feasibility, target audience, team, requested support, the optional project profile / study
 *    (private file under private/incubator/) and the date the applicant accepted the privacy policy and confirmed the data.
 *    All nullable, so requests received before this change stay valid;
 *  - page settings "purpose" (what the projects are for) and "entrepreneurs" (the entrepreneurs the incubator serves). Idempotent.
 */
export class AddIncubatorApplicationDetails1765600000000 implements MigrationInterface {
  name = 'AddIncubatorApplicationDetails1765600000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      ALTER TABLE "incubator_applications"
        ADD COLUMN IF NOT EXISTS "feasibility" text,
        ADD COLUMN IF NOT EXISTS "target_audience" text,
        ADD COLUMN IF NOT EXISTS "team" text,
        ADD COLUMN IF NOT EXISTS "needs" text,
        ADD COLUMN IF NOT EXISTS "profile_path" varchar(500),
        ADD COLUMN IF NOT EXISTS "profile_name" varchar(255),
        ADD COLUMN IF NOT EXISTS "consent_at" timestamptz
    `);
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ('incubator', 'purpose_ar', NULL, 'text', now()),
             ('incubator', 'purpose_en', NULL, 'text', now()),
             ('incubator', 'entrepreneurs_ar', NULL, 'text', now()),
             ('incubator', 'entrepreneurs_en', NULL, 'text', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'incubator' AND "key" IN ('purpose_ar', 'purpose_en', 'entrepreneurs_ar', 'entrepreneurs_en')`);
    await r.query(`
      ALTER TABLE "incubator_applications"
        DROP COLUMN IF EXISTS "feasibility",
        DROP COLUMN IF EXISTS "target_audience",
        DROP COLUMN IF EXISTS "team",
        DROP COLUMN IF EXISTS "needs",
        DROP COLUMN IF EXISTS "profile_path",
        DROP COLUMN IF EXISTS "profile_name",
        DROP COLUMN IF EXISTS "consent_at"
    `);
  }
}
