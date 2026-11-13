import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1) The Services page lives at /membership, but its menu link was still called "Membership" and sat last in the Services group.
 *    It is renamed "Services" and moved to the top of the group (a link is added when the menu has none).
 * 2) The permission list showed two groups called "Services": the chamber services (services.*) and the old home-page services section
 *    (news.<action>.services). The home-page one is renamed so the two can be told apart.
 * Idempotent; the menu part is skipped when the menu tables do not exist.
 */
const SECTION: Record<string, [string, string]> = {
  read: ['عرض خدمات الصفحة الرئيسية', 'View home-page services'],
  create: ['إضافة إلى خدمات الصفحة الرئيسية', 'Create in home-page services'],
  update: ['تعديل خدمات الصفحة الرئيسية', 'Update home-page services'],
  delete: ['حذف من خدمات الصفحة الرئيسية', 'Delete from home-page services'],
};
const OLD: Record<string, [string, string]> = {
  read: ['عرض الخدمات', 'View Services'],
  create: ['إضافة إلى الخدمات', 'Create in Services'],
  update: ['تعديل الخدمات', 'Update Services'],
  delete: ['حذف من الخدمات', 'Delete from Services'],
};

export class ServicesMenuAndPermissionNames1766700000000 implements MigrationInterface {
  name = 'ServicesMenuAndPermissionNames1766700000000';

  public async up(r: QueryRunner): Promise<void> {
    const hasNav = (await r.query(`SELECT to_regclass('public.nav_items') AS t`))[0]?.t;
    if (hasNav) {
      const moved = await r.query(`
        UPDATE "nav_items" SET "title_ar" = 'الخدمات', "title_en" = 'Services',
          "sort_order" = COALESCE((SELECT MIN(n."sort_order") FROM "nav_items" n WHERE n."group_id" = "nav_items"."group_id" AND n."url" <> '/membership'), 1) - 1
        WHERE "url" = '/membership' RETURNING "id"
      `);
      if (!moved.length) {
        await r.query(`
          INSERT INTO "nav_items" ("group_id", "title_ar", "title_en", "url", "sort_order")
          SELECT g."id", 'الخدمات', 'Services', '/membership', COALESCE((SELECT MIN("sort_order") FROM "nav_items" WHERE "group_id" = g."id"), 1) - 1
          FROM "nav_groups" g WHERE g."title_ar" = 'الخدمات' ORDER BY g."id" LIMIT 1
        `);
      }
    }
    for (const a of Object.keys(SECTION)) {
      await r.query(`UPDATE "permissions" SET "name_ar" = $1, "name_en" = $2 WHERE "code" = $3`, [SECTION[a][0], SECTION[a][1], `news.${a}.services`]);
    }
  }

  public async down(r: QueryRunner): Promise<void> {
    for (const a of Object.keys(OLD)) {
      await r.query(`UPDATE "permissions" SET "name_ar" = $1, "name_en" = $2 WHERE "code" = $3`, [OLD[a][0], OLD[a][1], `news.${a}.services`]);
    }
    const hasNav = (await r.query(`SELECT to_regclass('public.nav_items') AS t`))[0]?.t;
    if (hasNav) await r.query(`UPDATE "nav_items" SET "title_ar" = 'للانتساب', "title_en" = 'Membership' WHERE "url" = '/membership'`);
  }
}
