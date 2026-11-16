import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Settings -> Upload limits: the biggest picture (MB), the biggest PDF (MB), how many pictures and how many PDFs one record may carry.
 * The values are the limits the site had until now (5 MB, 25 MB, 100 pictures, 10 PDFs). Idempotent; an existing value is never overwritten.
 */
export class AddUploadLimitSettings1767300000000 implements MigrationInterface {
  name = 'AddUploadLimitSettings1767300000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at") VALUES
        ('uploads', 'image_max_mb', '5', 'number', now()),
        ('uploads', 'pdf_max_mb', '25', 'number', now()),
        ('uploads', 'max_images', '100', 'number', now()),
        ('uploads', 'max_pdfs', '10', 'number', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'uploads'`);
  }
}
