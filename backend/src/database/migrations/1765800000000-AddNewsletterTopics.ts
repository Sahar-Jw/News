import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Newsletter: a subscriber chooses the topics (news, courses, events, decisions, circulars, economic opportunities, committees) and the language of
 * the e-mails; `newsletter_dispatches` remembers which published rows were already e-mailed, so a row is sent once, whatever instance or restart.
 * Everything that is published BEFORE this migration is marked as already sent, so turning the feature on never mails old content. Idempotent.
 */
export class AddNewsletterTopics1765800000000 implements MigrationInterface {
  name = 'AddNewsletterTopics1765800000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "topics" jsonb`);
    await r.query(`ALTER TABLE "subscribers" ADD COLUMN IF NOT EXISTS "language" varchar(2) NOT NULL DEFAULT 'ar'`);
    await r.query(`CREATE TABLE IF NOT EXISTS "newsletter_dispatches" (
      "news_id" bigint PRIMARY KEY,
      "sent_at" timestamptz NOT NULL DEFAULT now(),
      "recipients" int NOT NULL DEFAULT 0
    )`);
    await r.query(`INSERT INTO "newsletter_dispatches" ("news_id", "recipients") SELECT "id", 0 FROM "news" ON CONFLICT DO NOTHING`);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DROP TABLE IF EXISTS "newsletter_dispatches"`);
    await r.query(`ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "language"`);
    await r.query(`ALTER TABLE "subscribers" DROP COLUMN IF EXISTS "topics"`);
  }
}
