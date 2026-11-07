import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Home page: new section "women" (the businesswomen committee slider). It goes right after "agenda": the sections after it move one place down.
 * Idempotent (does nothing when the setting already exists).
 */
export class AddWomenHomeSection1763800000000 implements MigrationInterface {
  name = 'AddWomenHomeSection1763800000000';

  public async up(r: QueryRunner): Promise<void> {
    const has = await r.query(`SELECT 1 FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = 'women_order'`);
    if (has.length) return;
    const ag = await r.query(`SELECT "value" FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = 'agenda_order'`);
    const raw = ag[0]?.value;
    const agendaOrder = raw !== undefined && /^\d+$/.test(String(raw)) ? Number(raw) : 5;
    await r.query(
      `UPDATE "site_settings" SET "value" = ("value"::int + 1)::text, "updated_at" = now()
       WHERE "category" = 'sections_home' AND "key" LIKE '%\\_order' AND "value" ~ '^[0-9]+$' AND "value"::int > $1`,
      [agendaOrder],
    );
    await r.query(
      `INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at") VALUES
        ('sections_home', 'women_title_ar', 'لجنة سيدات الأعمال', 'text', now()),
        ('sections_home', 'women_title_en', 'Women Business Committee', 'text', now()),
        ('sections_home', 'women_order', $1, 'number', now()),
        ('sections_home', 'women_visible', 'true', 'boolean', now()),
        ('sections_home', 'women_eyebrow_ar', NULL, 'text', now()),
        ('sections_home', 'women_eyebrow_en', NULL, 'text', now()),
        ('sections_home', 'women_subtitle_ar', NULL, 'text', now()),
        ('sections_home', 'women_subtitle_en', NULL, 'text', now())
       ON CONFLICT ("category", "key") DO NOTHING`,
      [String(agendaOrder + 1)],
    );
  }

  public async down(r: QueryRunner): Promise<void> {
    const w = await r.query(`SELECT "value" FROM "site_settings" WHERE "category" = 'sections_home' AND "key" = 'women_order'`);
    if (!w.length) return;
    const n = Number(w[0].value);
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'sections_home' AND "key" LIKE 'women\\_%'`);
    if (Number.isInteger(n)) {
      await r.query(
        `UPDATE "site_settings" SET "value" = ("value"::int - 1)::text, "updated_at" = now()
         WHERE "category" = 'sections_home' AND "key" LIKE '%\\_order' AND "value" ~ '^[0-9]+$' AND "value"::int > $1`,
        [n],
      );
    }
  }
}
