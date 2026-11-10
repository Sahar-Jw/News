import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Get2Trade booking form: the requested space type, the requested rental duration (value + unit) and the additional
 * services wished by the applicant. All nullable, so requests received before this change stay valid. Idempotent.
 */
export class AddGet2TradeBookingDetails1765500000000 implements MigrationInterface {
  name = 'AddGet2TradeBookingDetails1765500000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      ALTER TABLE "g2t_bookings"
        ADD COLUMN IF NOT EXISTS "space_kind" varchar(20),
        ADD COLUMN IF NOT EXISTS "duration_value" int,
        ADD COLUMN IF NOT EXISTS "duration_unit" varchar(10),
        ADD COLUMN IF NOT EXISTS "extra_services" text
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`
      ALTER TABLE "g2t_bookings"
        DROP COLUMN IF EXISTS "space_kind",
        DROP COLUMN IF EXISTS "duration_value",
        DROP COLUMN IF EXISTS "duration_unit",
        DROP COLUMN IF EXISTS "extra_services"
    `);
  }
}
