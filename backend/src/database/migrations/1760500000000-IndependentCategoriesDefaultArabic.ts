import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - news.language defaults to Arabic
 * - subcategory is queried on its own (independent of main_category) -> dedicated index
 */
export class IndependentCategoriesDefaultArabic1760500000000 implements MigrationInterface {
  name = 'IndependentCategoriesDefaultArabic1760500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE \`news\` MODIFY \`language\` ENUM('ar','en') NOT NULL DEFAULT 'ar'`);
    await q.query(`CREATE INDEX \`idx_news_subcategory\` ON \`news\` (\`language\`, \`status\`, \`visibility\`, \`subcategory\`)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX \`idx_news_subcategory\` ON \`news\``);
    await q.query(`ALTER TABLE \`news\` MODIFY \`language\` ENUM('ar','en') NOT NULL`);
  }
}
