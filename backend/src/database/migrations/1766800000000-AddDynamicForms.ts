import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dashboard-managed forms: form_definitions (fields / statuses / categories / integrations as JSON, so editing a form never needs a schema change),
 * form_submissions (answers + a snapshot of the fields they answered), their files (private/forms/) and the messages sent to applicants. Idempotent.
 */
export class AddDynamicForms1766800000000 implements MigrationInterface {
  name = 'AddDynamicForms1766800000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "form_definitions" (
        "id" bigserial PRIMARY KEY,
        "slug" varchar(80) NOT NULL,
        "title_ar" varchar(200) NOT NULL,
        "title_en" varchar(200),
        "description_ar" text,
        "description_en" text,
        "success_ar" text,
        "success_en" text,
        "is_open" boolean NOT NULL DEFAULT true,
        "is_listed" boolean NOT NULL DEFAULT true,
        "fields" jsonb NOT NULL DEFAULT '[]',
        "statuses" jsonb NOT NULL DEFAULT '[]',
        "categories" jsonb NOT NULL DEFAULT '[]',
        "notify_emails" text,
        "send_receipt" boolean NOT NULL DEFAULT true,
        "require_consent" boolean NOT NULL DEFAULT true,
        "retention_days" integer,
        "integrations" jsonb NOT NULL DEFAULT '[]',
        "version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_form_definitions_slug" ON "form_definitions" ("slug")`);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "form_submissions" (
        "id" bigserial PRIMARY KEY,
        "form_id" bigint NOT NULL REFERENCES "form_definitions"("id") ON DELETE CASCADE,
        "form_version" integer NOT NULL DEFAULT 1,
        "fields_snapshot" jsonb NOT NULL DEFAULT '[]',
        "answers" jsonb NOT NULL DEFAULT '{}',
        "applicant_name" varchar(200),
        "applicant_email" varchar(190),
        "applicant_phone" varchar(60),
        "status" varchar(40) NOT NULL DEFAULT 'new',
        "category" varchar(40),
        "staff_notes" text,
        "is_read" boolean NOT NULL DEFAULT false,
        "consent_at" timestamptz,
        "anonymized_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_form_submissions_form_status" ON "form_submissions" ("form_id", "status")`);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_form_submissions_created" ON "form_submissions" ("created_at")`);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_form_submissions_unread" ON "form_submissions" ("is_read") WHERE "is_read" = false`);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "form_submission_files" (
        "id" bigserial PRIMARY KEY,
        "submission_id" bigint NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
        "field_key" varchar(60) NOT NULL,
        "original_name" varchar(255) NOT NULL,
        "path" varchar(500) NOT NULL,
        "size" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_form_submission_files_sub" ON "form_submission_files" ("submission_id")`);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "form_submission_messages" (
        "id" bigserial PRIMARY KEY,
        "submission_id" bigint NOT NULL REFERENCES "form_submissions"("id") ON DELETE CASCADE,
        "sent_by" bigint,
        "sent_by_name" varchar(150),
        "subject" varchar(255) NOT NULL,
        "body" text NOT NULL,
        "delivered" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_form_submission_messages_sub" ON "form_submission_messages" ("submission_id")`);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DROP TABLE IF EXISTS "form_submission_messages"`);
    await r.query(`DROP TABLE IF EXISTS "form_submission_files"`);
    await r.query(`DROP TABLE IF EXISTS "form_submissions"`);
    await r.query(`DROP TABLE IF EXISTS "form_definitions"`);
  }
}
