import { MigrationInterface, QueryRunner } from 'typeorm';
import { PERMISSIONS } from '../../common/constants';
import { cleanFields } from '../../modules/forms/field-schema';
import { LEGACY_FORMS } from '../../modules/forms/legacy-templates';

/**
 * Moves the nine hard-coded request forms (membership, trainer application, course registration, incubator, EXPO exhibitor / visitor / info,
 * Get2Trade booking / inquiry) onto the dashboard forms engine:
 *  1. columns that tie a form to a course / space and describe its duplicate rule;
 *  2. the nine form definitions (fields exactly as the old pages had them);
 *  3. every existing request copied into form_submissions (answers, status, notes, dates, files, linked course / space) - the old tables stay untouched as an archive;
 *  4. staff e-mail addresses copied from the old settings;
 *  5. new permissions granted to every role that held the matching old permission.
 * Idempotent: running it twice copies nothing twice.
 */
export class MoveLegacyFormsToDynamicForms1767100000000 implements MigrationInterface {
  name = 'MoveLegacyFormsToDynamicForms1767100000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`ALTER TABLE "form_definitions" ADD COLUMN IF NOT EXISTS "context_type" varchar(20)`);
    await r.query(`ALTER TABLE "form_definitions" ADD COLUMN IF NOT EXISTS "dedupe" varchar(20)`);
    await r.query(`ALTER TABLE "form_submissions" ADD COLUMN IF NOT EXISTS "context" jsonb`);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_form_submissions_context_course" ON "form_submissions" ((context->>'courseId')) WHERE context ? 'courseId'`);

    // permissions first (the seed would add them later; the grants below need them now)
    for (const p of PERMISSIONS.filter((x) => x.code.startsWith('forms.') || x.code.startsWith('backups.'))) {
      await r.query(`INSERT INTO "permissions" ("code", "name_ar", "name_en", "module") VALUES ($1, $2, $3, $4) ON CONFLICT ("code") DO NOTHING`, [p.code, p.nameAr, p.nameEn, p.module]);
    }

    // 2. definitions (validated by the same code that validates the dashboard's builder, so a template can never be stored in a shape the engine rejects)
    for (const t of LEGACY_FORMS) {
      const fields = cleanFields(t.fields);
      await r.query(
        `INSERT INTO "form_definitions" ("slug", "title_ar", "title_en", "success_ar", "success_en", "is_open", "is_listed", "fields", "statuses", "categories", "send_receipt", "require_consent", "context_type", "dedupe", "integrations", "version")
         VALUES ($1, $2, $3, $4, $5, true, $6, $7::jsonb, $8::jsonb, $9::jsonb, true, true, $10, $11, '[]'::jsonb, 1) ON CONFLICT ("slug") DO NOTHING`,
        [t.slug, t.titleAr, t.titleEn, t.successAr, t.successEn, t.isListed, JSON.stringify(fields), JSON.stringify(t.statuses), JSON.stringify(t.categories), t.contextType, t.dedupe],
      );
      // 4. who was e-mailed about new requests
      if ('table' in t.notifyFrom) {
        const table = t.notifyFrom.table;
        await r.query(`UPDATE "form_definitions" SET "notify_emails" = COALESCE(NULLIF(TRIM((SELECT "notify_email" FROM "${table}" WHERE "id" = 1)), ''), "notify_emails") WHERE "slug" = $1 AND "notify_emails" IS NULL`, [t.slug]);
      } else {
        const [cat, key] = t.notifyFrom.setting;
        await r.query(
          `UPDATE "form_definitions" SET "notify_emails" = COALESCE(NULLIF(TRIM((SELECT "value" FROM "site_settings" WHERE "category" = $2 AND "key" = $3)), ''), NULLIF(TRIM((SELECT "value" FROM "site_settings" WHERE "category" = 'contact' AND "key" = 'email')), '')) WHERE "slug" = $1 AND "notify_emails" IS NULL`,
          [t.slug, cat, key],
        );
      }
    }
    // the membership "applications closed" switch keeps its value
    await r.query(`UPDATE "form_definitions" SET "is_open" = COALESCE((SELECT "is_open" FROM "membership_settings" WHERE "id" = 1), true) WHERE "slug" = 'membership'`);

    // 3. requests
    const base = `INSERT INTO "form_submissions" ("form_id", "form_version", "fields_snapshot", "answers", "context", "applicant_name", "applicant_email", "applicant_phone", "status", "staff_notes", "is_read", "consent_at", "created_at", "updated_at")`;
    const notCopied = (alias: string) => `NOT EXISTS (SELECT 1 FROM "form_submissions" s WHERE s."form_id" = f."id" AND s."context"->>'legacyId' = ${alias}."id"::text)`;

    await r.query(`${base}
      SELECT f."id", 1, f."fields", jsonb_strip_nulls(jsonb_build_object('manager_name', a."manager_name", 'company_name', a."company_name", 'activity', a."activity", 'business_type', a."business_type", 'business_type_other', a."business_type_other",
        'commercial_reg_no', a."commercial_reg_no", 'registration_date', to_char(a."registration_date", 'YYYY-MM-DD'), 'contact_person', a."contact_person", 'phone', a."phone", 'email', a."email", 'address', a."address", 'message', a."message")),
        jsonb_build_object('legacyId', a."id"), a."manager_name", a."email", a."phone", a."status", a."staff_notes", true, NULL, a."created_at", a."updated_at"
      FROM "membership_applications" a CROSS JOIN "form_definitions" f WHERE f."slug" = 'membership' AND ${notCopied('a')}`);
    await r.query(`INSERT INTO "form_submission_files" ("submission_id", "field_key", "original_name", "path", "size", "created_at")
      SELECT s."id", 'documents', mf."original_name", mf."path", mf."size", mf."created_at" FROM "membership_files" mf JOIN "form_definitions" f ON f."slug" = 'membership'
      JOIN "form_submissions" s ON s."form_id" = f."id" AND s."context"->>'legacyId' = mf."application_id"::text
      WHERE NOT EXISTS (SELECT 1 FROM "form_submission_files" x WHERE x."submission_id" = s."id" AND x."path" = mf."path")`);

    await r.query(`${base}
      SELECT f."id", 1, f."fields", jsonb_strip_nulls(jsonb_build_object('full_name', a."full_name", 'phone', a."phone", 'email', a."email", 'specializations', a."specializations", 'training_fields', a."training_fields",
        'qualification', a."qualification", 'experience', a."experience", 'programs', a."programs", 'bio', a."bio")),
        jsonb_build_object('legacyId', a."id"), a."full_name", a."email", a."phone", a."status", a."staff_notes", true, NULL, a."created_at", a."updated_at"
      FROM "trainer_applications" a CROSS JOIN "form_definitions" f WHERE f."slug" = 'trainer-application' AND ${notCopied('a')}`);
    await r.query(`INSERT INTO "form_submission_files" ("submission_id", "field_key", "original_name", "path", "size", "created_at")
      SELECT s."id", 'cv', a."cv_name", a."cv_path", 0, a."created_at" FROM "trainer_applications" a JOIN "form_definitions" f ON f."slug" = 'trainer-application'
      JOIN "form_submissions" s ON s."form_id" = f."id" AND s."context"->>'legacyId' = a."id"::text
      WHERE NOT EXISTS (SELECT 1 FROM "form_submission_files" x WHERE x."submission_id" = s."id" AND x."path" = a."cv_path")`);
    await r.query(`INSERT INTO "form_submission_files" ("submission_id", "field_key", "original_name", "path", "size", "created_at")
      SELECT s."id", 'certificates', c->>'name', c->>'path', COALESCE((c->>'size')::int, 0), a."created_at" FROM "trainer_applications" a JOIN "form_definitions" f ON f."slug" = 'trainer-application'
      JOIN "form_submissions" s ON s."form_id" = f."id" AND s."context"->>'legacyId' = a."id"::text CROSS JOIN LATERAL jsonb_array_elements(a."certificates") c
      WHERE NOT EXISTS (SELECT 1 FROM "form_submission_files" x WHERE x."submission_id" = s."id" AND x."path" = c->>'path')`);

    await r.query(`${base}
      SELECT f."id", 1, f."fields", jsonb_strip_nulls(jsonb_build_object('name', a."name", 'phone', a."phone", 'email', a."email", 'workplace', a."workplace", 'organization', a."organization", 'job_title', a."job_title",
        'qualification', a."qualification", 'experience', a."experience", 'notes', a."notes")),
        jsonb_strip_nulls(jsonb_build_object('legacyId', a."id", 'courseId', a."course_id", 'courseName', n."title")), a."name", a."email", a."phone", 'new', NULL, true, NULL, a."created_at", a."created_at"
      FROM "course_registrations" a LEFT JOIN "news" n ON n."id" = a."course_id" CROSS JOIN "form_definitions" f WHERE f."slug" = 'course-registration' AND ${notCopied('a')}`);

    await r.query(`${base}
      SELECT f."id", 1, f."fields", jsonb_strip_nulls(jsonb_build_object('project_name', a."project_name", 'founder_name', a."founder_name", 'email', a."email", 'phone', a."phone", 'sector', a."sector", 'stage', a."stage",
        'description', a."description", 'feasibility', a."feasibility", 'target_audience', a."target_audience", 'team', a."team", 'needs', a."needs", 'confirm_data', CASE WHEN a."consent_at" IS NOT NULL THEN true END)),
        jsonb_build_object('legacyId', a."id"), a."founder_name", a."email", a."phone", a."status", a."admin_note", true, a."consent_at", a."created_at", a."updated_at"
      FROM "incubator_applications" a CROSS JOIN "form_definitions" f WHERE f."slug" = 'incubator-application' AND ${notCopied('a')}`);
    await r.query(`INSERT INTO "form_submission_files" ("submission_id", "field_key", "original_name", "path", "size", "created_at")
      SELECT s."id", 'profile', COALESCE(a."profile_name", 'profile'), a."profile_path", 0, a."created_at" FROM "incubator_applications" a JOIN "form_definitions" f ON f."slug" = 'incubator-application'
      JOIN "form_submissions" s ON s."form_id" = f."id" AND s."context"->>'legacyId' = a."id"::text
      WHERE a."profile_path" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "form_submission_files" x WHERE x."submission_id" = s."id" AND x."path" = a."profile_path")`);

    await r.query(`${base}
      SELECT f."id", 1, f."fields", jsonb_strip_nulls(jsonb_build_object('company', a."company", 'name', a."name", 'job_title', a."job_title", 'phone', a."phone", 'email', a."email", 'country', a."country", 'city', a."city",
        'sector', a."sector", 'products', a."products", 'area', a."area", 'participation_type', a."participation_type", 'interest', a."interest", 'inquiry_type', a."inquiry_type", 'message', a."message")),
        jsonb_build_object('legacyId', a."id"), a."name", a."email", a."phone", a."status", a."admin_note", true, NULL, a."created_at", a."updated_at"
      FROM "expo_applications" a JOIN "form_definitions" f ON f."slug" = 'expo-' || a."kind" WHERE ${notCopied('a')}`);
    await r.query(`INSERT INTO "form_submission_files" ("submission_id", "field_key", "original_name", "path", "size", "created_at")
      SELECT s."id", 'profile', regexp_replace(a."profile_file", '^.*/', ''), a."profile_file", 0, a."created_at" FROM "expo_applications" a JOIN "form_definitions" f ON f."slug" = 'expo-' || a."kind"
      JOIN "form_submissions" s ON s."form_id" = f."id" AND s."context"->>'legacyId' = a."id"::text
      WHERE a."profile_file" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "form_submission_files" x WHERE x."submission_id" = s."id" AND x."path" = a."profile_file")`);

    await r.query(`${base}
      SELECT f."id", 1, f."fields", jsonb_strip_nulls(jsonb_build_object('name', a."name", 'company', a."company", 'phone', a."phone", 'email', a."email", 'space', a."space_id"::text, 'package', a."package_id"::text, 'space_kind', a."space_kind",
        'start_date', to_char(a."start_date", 'YYYY-MM-DD'), 'people', a."people", 'duration_value', a."duration_value", 'duration_unit', a."duration_unit", 'extra_services', a."extra_services", 'message', a."message")),
        jsonb_strip_nulls(jsonb_build_object('legacyId', a."id", 'kind', a."kind", 'spaceId', a."space_id", 'spaceName', sp."title", 'packageId', a."package_id", 'packageName', pk."title")),
        a."name", a."email", a."phone", a."status", a."staff_notes", true, NULL, a."created_at", a."updated_at"
      FROM "g2t_bookings" a LEFT JOIN "news" sp ON sp."id" = a."space_id" LEFT JOIN "news" pk ON pk."id" = a."package_id"
      JOIN "form_definitions" f ON f."slug" = 'get2trade-' || a."kind" WHERE ${notCopied('a')}`);

    // 5. permissions: whoever managed the old requests manages the new ones (read also lets them open the attachments, as it did before)
    const grants: Record<string, string[]> = {
      'membership.read': ['forms.submissions.read', 'forms.submissions.sensitive', 'forms.submissions.contact'], 'membership.update': ['forms.submissions.update'], 'membership.export': ['forms.submissions.export'], 'membership.delete': ['forms.submissions.delete'],
      'registrations.read': ['forms.submissions.read', 'forms.submissions.sensitive', 'forms.submissions.contact', 'forms.submissions.update'], 'registrations.export': ['forms.submissions.export'], 'registrations.delete': ['forms.submissions.delete'],
      'expo.applications.read': ['forms.submissions.read', 'forms.submissions.sensitive', 'forms.submissions.contact'], 'expo.applications.update': ['forms.submissions.update'], 'expo.applications.export': ['forms.submissions.export'], 'expo.applications.delete': ['forms.submissions.delete'],
      'incubator.applications.read': ['forms.submissions.read', 'forms.submissions.sensitive', 'forms.submissions.contact'], 'incubator.applications.update': ['forms.submissions.update'], 'incubator.applications.export': ['forms.submissions.export'], 'incubator.applications.delete': ['forms.submissions.delete'],
      'get2trade.read': ['forms.submissions.read', 'forms.submissions.sensitive', 'forms.submissions.contact'], 'get2trade.update': ['forms.submissions.update'], 'get2trade.export': ['forms.submissions.export'], 'get2trade.delete': ['forms.submissions.delete'],
    };
    for (const [old, news] of Object.entries(grants)) {
      await r.query(
        `INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
         SELECT DISTINCT rp."role_id", np."id", now() FROM "role_permissions" rp JOIN "permissions" op ON op."id" = rp."permission_id" AND op."code" = $1 JOIN "permissions" np ON np."code" = ANY($2::text[])
         ON CONFLICT DO NOTHING`,
        [old, news],
      );
    }
  }

  /** Non-destructive: only the copies made by this migration are removed; the old tables were never touched and the forms keep working. */
  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "form_submissions" WHERE "context" ? 'legacyId'`);
  }
}
