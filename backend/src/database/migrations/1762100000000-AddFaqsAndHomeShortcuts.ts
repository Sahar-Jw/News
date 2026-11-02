import { MigrationInterface, QueryRunner } from 'typeorm';

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
/** one VALUES tuple for site_settings (the value is text, NULL or a raw SQL expression) */
const row = (cat: string, key: string, val: string | null | { sql: string }, type: string) =>
  `(${q(cat)}, ${q(key)}, ${val === null ? 'NULL' : typeof val === 'object' ? val.sql : q(val)}, ${q(type)}, now())`;

const PERMS: [string, string, string][] = [
  ['faqs.read', 'عرض الأسئلة الشائعة', 'View FAQs'],
  ['faqs.create', 'إضافة سؤال شائع', 'Create FAQs'],
  ['faqs.update', 'تعديل سؤال شائع', 'Update FAQs'],
  ['faqs.delete', 'حذف سؤال شائع', 'Delete FAQs'],
];

const SHORTCUTS: [string, string, string][] = [
  ['آخر الأخبار', 'Latest news', '/news'],
  ['معرض الصور', 'Photo gallery', '/gallery'],
  ['المناسبات القادمة', 'Upcoming occasions', '/occasions/upcoming'],
  ['المناسبات السابقة', 'Previous occasions', '/occasions/previous'],
  ['الأسئلة الشائعة', 'FAQ', '/faq'],
  ['تواصل معنا', 'Contact us', '/#sec-contact'],
];

/**
 * Page 1 (home): hero grows from 3 to 5 slides and a "quick links" section is added right after the hero.
 * Page 2 (FAQ): new `faqs` table, its permissions (granted to technical_admin) and the admin / public pages that use it.
 * Everything is idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).
 */
export class AddFaqsAndHomeShortcuts1762100000000 implements MigrationInterface {
  name = 'AddFaqsAndHomeShortcuts1762100000000';

  public async up(r: QueryRunner): Promise<void> {
    // ---- faqs table
    await r.query(`
      CREATE TABLE IF NOT EXISTS "faqs" (
        "id" BIGSERIAL PRIMARY KEY,
        "scope" varchar(30) NOT NULL DEFAULT 'general',
        "question_ar" varchar(500) NOT NULL,
        "question_en" varchar(500),
        "answer_ar" text NOT NULL,
        "answer_en" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_faqs_scope_order" ON "faqs" ("scope", "sort_order")`);

    // ---- permissions (+ technical_admin gets them now, no need to re-run the seed)
    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'faqs')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'faqs'
      ON CONFLICT DO NOTHING
    `);

    // ---- hero: slides 4 and 5
    const hero: string[] = [];
    for (const n of [4, 5]) {
      hero.push(row('hero', `slide${n}_image`, null, 'file'));
      for (const k of ['title_ar', 'title_en', 'description_ar', 'description_en']) hero.push(row('hero', `slide${n}_${k}`, null, 'text'));
    }
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ${hero.join(', ')}
      ON CONFLICT ("category", "key") DO NOTHING
    `);

    // ---- home section "shortcuts": goes right after the hero; every later section moves down one place
    await r.query(`
      UPDATE "site_settings" SET "value" = (("value")::numeric + 1)::text, "updated_at" = now()
      WHERE "category" = 'sections_home' AND right("key", 6) = '_order' AND "key" <> 'hero_order'
        AND "value" ~ '^[0-9]+(\\.[0-9]+)?$'
        AND ("value")::numeric > COALESCE((SELECT NULLIF("value", '')::numeric FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = 'hero_order'), 1)
        AND NOT EXISTS (SELECT 1 FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = 'shortcuts_order')
    `);
    const heroOrder = `(SELECT NULLIF("value", '')::numeric FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = 'hero_order')`;
    const sec = [
      row('sections_home', 'shortcuts_title_ar', 'اختصارات سريعة', 'text'),
      row('sections_home', 'shortcuts_title_en', 'Quick links', 'text'),
      row('sections_home', 'shortcuts_order', { sql: `(COALESCE(${heroOrder}, 1) + 1)::text` }, 'number'),
      row('sections_home', 'shortcuts_visible', 'true', 'boolean'),
      ...['eyebrow_ar', 'eyebrow_en', 'subtitle_ar', 'subtitle_en'].map((k) => row('sections_home', `shortcuts_${k}`, null, 'text')),
    ];
    SHORTCUTS.forEach(([ar, en, link], i) => {
      sec.push(row('shortcuts', `item${i + 1}_title_ar`, ar, 'text'), row('shortcuts', `item${i + 1}_title_en`, en, 'text'), row('shortcuts', `item${i + 1}_link`, link, 'text'));
    });
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ${sec.join(', ')}
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    // move the later sections back up, then remove what up() added
    await r.query(`
      UPDATE "site_settings" SET "value" = (("value")::numeric - 1)::text, "updated_at" = now()
      WHERE "category" = 'sections_home' AND right("key", 6) = '_order' AND "key" <> 'shortcuts_order'
        AND "value" ~ '^[0-9]+(\\.[0-9]+)?$'
        AND ("value")::numeric > COALESCE((SELECT NULLIF("value", '')::numeric FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = 'shortcuts_order'), 1e9)
    `);
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'shortcuts' OR ("category" = 'sections_home' AND "key" LIKE 'shortcuts\\_%')`);
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'hero' AND "key" ~ '^slide[45]_'`);
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'faqs'`);
    await r.query(`DROP TABLE IF EXISTS "faqs"`);
  }
}
