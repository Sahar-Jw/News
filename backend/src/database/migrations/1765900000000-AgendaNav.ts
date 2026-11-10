import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Chamber agenda" now has its own page (/agenda: upcoming events with time, place, organizer, audience, registration + a monthly calendar).
 * The menu link that pointed at /occasions/upcoming is re-pointed to it. Only the untouched default link is changed. Idempotent.
 */
export class AgendaNav1765900000000 implements MigrationInterface {
  name = 'AgendaNav1765900000000';

  public async up(r: QueryRunner): Promise<void> {
    if (!(await r.query(`SELECT to_regclass('public.nav_items') AS t`))[0]?.t) return;
    await r.query(`UPDATE "nav_items" SET "url" = '/agenda' WHERE "url" = '/occasions/upcoming' AND "title_ar" = 'أجندة الغرفة'`);
  }

  public async down(r: QueryRunner): Promise<void> {
    if (!(await r.query(`SELECT to_regclass('public.nav_items') AS t`))[0]?.t) return;
    await r.query(`UPDATE "nav_items" SET "url" = '/occasions/upcoming' WHERE "url" = '/agenda' AND "title_ar" = 'أجندة الغرفة'`);
  }
}
