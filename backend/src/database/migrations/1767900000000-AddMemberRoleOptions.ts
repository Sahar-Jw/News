import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The positions a person can hold (Board of directors, Committees & sectors, Women Business Committee) become editable lists, one per page:
 * site_settings `member_roles` / board | committee | women (JSON: [{ key, ar, en }], the order is the hierarchy of the public page).
 * The lists start with exactly the positions the site always had, so nothing changes until somebody edits a list in the page's settings.
 * Idempotent: a list that already exists is left alone.
 */
const DEFAULTS: Record<string, { key: string; ar: string; en: string }[]> = {
  board: [
    { key: 'president', ar: 'الرئيس', en: 'President' },
    { key: 'vice_president', ar: 'نائب الرئيس', en: 'Vice president' },
    { key: 'secretary', ar: 'أمين السر', en: 'Secretary' },
    { key: 'treasurer', ar: 'أمين الصندوق', en: 'Treasurer' },
    { key: 'member', ar: 'عضو', en: 'Member' },
  ],
  committee: [
    { key: 'chair', ar: 'الرئيس', en: 'Chair' },
    { key: 'secretary', ar: 'أمين السر', en: 'Secretary' },
    { key: 'vice', ar: 'نائب الرئيس', en: 'Vice chair' },
    { key: 'member', ar: 'عضو', en: 'Member' },
  ],
  women: [
    { key: 'chair', ar: 'رئيسة اللجنة', en: 'Chair' },
    { key: 'vice', ar: 'نائبة الرئيسة', en: 'Vice chair' },
    { key: 'secretary', ar: 'أمينة السر', en: 'Secretary' },
    { key: 'member', ar: 'عضوة', en: 'Member' },
  ],
};

export class AddMemberRoleOptions1767900000000 implements MigrationInterface {
  name = 'AddMemberRoleOptions1767900000000';

  public async up(r: QueryRunner): Promise<void> {
    for (const [scope, list] of Object.entries(DEFAULTS)) {
      await r.query(
        `INSERT INTO "site_settings" ("category", "key", "value", "value_type", "updated_at") VALUES ('member_roles', $1, $2, 'json', now())
         ON CONFLICT ("category", "key") DO NOTHING`,
        [scope, JSON.stringify(list)],
      );
    }
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM "site_settings" WHERE "category" = 'member_roles'`);
  }
}
