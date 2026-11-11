import { MigrationInterface, QueryRunner } from 'typeorm';

const PAGES = ['system', 'newsletter', 'membership', 'get2trade', 'training', 'incubator', 'expo'];

/**
 * Mail identity per part of the site: one SMTP account sends everything, but each part (newsletter, membership, Get2Trade, training,
 * incubator, EXPO, system) can show its own sender NAME and take replies at its own address. Empty = the account's own name / replies to the account.
 * Idempotent; existing values are never overwritten.
 */
export class AddMailIdentitySettings1766400000000 implements MigrationInterface {
  name = 'AddMailIdentitySettings1766400000000';

  public async up(r: QueryRunner): Promise<void> {
    const rows = PAGES.flatMap((p) => [`('mail', '${p}_name', NULL, 'text', now())`, `('mail', '${p}_reply_to', NULL, 'text', now())`]);
    await r.query(`
      INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at")
      VALUES ${rows.join(', ')}
      ON CONFLICT ("category", "key") DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'mail'`);
  }
}
