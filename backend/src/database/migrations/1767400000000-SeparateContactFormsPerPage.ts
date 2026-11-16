import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Every page with a "contact us" box gets its own dashboard form, so its messages are managed from that page's own settings (and the
 * new-message notification of that page goes there, only to the people who manage that page):
 *   contact-one-stop  - the One-Stop page and the service pages
 *   contact-women     - the Women Business Committee page
 * The home page and the contact page keep the main form "contact". Each new form starts as a copy of the main one (fields, statuses, staff e-mail),
 * then can be edited on its own in the form builder. Messages already sent from those pages (their subject starts with the page tag) are moved
 * to the page's form. Idempotent.
 */
export class SeparateContactFormsPerPage1767400000000 implements MigrationInterface {
  name = 'SeparateContactFormsPerPage1767400000000';

  private readonly pages = [
    { slug: 'contact-one-stop', titleAr: 'تواصل معنا - النافذة الواحدة', titleEn: 'Contact us - One-Stop', tags: ['[النافذة الواحدة] %', '[One-Stop] %'] },
    { slug: 'contact-women', titleAr: 'تواصل معنا - لجنة سيدات الأعمال', titleEn: 'Contact us - Women Business Committee', tags: ['[لجنة سيدات الأعمال] %', '[Women Business Committee] %'] },
  ];

  public async up(r: QueryRunner): Promise<void> {
    for (const p of this.pages) {
      await r.query(
        `INSERT INTO "form_definitions" ("slug", "title_ar", "title_en", "success_ar", "success_en", "is_open", "is_listed", "fields", "statuses", "categories", "send_receipt", "require_consent", "context_type", "dedupe", "integrations", "notify_emails", "version")
         SELECT $1, $2, $3, "success_ar", "success_en", "is_open", false, "fields", "statuses", "categories", "send_receipt", "require_consent", NULL, NULL, '[]'::jsonb, "notify_emails", 1
         FROM "form_definitions" WHERE "slug" = 'contact'
         ON CONFLICT ("slug") DO NOTHING`,
        [p.slug, p.titleAr, p.titleEn],
      );
      // the messages this page already received (they were filed under the main form, tagged in the subject)
      await r.query(
        `UPDATE "form_submissions" s SET "form_id" = n."id"
         FROM "form_definitions" n, "form_definitions" c
         WHERE n."slug" = $1 AND c."slug" = 'contact' AND s."form_id" = c."id" AND (s."answers"->>'subject') LIKE ANY($2::text[])`,
        [p.slug, p.tags],
      );
    }
  }

  public async down(r: QueryRunner): Promise<void> {
    for (const p of this.pages) {
      await r.query(
        `UPDATE "form_submissions" s SET "form_id" = c."id" FROM "form_definitions" n, "form_definitions" c WHERE n."slug" = $1 AND c."slug" = 'contact' AND s."form_id" = n."id"`,
        [p.slug],
      );
      await r.query(`DELETE FROM "form_definitions" WHERE "slug" = $1`, [p.slug]);
    }
  }
}
