import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Some news rows (imported with SQL / from an older database) keep their list columns as a JSON *string*
 * ("[\"news/a.jpg\"]" or "news/a.jpg,news/b.jpg") instead of a JSON array (["news/a.jpg"]). The code reads both, but this turns them
 * into proper arrays once, for good: news.images, news.topics and news.pdfs.
 * Idempotent: only rows whose value is a JSON string are touched; arrays and nulls are left alone. TypeORM runs the migration in one transaction.
 */
export class FixStringListColumnsInNews1767500000000 implements MigrationInterface {
  name = 'FixStringListColumnsInNews1767500000000';

  public async up(r: QueryRunner): Promise<void> {
    for (const col of ['images', 'topics', 'pdfs']) {
      await r.query(
        `UPDATE "news" SET "${col}" = CASE
            WHEN ("${col}" #>> '{}') ~ '^\\s*\\[' THEN ("${col}" #>> '{}')::jsonb
            ELSE to_jsonb(ARRAY(SELECT btrim(x) FROM unnest(string_to_array("${col}" #>> '{}', ',')) AS x WHERE btrim(x) <> ''))
          END
          WHERE jsonb_typeof("${col}") = 'string'`,
      );
    }
  }

  public async down(): Promise<void> {
    // nothing to undo: the old values were the same lists written as text
  }
}
