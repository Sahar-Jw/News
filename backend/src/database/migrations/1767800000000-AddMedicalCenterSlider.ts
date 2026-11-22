import { MigrationInterface, QueryRunner } from 'typeorm';
import { MEDICAL_SETTINGS } from '../medical-defaults';

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
const row = (cat: string, key: string, val: string | null | { sql: string }, type: string) =>
  `(${q(cat)}, ${q(key)}, ${val === null ? 'NULL' : typeof val === 'object' ? val.sql : q(val)}, ${q(type)}, now())`;
const ORDER = (k: string) => `(SELECT NULLIF("value", '')::numeric FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = '${k}')`;

/**
 * Home page: new "medical center" slider section (info slide + doctors' schedule slides).
 *  - settings category `medical`: name, logo, working hours (winter / summer), phones, Facebook page, slider options and the doctors list (JSON)
 *  - home section `medical` in sections_home (title / order / visible / eyebrow / subtitle), placed right after the quick links
 * No table is created; everything lives in `site_settings`. Idempotent: ON CONFLICT DO NOTHING, existing values are never overwritten.
 */
export class AddMedicalCenterSlider1767800000000 implements MigrationInterface {
  name = 'AddMedicalCenterSlider1767800000000';

  public async up(r: QueryRunner): Promise<void> {
    const anchor = `COALESCE(${ORDER('shortcuts_order')}, ${ORDER('hero_order')}, 1)`;

    // later sections move down one place, the new section takes the free place (only the first time: once medical_order exists nothing moves)
    await r.query(`
      UPDATE "site_settings" SET "value" = (("value")::numeric + 1)::text, "updated_at" = now()
      WHERE "category" = 'sections_home' AND right("key", 6) = '_order' AND "value" ~ '^[0-9]+(\\.[0-9]+)?$'
        AND ("value")::numeric > ${anchor}
        AND NOT EXISTS (SELECT 1 FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = 'medical_order')
    `);
    const section = [
      row('sections_home', 'medical_title_ar', 'المركز الطبي', 'text'),
      row('sections_home', 'medical_title_en', 'Medical Center', 'text'),
      row('sections_home', 'medical_order', { sql: `(${anchor} + 1)::text` }, 'number'),
      row('sections_home', 'medical_visible', 'true', 'boolean'),
      ...['eyebrow_ar', 'eyebrow_en', 'subtitle_ar', 'subtitle_en'].map((k) => row('sections_home', `medical_${k}`, null, 'text')),
    ];
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ${section.join(', ')}
      ON CONFLICT ("category", "key") DO NOTHING
    `);
    const medical = MEDICAL_SETTINGS.map(([k, type, v]) => row('medical', k, v, type));
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ${medical.join(', ')}
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`
      UPDATE "site_settings" SET "value" = (("value")::numeric - 1)::text, "updated_at" = now()
      WHERE "category" = 'sections_home' AND right("key", 6) = '_order' AND "key" <> 'medical_order' AND "value" ~ '^[0-9]+(\\.[0-9]+)?$'
        AND ("value")::numeric > COALESCE(${ORDER('medical_order')}, 1e9)
    `);
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'medical' OR ("category" = 'sections_home' AND "key" LIKE 'medical\\_%')`);
  }
}
