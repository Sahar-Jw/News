import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DCC EXPO used to be a separate highlighted button next to the menu. It is now an ordinary link of the editable main menu:
 * it is added once to the "Exhibitions & events" dropdown (or, if that dropdown was renamed or deleted, to the last dropdown).
 * Skipped when the menu tables do not exist, when the menu is empty, or when a link to /expo is already in the menu. Idempotent.
 */
export class AddExpoToMenu1763600000000 implements MigrationInterface {
  name = 'AddExpoToMenu1763600000000';

  public async up(r: QueryRunner): Promise<void> {
    const hasNav = (await r.query(`SELECT to_regclass('public.nav_items') AS t`))[0]?.t;
    if (!hasNav) return;
    const exists = (await r.query(`SELECT 1 FROM "nav_items" WHERE "url" = '/expo' OR "url" LIKE '/expo/%' OR "url" LIKE '/expo#%' LIMIT 1`)).length > 0;
    if (exists) return;
    const group =
      (await r.query(`SELECT "id" FROM "nav_groups" WHERE "title_ar" = 'المعارض والفعاليات' ORDER BY "id" LIMIT 1`))[0] ??
      (await r.query(`SELECT "id" FROM "nav_groups" ORDER BY "sort_order" DESC, "id" DESC LIMIT 1`))[0];
    if (!group) return;
    await r.query(
      `INSERT INTO "nav_items" ("group_id", "title_ar", "title_en", "url", "sort_order")
       VALUES ($1, 'DCC EXPO', 'DCC EXPO', '/expo', COALESCE((SELECT MAX("sort_order") + 1 FROM "nav_items" WHERE "group_id" = $1), 0))`,
      [group.id],
    );
  }

  public async down(r: QueryRunner): Promise<void> {
    const hasNav = (await r.query(`SELECT to_regclass('public.nav_items') AS t`))[0]?.t;
    if (hasNav) await r.query(`DELETE FROM "nav_items" WHERE "url" = '/expo' AND "title_ar" = 'DCC EXPO'`);
  }
}
