import { MigrationInterface, QueryRunner } from 'typeorm';

export class NoDraftNews1792200000000 implements MigrationInterface {
  name = 'NoDraftNews1792200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE \`news\`
      SET
        \`status\` = CASE
          WHEN \`publish_at\` > UTC_TIMESTAMP() THEN 'scheduled'
          ELSE 'published'
        END,
        \`publish_at\` = CASE
          WHEN \`publish_at\` IS NULL THEN UTC_TIMESTAMP()
          ELSE \`publish_at\`
        END
      WHERE \`status\` = 'draft'
    `);
    await q.query(`ALTER TABLE \`news\` MODIFY \`status\` ENUM('scheduled','published') NOT NULL DEFAULT 'published'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE \`news\` MODIFY \`status\` ENUM('draft','scheduled','published') NOT NULL DEFAULT 'draft'`);
  }
}
