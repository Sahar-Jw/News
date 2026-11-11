import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gallery items can hold pictures AND a YouTube video, both optional (at least one is required by the API):
 *  - the English title is optional (stored as an empty string, readers fall back to the Arabic title)
 *  - `thumbnail`: the picture chosen as the cover (empty = the first picture, else YouTube's own thumbnail)
 *  - `kind` is now derived ('video' only for a video without pictures); existing rows keep working as they are
 * Idempotent.
 */
export class GalleryOptionalPartsAndThumbnail1766200000000 implements MigrationInterface {
  name = 'GalleryOptionalPartsAndThumbnail1766200000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`ALTER TABLE "galleries" ALTER COLUMN "title_en" SET DEFAULT ''`);
    await r.query(`ALTER TABLE "galleries" ADD COLUMN IF NOT EXISTS "thumbnail" varchar(255)`);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`ALTER TABLE "galleries" DROP COLUMN IF EXISTS "thumbnail"`);
    await r.query(`ALTER TABLE "galleries" ALTER COLUMN "title_en" DROP DEFAULT`);
  }
}
