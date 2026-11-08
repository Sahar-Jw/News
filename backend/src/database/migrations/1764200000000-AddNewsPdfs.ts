import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A news record can carry several PDFs: new jsonb column `news.pdfs` (list of storage paths, in display order).
 * `news.pdf` stays and always mirrors the first one, so everything that reads it keeps working. Idempotent.
 */
export class AddNewsPdfs1764200000000 implements MigrationInterface {
  name = 'AddNewsPdfs1764200000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "pdfs" jsonb`);
    await r.query(`UPDATE "news" SET "pdfs" = jsonb_build_array("pdf") WHERE "pdf" IS NOT NULL AND "pdf" <> '' AND "pdfs" IS NULL`);
  }

  public async down(r: QueryRunner): Promise<void> {
    // keep the first PDF in "pdf" (it is already mirrored there), drop the list
    await r.query(`ALTER TABLE "news" DROP COLUMN IF EXISTS "pdfs"`);
  }
}
