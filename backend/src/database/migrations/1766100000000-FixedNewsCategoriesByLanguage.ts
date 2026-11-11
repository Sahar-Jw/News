import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The fixed media-center news categories exist in two spellings (Arabic / English) and each record must carry the one of its own language:
 * English news filed under an Arabic label (or the other way round) is moved to the label of its language.
 * Idempotent; down() is a no-op because the original spelling of each row is not kept.
 */
const PAIRS: [string, string][] = [
  ['أخبار الغرفة', 'Chamber News'],
  ['أخبار مجلس الإدارة', 'Board of Directors News'],
  ['أخبار رئيس الغرفة', 'Chamber President News'],
  ['أخبار اللجان', 'Committees News'],
  ['أخبار مركز التدريب', 'Training Center News'],
  ['أخبار حاضنة الأعمال', 'Business Incubator News'],
  ['أخبار لجنة سيدات الأعمال', 'Businesswomen Committee News'],
  ['الأخبار الاقتصادية', 'Economic News'],
  ['المعارض والفعاليات', 'Exhibitions & Events'],
  ['الزيارات واللقاءات', 'Visits & Meetings'],
];

export class FixedNewsCategoriesByLanguage1766100000000 implements MigrationInterface {
  name = 'FixedNewsCategoriesByLanguage1766100000000';

  public async up(r: QueryRunner): Promise<void> {
    for (const [ar, en] of PAIRS) {
      await r.query(`UPDATE "news" SET "main_category" = $1 WHERE "language" = 'en' AND "main_category" = $2`, [en, ar]);
      await r.query(`UPDATE "news" SET "main_category" = $1 WHERE "language" = 'ar' AND "main_category" = $2`, [ar, en]);
    }
  }

  public async down(): Promise<void> {
    /* nothing to restore */
  }
}
