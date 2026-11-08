import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Contact us" is a page of its own (/contact) instead of a section of the home page. Existing links that pointed at the home section
 * (/#sec-contact) are repointed: the home shortcuts and the links of the editable main menu. Idempotent.
 */
export class ContactPageLinks1764100000000 implements MigrationInterface {
  name = 'ContactPageLinks1764100000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`UPDATE "site_settings" SET "value" = '/contact', "updated_at" = now() WHERE "category" = 'shortcuts' AND "key" LIKE 'item%\\_link' AND "value" = '/#sec-contact'`);
    const hasNav = (await r.query(`SELECT to_regclass('public.nav_items') AS t`))[0]?.t;
    if (hasNav) await r.query(`UPDATE "nav_items" SET "url" = '/contact', "updated_at" = now() WHERE "url" = '/#sec-contact'`);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`UPDATE "site_settings" SET "value" = '/#sec-contact', "updated_at" = now() WHERE "category" = 'shortcuts' AND "key" LIKE 'item%\\_link' AND "value" = '/contact'`);
    const hasNav = (await r.query(`SELECT to_regclass('public.nav_items') AS t`))[0]?.t;
    if (hasNav) await r.query(`UPDATE "nav_items" SET "url" = '/#sec-contact', "updated_at" = now() WHERE "url" = '/contact'`);
  }
}
