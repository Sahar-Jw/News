import { MigrationInterface, QueryRunner } from 'typeorm';

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
/** one VALUES tuple for site_settings (the value is text, NULL or a raw SQL expression) */
const row = (cat: string, key: string, val: string | null | { sql: string }, type: string) =>
  `(${q(cat)}, ${q(key)}, ${val === null ? 'NULL' : typeof val === 'object' ? val.sql : q(val)}, ${q(type)}, now())`;

const NEWS_ORDER = `(SELECT NULLIF("value", '')::numeric FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = 'news_order')`;

/**
 * Brings the pages built so far closer to the wireframes of the analysis document:
 *  - documents: issuer (filter + table column) — the new kinds "law" and "guide" are plain values of the existing `kind` column
 *  - galleries: optional committee_id (FK, ON DELETE SET NULL) for the committee page's photos tab
 *  - home: two new sections "agenda" and "gallery" right after "news" (later sections move down two places) and the promo-banner settings
 * board member news links reuse `content_links` (entity_type = 'board_member'): no schema change. Idempotent.
 */
export class AddWireframeGaps1762800000000 implements MigrationInterface {
  name = 'AddWireframeGaps1762800000000';

  public async up(r: QueryRunner): Promise<void> {
    // ---- documents: issuer
    await r.query(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "issuer_ar" varchar(150)`);
    await r.query(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "issuer_en" varchar(150)`);

    // ---- galleries: committee
    await r.query(`ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "committee_id" bigint`);
    await r.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_galleries_committee') THEN
          ALTER TABLE "galleries" ADD CONSTRAINT "fk_galleries_committee" FOREIGN KEY ("committee_id") REFERENCES "committees" ("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_galleries_committee" ON "galleries" ("committee_id")`);

    // ---- home: agenda + gallery sections go right after "news"
    await r.query(`
      UPDATE "site_settings" SET "value" = (("value")::numeric + 2)::text, "updated_at" = now()
      WHERE "category" = 'sections_home' AND right("key", 6) = '_order' AND "key" NOT IN ('agenda_order', 'gallery_order')
        AND "value" ~ '^[0-9]+(\\.[0-9]+)?$'
        AND ("value")::numeric > COALESCE(${NEWS_ORDER}, 0)
        AND NOT EXISTS (SELECT 1 FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = 'agenda_order')
    `);
    const sec: string[] = [];
    [['agenda', 'أجندة الغرفة', 'Chamber agenda', 1], ['gallery', 'معرض الصور', 'Photo gallery', 2]].forEach(([code, ar, en, n]) => {
      sec.push(
        row('sections_home', `${code}_title_ar`, ar as string, 'text'),
        row('sections_home', `${code}_title_en`, en as string, 'text'),
        row('sections_home', `${code}_order`, { sql: `(COALESCE(${NEWS_ORDER}, 0) + ${n})::text` }, 'number'),
        row('sections_home', `${code}_visible`, 'true', 'boolean'),
        ...['eyebrow_ar', 'eyebrow_en', 'subtitle_ar', 'subtitle_en'].map((k) => row('sections_home', `${code}_${k}`, null, 'text')),
      );
    });
    for (const k of ['title_ar', 'title_en', 'text_ar', 'text_en', 'button_ar', 'button_en', 'link']) sec.push(row('promo', k, null, 'text'));
    sec.push(row('promo', 'image', null, 'file'));
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ${sec.join(', ')}
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    // move the later sections back up, then remove what up() added
    await r.query(`
      UPDATE "site_settings" SET "value" = (("value")::numeric - 2)::text, "updated_at" = now()
      WHERE "category" = 'sections_home' AND right("key", 6) = '_order' AND "key" NOT IN ('agenda_order', 'gallery_order')
        AND "value" ~ '^[0-9]+(\\.[0-9]+)?$'
        AND ("value")::numeric > COALESCE((SELECT NULLIF("value", '')::numeric FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = 'gallery_order'), 1e9)
    `);
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'promo' OR ("category" = 'sections_home' AND ("key" LIKE 'agenda\\_%' OR "key" LIKE 'gallery\\_%'))`);
    await r.query(`DROP INDEX IF EXISTS "idx_galleries_committee"`);
    await r.query(`ALTER TABLE "galleries" DROP CONSTRAINT IF EXISTS "fk_galleries_committee"`);
    await r.query(`ALTER TABLE "galleries" DROP COLUMN IF EXISTS "committee_id"`);
    await r.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "issuer_en"`);
    await r.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "issuer_ar"`);
  }
}
