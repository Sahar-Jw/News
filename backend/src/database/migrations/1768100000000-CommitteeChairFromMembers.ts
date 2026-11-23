import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The committee chair is no longer typed in the committee form: it is the committee member whose position is "chair" (one per committee).
 * This copies the name of every existing chair member into its committee (news.extra.chairNameAr / chairNameEn), which is what the public
 * pages read. Committees without a chair member keep the name that was typed before. Idempotent.
 */
export class CommitteeChairFromMembers1768100000000 implements MigrationInterface {
  name = 'CommitteeChairFromMembers1768100000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      UPDATE news c
      SET extra = COALESCE(c.extra, '{}'::jsonb) || jsonb_build_object('chairNameAr', m.title, 'chairNameEn', COALESCE(m.extra->>'nameEn', ''))
      FROM (
        SELECT DISTINCT ON ((extra->>'parentId')::bigint) (extra->>'parentId')::bigint AS parent_id, title, extra
        FROM news
        WHERE main_category = 'COMMITTEE_MEMBER' AND extra->>'role' = 'chair'
        ORDER BY (extra->>'parentId')::bigint, COALESCE((extra->>'sortOrder')::int, 0), id
      ) m
      WHERE c.id = m.parent_id AND c.main_category IN ('COMMITTEE', 'WOMEN_COMMITTEE')
    `);
  }

  async down(): Promise<void> {
    // nothing to undo: the names are plain copies
  }
}
