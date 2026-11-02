import { MigrationInterface, QueryRunner } from 'typeorm';

const PERMS: [string, string, string][] = [
  ['documents.read', 'عرض الوثائق', 'View documents'],
  ['documents.create', 'إضافة وثيقة', 'Create documents'],
  ['documents.update', 'تعديل وثيقة', 'Update documents'],
  ['documents.delete', 'حذف وثيقة', 'Delete documents'],
];

/**
 * Page 4 (decisions and circulars): one `documents` table (kind = decision | circular | library) where each row owns a PDF,
 * plus its permissions (granted to technical_admin). Idempotent.
 */
export class AddDocuments1762300000000 implements MigrationInterface {
  name = 'AddDocuments1762300000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "documents" (
        "id" BIGSERIAL PRIMARY KEY,
        "kind" varchar(30) NOT NULL,
        "doc_number" varchar(50),
        "title_ar" varchar(255) NOT NULL,
        "title_en" varchar(255),
        "summary_ar" text,
        "summary_en" text,
        "doc_date" date,
        "file" varchar(500) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_documents_kind_date" ON "documents" ("kind", "doc_date")`);
    const q = (v: string) => `'${v.replace(/'/g, "''")}'`;
    await r.query(`
      INSERT INTO "permissions" ("code", "name_ar", "name_en", "module")
      VALUES ${PERMS.map(([c, a, e]) => `(${q(c)}, ${q(a)}, ${q(e)}, 'documents')`).join(', ')}
      ON CONFLICT ("code") DO NOTHING
    `);
    await r.query(`
      INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
      SELECT ro."id", p."id", now() FROM "roles" ro CROSS JOIN "permissions" p
      WHERE ro."code" = 'technical_admin' AND p."module" = 'documents'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "permissions" WHERE "module" = 'documents'`);
    await r.query(`DROP TABLE IF EXISTS "documents"`);
  }
}
