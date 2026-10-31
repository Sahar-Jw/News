import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNewsYoutubeUrl1761900000000 implements MigrationInterface {
  name = 'AddNewsYoutubeUrl1761900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "news" ADD COLUMN IF NOT EXISTS "youtube_url" character varying(255)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "news" DROP COLUMN IF EXISTS "youtube_url"`);
  }
}
