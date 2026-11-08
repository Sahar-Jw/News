import { MigrationInterface, QueryRunner } from 'typeorm';

export class OccasionsInNews1764300000000 implements MigrationInterface {
  name = 'OccasionsInNews1764300000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "code" IN ('pages.create', 'pages.delete'))`);
    await r.query(`DELETE FROM "permissions" WHERE "code" IN ('pages.create', 'pages.delete')`);
    await r.query(`ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "finish_at" date`);
    const hasOccasions = (await r.query(`SELECT to_regclass('public.occasions') AS t`))[0].t !== null;
    if (hasOccasions) {
      await r.query(`
        INSERT INTO "news" ("created_at", "updated_at", "title", "main_category", "publish_at", "finish_at", "images", "topics", "created_by", "extra")
        SELECT o."created_at", o."updated_at", o."title_ar", 'OCCASION',
               o."event_date"::timestamp AT TIME ZONE 'UTC', o."event_date", COALESCE(o."images", '[]'::jsonb), '[]'::jsonb, o."created_by",
               jsonb_build_object(
                 'legacyOccasionId', o."id"::text,
                 'titleEn', o."title_en",
                 'eventDate', to_char(o."event_date", 'YYYY-MM-DD'),
                 'eventType', 'occasion',
                 'isActive', true
               )
        FROM "occasions" o
        ORDER BY o."id"
      `);
      await r.query(`DROP TABLE "occasions"`);
    }

    await r.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_news_occasion_finish') THEN
          ALTER TABLE "news" ADD CONSTRAINT "chk_news_occasion_finish"
            CHECK ("main_category" <> 'OCCASION' OR "finish_at" IS NOT NULL);
        END IF;
      END $$
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_news_occasion_dates" ON "news" ("publish_at", "finish_at") WHERE "main_category" = 'OCCASION'`);

    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES
        ('expo', 'header_color', '#3b155f', 'color', now()),
        ('expo', 'footer_color', '#2d1049', 'color', now()),
        ('expo', 'background_color', '#faf8fc', 'color', now()),
        ('expo', 'text_color', '#1f2937', 'color', now()),
        ('expo', 'floor_plan_ar', NULL, 'text', now()),
        ('expo', 'floor_plan_en', NULL, 'text', now()),
        ('expo', 'footer_text_ar', NULL, 'text', now()),
        ('expo', 'footer_text_en', NULL, 'text', now()),
        ('women', 'name_ar', 'لجنة سيدات الأعمال', 'text', now()),
        ('women', 'name_en', 'Women Business Committee', 'text', now()),
        ('women', 'tagline_ar', 'تمكين سيدات الأعمال', 'text', now()),
        ('women', 'tagline_en', 'Empowering Women in Business', 'text', now()),
        ('women', 'logo', NULL, 'file', now()),
        ('women', 'primary_color', '#8b3d63', 'color', now()),
        ('women', 'accent_color', '#d2a84a', 'color', now()),
        ('women', 'header_color', '#54213d', 'color', now()),
        ('women', 'footer_color', '#3c172c', 'color', now()),
        ('women', 'background_color', '#fff9fb', 'color', now()),
        ('women', 'text_color', '#34232c', 'color', now()),
        ('pages', 'privacy_ar', NULL, 'json', now()),
        ('pages', 'privacy_en', NULL, 'json', now()),
        ('pages', 'terms_ar', NULL, 'json', now()),
        ('pages', 'terms_en', NULL, 'json', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "occasions" (
        "id" BIGSERIAL PRIMARY KEY,
        "title_ar" varchar(255) NOT NULL,
        "title_en" varchar(255) NOT NULL,
        "event_date" date NOT NULL,
        "images" jsonb,
        "created_by" bigint,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`
      INSERT INTO "occasions" ("id", "title_ar", "title_en", "event_date", "images", "created_at", "updated_at")
      SELECT (n."extra"->>'legacyOccasionId')::bigint, n."title", COALESCE(n."extra"->>'titleEn', n."title"),
             (n."extra"->>'eventDate')::date, n."images", n."created_at", n."updated_at"
      FROM "news" n
      WHERE n."main_category" = 'OCCASION' AND n."extra"->>'legacyOccasionId' IS NOT NULL
      ON CONFLICT ("id") DO NOTHING
    `);
    await r.query(`
      SELECT setval(pg_get_serial_sequence('occasions', 'id'), COALESCE((SELECT MAX(id) FROM occasions), 1), EXISTS (SELECT 1 FROM occasions))
    `);
    await r.query(`DELETE FROM "news" WHERE "main_category" = 'OCCASION' AND "extra"->>'legacyOccasionId' IS NOT NULL`);
    await r.query(`DROP INDEX IF EXISTS "idx_news_occasion_dates"`);
    await r.query(`ALTER TABLE "news" DROP CONSTRAINT IF EXISTS "chk_news_occasion_finish"`);
    await r.query(`ALTER TABLE "news" DROP COLUMN IF EXISTS "finish_at"`);
    await r.query(`DELETE FROM "site_settings" WHERE ("category" = 'expo' AND "key" IN ('header_color', 'footer_color', 'background_color', 'text_color', 'floor_plan_ar', 'floor_plan_en', 'footer_text_ar', 'footer_text_en')) OR "category" = 'women'`);
    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ('pages.create', 'إضافة صفحة ثابتة', 'Create static pages', 'pages'),
             ('pages.delete', 'حذف صفحة ثابتة', 'Delete static pages')
      ON CONFLICT ("code") DO NOTHING
    `);
  }
}
