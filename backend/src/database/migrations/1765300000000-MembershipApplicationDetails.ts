import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Membership applications: the establishment's details asked by the application form (business type, commercial register number and
 * date, authorised contact person). Nullable, so applications received before this change stay valid. Idempotent.
 */
export class MembershipApplicationDetails1765300000000 implements MigrationInterface {
  name = 'MembershipApplicationDetails1765300000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      ALTER TABLE "membership_applications"
        ADD COLUMN IF NOT EXISTS "business_type" varchar(20),
        ADD COLUMN IF NOT EXISTS "business_type_other" varchar(120),
        ADD COLUMN IF NOT EXISTS "commercial_reg_no" varchar(60),
        ADD COLUMN IF NOT EXISTS "registration_date" date,
        ADD COLUMN IF NOT EXISTS "contact_person" varchar(150)
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`
      ALTER TABLE "membership_applications"
        DROP COLUMN IF EXISTS "business_type",
        DROP COLUMN IF EXISTS "business_type_other",
        DROP COLUMN IF EXISTS "commercial_reg_no",
        DROP COLUMN IF EXISTS "registration_date",
        DROP COLUMN IF EXISTS "contact_person"
    `);
  }
}
