import { MigrationInterface, QueryRunner } from 'typeorm';

type G = { ar: string; en: string; kind: 'links' | 'official' | 'legal'; columns: 1 | 2; items: [string, string, string][] };

/** The footer as the chamber asked for it. Everything below is editable afterwards (Settings -> Footer, and the "Footer" settings table). */
const DEFAULTS: G[] = [
  { ar: 'غرفة تجارة دمشق', en: 'Damascus Chamber of Commerce', kind: 'links', columns: 1, items: [
    ['عن الغرفة', 'About the chamber', '/pages/view?slug=about'],
    ['مجلس الإدارة', 'Board of Directors', '/board'],
    ['اللجان', 'Committees', '/committees'],
    ['الخدمات', 'Services', '/one-stop'],
  ] },
  { ar: 'الروابط السريعة', en: 'Quick links', kind: 'links', columns: 2, items: [
    ['الأخبار', 'News', '/news'],
    ['القرارات', 'Decisions', '/documents?kind=decision'],
    ['التعاميم', 'Circulars', '/documents?kind=circular'],
    ['مركز التدريب', 'Training center', '/training'],
    ['حاضنة الأعمال', 'Business incubator', '/incubator'],
    ['سيدات الأعمال', 'Businesswomen', '/committees/women'],
    ['النافذة الواحدة', 'One-stop window', '/one-stop'],
    ['غيت تو تريد', 'Get2Trade', '/get2trade'],
    ['المعارض', 'Exhibitions', '/occasions/previous'],
    ['DCC EXPO', 'DCC EXPO', '/expo'],
  ] },
  { ar: 'خدمات', en: 'Services', kind: 'links', columns: 1, items: [
    ['الانتساب', 'Membership', '/membership'],
    ['الخدمات الإلكترونية', 'Electronic services', '/one-stop'],
    ['النماذج', 'Forms', '/library?kind=form'],
    ['مركز التحميلات', 'Downloads center', '/library'],
  ] },
  // shown inside the contact column; empty until the chamber adds its official sites
  { ar: 'الروابط الرسمية', en: 'Official links', kind: 'official', columns: 1, items: [] },
  { ar: 'روابط قانونية', en: 'Legal links', kind: 'legal', columns: 1, items: [
    ['سياسة الخصوصية', 'Privacy policy', '/privacy'],
    ['الشروط والأحكام', 'Terms & conditions', '/terms'],
    ['خريطة الموقع', 'Site map', '/sitemap'],
  ] },
];

const SETTINGS: [string, string, string, string][] = [
  ['contact_title_ar', 'تواصل معنا', 'text', ''], ['contact_title_en', 'Contact us', 'text', ''],
  ['social_title_ar', 'منصات التواصل', 'text', ''], ['social_title_en', 'Social media', 'text', ''],
  ['newsletter_title_ar', 'نشرة البريد', 'text', ''], ['newsletter_title_en', 'Newsletter', 'text', ''],
  ['newsletter_text_ar', 'اشترك ليصلك جديد الغرفة', 'text', ''], ['newsletter_text_en', 'Subscribe to receive the chamber news', 'text', ''],
  ['tagline_ar', 'غرفة تجارة دمشق - بيت كل تاجر', 'text', ''], ['tagline_en', 'Damascus Chamber of Commerce — the home of every merchant', 'text', ''],
  ['rights_ar', '© جميع الحقوق محفوظة لغرفة تجارة دمشق', 'text', ''], ['rights_en', '© All rights reserved to the Damascus Chamber of Commerce', 'text', ''],
  ['show_newsletter', 'true', 'boolean', ''],
];

const PERMS: [string, string, string][] = [
  ['footer.read', 'عرض روابط التذييل', 'View the footer links'],
  ['footer.update', 'تعديل روابط التذييل', 'Edit the footer links'],
];

/**
 * Footer (four sections + a bottom bar), all editable:
 *  - footer_groups / footer_links: the link columns, the "official links" list and the bottom legal links (Settings -> Footer)
 *  - site_settings category "footer": section titles, the newsletter text, the tagline and the rights line
 *  - footer.* permissions (granted to technical_admin)
 * The default content is copied in once (only while the tables are empty). Idempotent.
 */
export class AddFooter1764000000000 implements MigrationInterface {
  name = 'AddFooter1764000000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "footer_groups" (
        "id" BIGSERIAL PRIMARY KEY,
        "title_ar" varchar(150) NOT NULL,
        "title_en" varchar(150),
        "kind" varchar(10) NOT NULL DEFAULT 'links',
        "columns" smallint NOT NULL DEFAULT 1,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`
      CREATE TABLE IF NOT EXISTS "footer_links" (
        "id" BIGSERIAL PRIMARY KEY,
        "group_id" bigint NOT NULL REFERENCES "footer_groups" ("id") ON DELETE CASCADE,
        "title_ar" varchar(150) NOT NULL,
        "title_en" varchar(150),
        "url" varchar(500) NOT NULL,
        "new_tab" boolean NOT NULL DEFAULT false,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_footer_links_group" ON "footer_links" ("group_id", "sort_order")`);

    const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
    const empty = (await r.query(`SELECT COUNT(*)::int AS n FROM "footer_groups"`))[0].n === 0;
    if (empty) {
      for (const [gi, g] of DEFAULTS.entries()) {
        const id = (await r.query(`INSERT INTO "footer_groups" ("title_ar", "title_en", "kind", "columns", "sort_order") VALUES (${q(g.ar)}, ${q(g.en)}, '${g.kind}', ${g.columns}, ${gi}) RETURNING "id"`))[0].id;
        for (const [ii, [ar, en, url]] of g.items.entries()) {
          await r.query(`INSERT INTO "footer_links" ("group_id", "title_ar", "title_en", "url", "sort_order") VALUES (${id}, ${q(ar)}, ${q(en)}, ${q(url)}, ${ii})`);
        }
      }
    }

    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ${SETTINGS.map(([k, v, t]) => `('footer', ${q(k)}, ${q(v)}, '${t}', now())`).join(', ')}
      ON CONFLICT ("category", "key") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'footer')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'footer'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'footer'`);
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'footer'`);
    await r.query(`DROP TABLE IF EXISTS "footer_links"`);
    await r.query(`DROP TABLE IF EXISTS "footer_groups"`);
  }
}
