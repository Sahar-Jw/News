import { MigrationInterface, QueryRunner } from 'typeorm';

/** Breaking news are shown to every visitor; make sure no existing one is stored as members-only. */
export class BreakingNewsPublic1767710000000 implements MigrationInterface {
  name = 'BreakingNewsPublic1767710000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`UPDATE "news" SET "visibility" = 'public' WHERE "main_category" = 'BREAKING' AND "visibility" <> 'public'`);
  }

  public async down(): Promise<void> {}
}
