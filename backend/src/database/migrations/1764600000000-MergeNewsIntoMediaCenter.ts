import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "All news" (/news) and the Media Center (/media) become one page: the Media Center, whose News tab holds the full list.
 * /news itself still works (it redirects, keeping its filters), so this only tidies the stored links:
 *  - the main menu loses its "All news" link when it also has a Media Center link, otherwise the link is repointed;
 *  - footer links and the quick-link settings that pointed at /news now point at /media (filters in the query string are kept).
 * Idempotent.
 */
export class MergeNewsIntoMediaCenter1764600000000 implements MigrationInterface {
  name = 'MergeNewsIntoMediaCenter1764600000000';

  public async up(r: QueryRunner): Promise<void> {
    // menu: drop the duplicate "/news" link when the same dropdown group already has "/media"
    await r.query(`
      DELETE FROM "nav_items" n
      WHERE n."url" = '/news'
        AND EXISTS (SELECT 1 FROM "nav_items" m WHERE m."group_id" = n."group_id" AND m."url" = '/media')
    `);
    // any other "/news" or "/news?..." link (other groups, footer, quick links) -> "/media" with the same query
    await r.query(`UPDATE "nav_items" SET "url" = '/media' || substr("url", 6), "updated_at" = now() WHERE "url" = '/news' OR "url" LIKE '/news?%'`);
    await r.query(`UPDATE "footer_links" SET "url" = '/media' || substr("url", 6), "updated_at" = now() WHERE "url" = '/news' OR "url" LIKE '/news?%'`);
    await r.query(`
      UPDATE "site_settings" SET "value" = '/media' || substr("value", 6), "updated_at" = now()
      WHERE "category" = 'shortcuts' AND "key" LIKE 'item%\\_link' AND ("value" = '/news' OR "value" LIKE '/news?%')
    `);
  }

  public async down(): Promise<void> {
    // not reversible on purpose: /news keeps working through its redirect
  }
}
