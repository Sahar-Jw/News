import { MigrationInterface, QueryRunner } from 'typeorm';

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

/**
 * Page 18 (Media Center): three settings that say which news category feeds each tab
 * (official statements, interviews, media coverage). Press materials and the Media Kit are plain `documents`
 * (kind = press / mediakit): no schema change. Idempotent; existing values are never overwritten.
 */
export class AddMediaCenterSettings1762900000000 implements MigrationInterface {
  name = 'AddMediaCenterSettings1762900000000';

  public async up(r: QueryRunner): Promise<void> {
    const rows: [string, string][] = [
      ['statements_category', 'بيانات رسمية'],
      ['interviews_category', 'مقابلات'],
      ['coverage_category', 'تغطيات إعلامية'],
    ];
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ${rows.map(([k, v]) => `('media', ${q(k)}, ${q(v)}, 'text', now())`).join(', ')}
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'media'`);
  }
}
