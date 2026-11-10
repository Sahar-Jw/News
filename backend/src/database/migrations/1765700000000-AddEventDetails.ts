import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Exhibitions & events: a news attached to an event can carry a kind (news, visit, meeting, participation, activity, media coverage).
 * The event's own new fields (sector, organizer, participation type, description, videos, coverage links) live in news.extra, so only this
 * column is needed. Nullable, so existing links stay valid. Idempotent.
 */
export class AddEventDetails1765700000000 implements MigrationInterface {
  name = 'AddEventDetails1765700000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`ALTER TABLE "content_links" ADD COLUMN IF NOT EXISTS "kind" varchar(20)`);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`ALTER TABLE "content_links" DROP COLUMN IF EXISTS "kind"`);
  }
}
