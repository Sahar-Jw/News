import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMS: [string, string, string][] = [
  ['board.read', 'عرض أعضاء المجلس', 'View board members'],
  ['board.create', 'إضافة عضو مجلس', 'Create board members'],
  ['board.update', 'تعديل عضو مجلس', 'Update board members'],
  ['board.delete', 'حذف عضو مجلس', 'Delete board members'],
];

/**
 * Page 5 (board of directors): `board_members` table (position, names, titles, bio, duties, term, photo)
 * and its permissions (granted to technical_admin). Idempotent. The old TEAM home section is left untouched.
 */
export class AddBoardMembers1762400000000 implements MigrationInterface {
  name = 'AddBoardMembers1762400000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "board_members" (
        "id" BIGSERIAL PRIMARY KEY,
        "position" varchar(30) NOT NULL,
        "name_ar" varchar(255) NOT NULL,
        "name_en" varchar(255),
        "job_title_ar" varchar(255),
        "job_title_en" varchar(255),
        "bio_ar" text,
        "bio_en" text,
        "duties_ar" text,
        "duties_en" text,
        "term_label" varchar(100),
        "photo" varchar(500),
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'board')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'board'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'board'`);
    await r.query(`DROP TABLE IF EXISTS "board_members"`);
  }
}
