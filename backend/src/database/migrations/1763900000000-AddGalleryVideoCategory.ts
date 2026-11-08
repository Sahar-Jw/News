import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Image and video gallery (document 6.20): a gallery item is now either a photo album or a YouTube video, and can be classified
 * (meeting, event, exhibition, conference, visit, committee, course). Existing galleries stay photo albums with no category.
 * Idempotent.
 */
export class AddGalleryVideoCategory1763900000000 implements MigrationInterface {
  name = 'AddGalleryVideoCategory1763900000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "kind" varchar(10) NOT NULL DEFAULT 'photos'`);
    await r.query(`ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "youtube_url" varchar(255)`);
    await r.query(`ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "category" varchar(30)`);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_galleries_kind_category" ON "galleries" ("kind", "category")`);
    // the home section is now "Photo & video gallery" (only while it still has the old default title: an edited title is never touched)
    await r.query(`UPDATE "site_settings" SET "value" = 'معرض الصور والفيديو', "updated_at" = now() WHERE "category" = 'sections_home' AND "key" = 'gallery_title_ar' AND "value" = 'معرض الصور'`);
    await r.query(`UPDATE "site_settings" SET "value" = 'Photo & video gallery', "updated_at" = now() WHERE "category" = 'sections_home' AND "key" = 'gallery_title_en' AND "value" = 'Photo gallery'`);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`UPDATE "site_settings" SET "value" = 'معرض الصور' WHERE "category" = 'sections_home' AND "key" = 'gallery_title_ar' AND "value" = 'معرض الصور والفيديو'`);
    await r.query(`UPDATE "site_settings" SET "value" = 'Photo gallery' WHERE "category" = 'sections_home' AND "key" = 'gallery_title_en' AND "value" = 'Photo & video gallery'`);
    await r.query(`DROP INDEX IF EXISTS "idx_galleries_kind_category"`);
    await r.query(`ALTER TABLE "galleries" DROP COLUMN IF EXISTS "category"`);
    await r.query(`ALTER TABLE "galleries" DROP COLUMN IF EXISTS "youtube_url"`);
    await r.query(`ALTER TABLE "galleries" DROP COLUMN IF EXISTS "kind"`);
  }
}
