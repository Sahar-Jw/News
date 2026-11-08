import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The main menu had two dropdowns for the same thing: "المعارض والفعاليات" and "المناسبات والمعارض". The second one is removed.
 * Any link in it that the first dropdown does not already have is moved there (by url), the rest are dropped.
 * Does nothing when either dropdown is missing, so a menu the chamber already tidied is left alone. Idempotent.
 */
export class RemoveOccasionsMenuGroup1764500000000 implements MigrationInterface {
  name = 'RemoveOccasionsMenuGroup1764500000000';

  public async up(r: QueryRunner): Promise<void> {
    const has = (await r.query(`SELECT to_regclass('public.nav_groups') AS t`))[0]?.t;
    if (!has) return;
    const keep = (await r.query(`SELECT "id" FROM "nav_groups" WHERE "title_ar" = 'المعارض والفعاليات' ORDER BY "id" LIMIT 1`))[0];
    if (!keep) return;
    const extra = await r.query(
      `SELECT "id" FROM "nav_groups" WHERE "id" <> $1 AND ("title_ar" = 'المناسبات والمعارض' OR lower("title_en") = 'occasions & exhibitions')`,
      [keep.id],
    );
    for (const g of extra) {
      await r.query(
        `UPDATE "nav_items" ni SET "group_id" = $1, "sort_order" = COALESCE((SELECT MAX(x."sort_order") FROM "nav_items" x WHERE x."group_id" = $1), 0) + ni."sort_order" + 1
         WHERE ni."group_id" = $2 AND NOT EXISTS (SELECT 1 FROM "nav_items" k WHERE k."group_id" = $1 AND k."url" = ni."url")`,
        [keep.id, g.id],
      );
      await r.query(`DELETE FROM "nav_items" WHERE "group_id" = $1`, [g.id]);
      await r.query(`DELETE FROM "nav_groups" WHERE "id" = $1`, [g.id]);
    }
  }

  public async down(): Promise<void> {
    // not reversible on purpose: the removed dropdown only duplicated the other one
  }
}
