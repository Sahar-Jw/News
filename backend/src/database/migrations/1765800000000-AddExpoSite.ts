import { MigrationInterface, QueryRunner } from 'typeorm';
import { EXPO_NEW_SETTINGS } from '../expo-settings';

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

/**
 * DCC EXPO as a full separate site (like the Women Business Committee page):
 *  - expo_applications: the fields of the three request forms (job title, country, city, products, area, booth type, interest, inquiry type)
 *    and the company profile file of the exhibitor form. All nullable, so requests received before this change stay valid.
 *  - the new "expo" settings (introduction sections, sectors, key information, floor plan image, team, social links, footer rights).
 * Idempotent; existing values are never overwritten.
 */
export class AddExpoSite1765800000000 implements MigrationInterface {
  name = 'AddExpoSite1765800000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      ALTER TABLE "expo_applications"
        ADD COLUMN IF NOT EXISTS "job_title" varchar(150),
        ADD COLUMN IF NOT EXISTS "country" varchar(100),
        ADD COLUMN IF NOT EXISTS "city" varchar(100),
        ADD COLUMN IF NOT EXISTS "products" text,
        ADD COLUMN IF NOT EXISTS "area" varchar(40),
        ADD COLUMN IF NOT EXISTS "participation_type" varchar(20),
        ADD COLUMN IF NOT EXISTS "interest" varchar(20),
        ADD COLUMN IF NOT EXISTS "inquiry_type" varchar(20),
        ADD COLUMN IF NOT EXISTS "profile_file" varchar(255)
    `);
    const rows = EXPO_NEW_SETTINGS.map(([key, type, value]) => `('expo', ${q(key)}, ${value ? q(value) : 'NULL'}, '${type}', now())`).join(',\n        ');
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES
        ${rows}
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    const keys = EXPO_NEW_SETTINGS.map(([key]) => q(key)).join(', ');
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'expo' AND "key" IN (${keys})`);
    await r.query(`
      ALTER TABLE "expo_applications"
        DROP COLUMN IF EXISTS "job_title", DROP COLUMN IF EXISTS "country", DROP COLUMN IF EXISTS "city", DROP COLUMN IF EXISTS "products",
        DROP COLUMN IF EXISTS "area", DROP COLUMN IF EXISTS "participation_type", DROP COLUMN IF EXISTS "interest",
        DROP COLUMN IF EXISTS "inquiry_type", DROP COLUMN IF EXISTS "profile_file"
    `);
  }
}
