import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Training Center:
 *  - course_registrations: workplace, job title, qualification, experience (optional) and notes asked by the registration form
 *    (nullable, so registrations received before this change stay valid);
 *  - trainer_applications: the public "register as a trainer" form (CV and certificates live under private/trainers/). Idempotent.
 */
export class TrainingRegistrationAndTrainerApplications1765400000000 implements MigrationInterface {
  name = 'TrainingRegistrationAndTrainerApplications1765400000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      ALTER TABLE "course_registrations"
        ADD COLUMN IF NOT EXISTS "workplace" varchar(150),
        ADD COLUMN IF NOT EXISTS "job_title" varchar(150),
        ADD COLUMN IF NOT EXISTS "qualification" varchar(255),
        ADD COLUMN IF NOT EXISTS "experience" text,
        ADD COLUMN IF NOT EXISTS "notes" text
    `);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "trainer_applications" (
        "id" BIGSERIAL PRIMARY KEY,
        "full_name" varchar(150) NOT NULL,
        "phone" varchar(30) NOT NULL,
        "email" varchar(190) NOT NULL,
        "specializations" text NOT NULL,
        "training_fields" text NOT NULL,
        "qualification" varchar(255) NOT NULL,
        "experience" text NOT NULL,
        "programs" text NOT NULL,
        "bio" text NOT NULL,
        "cv_path" varchar(500) NOT NULL,
        "cv_name" varchar(255) NOT NULL,
        "certificates" jsonb NOT NULL DEFAULT '[]',
        "status" varchar(20) NOT NULL DEFAULT 'new',
        "staff_notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_trainer_applications_status" ON "trainer_applications" ("status", "created_at")`);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DROP TABLE IF EXISTS "trainer_applications"`);
    await r.query(`
      ALTER TABLE "course_registrations"
        DROP COLUMN IF EXISTS "workplace",
        DROP COLUMN IF EXISTS "job_title",
        DROP COLUMN IF EXISTS "qualification",
        DROP COLUMN IF EXISTS "experience",
        DROP COLUMN IF EXISTS "notes"
    `);
  }
}
