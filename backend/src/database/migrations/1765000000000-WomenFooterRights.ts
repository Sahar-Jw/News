import { MigrationInterface, QueryRunner } from 'typeorm';

export class WomenFooterRights1765000000000 implements MigrationInterface {
  name = 'WomenFooterRights1765000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES
        ('women', 'rights_ar', '© جميع الحقوق محفوظة للجنة سيدات الأعمال', 'text', now()),
        ('women', 'rights_en', '© All rights reserved to the Women Business Committee', 'text', now())
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "site_settings" WHERE "category" = 'women' AND "key" IN ('rights_ar', 'rights_en')`);
  }
}
