import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The newsletter link ("النشرة البريدية" -> /subscribe) is taken out of the main menu. Subscribing still works from the footer
 * form and the /subscribe page itself; only the menu entry goes. Only menu items are touched (never footer links), idempotent.
 */
export class RemoveNewsletterFromNav1764700000000 implements MigrationInterface {
  name = 'RemoveNewsletterFromNav1764700000000';

  public async up(r: QueryRunner): Promise<void> {
    const has = (await r.query(`SELECT to_regclass('public.nav_items') AS t`))[0]?.t;
    if (!has) return;
    await r.query(`DELETE FROM "nav_items" WHERE regexp_replace(lower("url"), '/+$', '') IN ('/subscribe', '/ar/subscribe', '/en/subscribe')`);
  }

  public async down(): Promise<void> {
    // not restored on purpose: the entry was removed by request
  }
}
