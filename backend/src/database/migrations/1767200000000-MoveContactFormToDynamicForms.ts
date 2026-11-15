import { MigrationInterface, QueryRunner } from 'typeorm';
import { cleanFields } from '../../modules/forms/field-schema';
import { CONTACT_FORM } from '../../modules/forms/legacy-templates';

/**
 * The contact form (every "contact us" box of the site) becomes the dashboard form "contact": its fields are edited from the dashboard,
 * the existing messages are copied into the requests table (the old table stays as an archive), and whoever could read / export contact messages
 * gets the matching permissions of the new requests screen. Idempotent.
 */
export class MoveContactFormToDynamicForms1767200000000 implements MigrationInterface {
  name = 'MoveContactFormToDynamicForms1767200000000';

  public async up(r: QueryRunner): Promise<void> {
    const t = CONTACT_FORM;
    await r.query(
      `INSERT INTO "form_definitions" ("slug", "title_ar", "title_en", "success_ar", "success_en", "is_open", "is_listed", "fields", "statuses", "categories", "send_receipt", "require_consent", "context_type", "dedupe", "integrations", "version")
       VALUES ($1, $2, $3, $4, $5, true, false, $6::jsonb, $7::jsonb, '[]'::jsonb, false, true, NULL, NULL, '[]'::jsonb, 1) ON CONFLICT ("slug") DO NOTHING`,
      [t.slug, t.titleAr, t.titleEn, t.successAr, t.successEn, JSON.stringify(cleanFields(t.fields)), JSON.stringify(t.statuses)],
    );
    // staff e-mail: the site's contact address, if one is set (the old form did not send any mail; the dashboard banner told staff)
    await r.query(`UPDATE "form_definitions" SET "notify_emails" = NULLIF(TRIM((SELECT "value" FROM "site_settings" WHERE "category" = 'contact' AND "key" = 'email')), '') WHERE "slug" = 'contact' AND "notify_emails" IS NULL`);

    await r.query(`INSERT INTO "form_submissions" ("form_id", "form_version", "fields_snapshot", "answers", "context", "applicant_name", "applicant_email", "applicant_phone", "status", "staff_notes", "is_read", "consent_at", "created_at", "updated_at")
      SELECT f."id", 1, f."fields", jsonb_build_object('name', m."name", 'email', m."email", 'subject', m."subject", 'message', m."message"), jsonb_build_object('legacyId', m."id"),
        m."name", m."email", NULL, 'new', NULL, m."is_read", NULL, m."created_at", COALESCE(m."read_at", m."created_at")
      FROM "contact_messages" m CROSS JOIN "form_definitions" f WHERE f."slug" = 'contact'
        AND NOT EXISTS (SELECT 1 FROM "form_submissions" s WHERE s."form_id" = f."id" AND s."context"->>'legacyId' = m."id"::text)`);

    const grants: Record<string, string[]> = {
      'messages.read': ['forms.submissions.read', 'forms.submissions.contact', 'forms.submissions.update'],
      'messages.export': ['forms.submissions.export'],
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

  /** Non-destructive: only the copies made here are removed. */
  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "form_submissions" WHERE "context" ? 'legacyId' AND "form_id" = (SELECT "id" FROM "form_definitions" WHERE "slug" = 'contact')`);
  }
}
