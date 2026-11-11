import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Home page / footer clean-up:
 *  - the "Contact us" card of the home page is gone (the contact page has everything), so its settings (sections_home.contact_*) are removed
 *    and it no longer shows in the Settings table;
 *  - the footer newsletter box is gone (the newsletter has its own section), so footer.newsletter_title_* / newsletter_text_* / show_newsletter are removed.
 * Idempotent; down() puts the rows back with their defaults.
 */
export class RemoveHomeContactAndFooterNewsletter1766000000000 implements MigrationInterface {
  name = 'RemoveHomeContactAndFooterNewsletter1766000000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'sections_home' AND "key" LIKE 'contact\\_%'`);
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'footer' AND "key" IN ('newsletter_title_ar', 'newsletter_title_en', 'newsletter_text_ar', 'newsletter_text_en', 'show_newsletter')`);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at") VALUES
        ('sections_home', 'contact_title_ar', 'تواصل معنا', 'text', now()),
        ('sections_home', 'contact_title_en', 'Contact Us', 'text', now()),
        ('sections_home', 'contact_visible', 'false', 'boolean', now()),
        ('footer', 'newsletter_title_ar', 'نشرة البريد', 'text', now()),
        ('footer', 'newsletter_title_en', 'Newsletter', 'text', now()),
        ('footer', 'newsletter_text_ar', 'اشترك ليصلك جديد الغرفة', 'text', now()),
        ('footer', 'newsletter_text_en', 'Subscribe to receive the chamber news', 'text', now()),
        ('footer', 'show_newsletter', 'false', 'boolean', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }
}
