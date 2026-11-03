import { MigrationInterface, QueryRunner } from 'typeorm';

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

const PERMS: [string, string, string][] = [
  ['nav.read', 'عرض قائمة التنقل', 'View the main menu'],
  ['nav.update', 'تعديل قائمة التنقل', 'Edit the main menu'],
];

/** The menu as it was hard-coded in lib/nav.ts (only pages that exist): the starting point of the editable menu. */
const DEFAULTS: { ar: string; en: string; items: [string, string, string][] }[] = [
  { ar: 'عن الغرفة', en: 'About', items: [
    ['عن الغرفة', 'About the chamber', '/pages/view?slug=about'],
    ['مجلس الإدارة', 'Board of Directors', '/board'],
    ['اللجان والقطاعات', 'Committees & sectors', '/committees'],
    ['لجنة سيدات الأعمال', 'Businesswomen committee', '/committees/women'],
  ] },
  { ar: 'الأخبار والإعلام', en: 'News & media', items: [
    ['كل الأخبار', 'All news', '/news'],
    ['المركز الإعلامي', 'Media center', '/media'],
    ['معرض الصور', 'Image gallery', '/gallery'],
    ['النشرة البريدية', 'Newsletter', '/subscribe'],
  ] },
  { ar: 'الخدمات', en: 'Services', items: [
    ['النافذة الواحدة', 'One-stop window', '/one-stop'],
    ['القرارات والتعاميم', 'Decisions & circulars', '/documents'],
    ['المكتبة والأرشيف الرقمي', 'Library & digital archive', '/library'],
    ['الأسئلة الشائعة', 'FAQ', '/faq'],
  ] },
  { ar: 'التطوير والأعمال', en: 'Development & business', items: [
    ['مركز التدريب الإداري', 'Management training center', '/training'],
  ] },
  { ar: 'المعارض والفعاليات', en: 'Exhibitions & events', items: [
    ['المعارض والفعاليات', 'Exhibitions & events', '/occasions/previous'],
    ['أجندة الغرفة', 'Chamber agenda', '/occasions/upcoming'],
  ] },
];

/**
 * Editable main menu: `nav_groups` (the dropdowns) and `nav_items` (their links), edited from Settings -> Main menu,
 * plus the nav.* permissions granted to technical_admin. The current menu is copied in once (only while the tables are empty). Idempotent.
 */
export class AddNavMenu1763100000000 implements MigrationInterface {
  name = 'AddNavMenu1763100000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "nav_groups" (
        "id" BIGSERIAL PRIMARY KEY,
        "title_ar" varchar(150) NOT NULL,
        "title_en" varchar(150),
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "nav_items" (
        "id" BIGSERIAL PRIMARY KEY,
        "group_id" bigint NOT NULL REFERENCES "nav_groups" ("id") ON DELETE CASCADE,
        "title_ar" varchar(150) NOT NULL,
        "title_en" varchar(150),
        "url" varchar(500) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "new_tab" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_nav_items_group" ON "nav_items" ("group_id", "sort_order")`);

    const empty = (await r.query(`SELECT COUNT(*)::int AS n FROM "nav_groups"`))[0].n === 0;
    if (empty) {
      for (const [gi, g] of DEFAULTS.entries()) {
        const id = (await r.query(`INSERT INTO "nav_groups" ("title_ar", "title_en", "sort_order") VALUES (${q(g.ar)}, ${q(g.en)}, ${gi}) RETURNING "id"`))[0].id;
        for (const [ii, [ar, en, url]] of g.items.entries()) {
          await r.query(`INSERT INTO "nav_items" ("group_id", "title_ar", "title_en", "url", "sort_order") VALUES (${id}, ${q(ar)}, ${q(en)}, ${q(url)}, ${ii})`);
        }
      }
    }

    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'nav')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'nav'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'nav'`);
    await r.query(`DROP TABLE IF EXISTS "nav_items"`);
    await r.query(`DROP TABLE IF EXISTS "nav_groups"`);
  }
}
