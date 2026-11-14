import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Menu and footer links saved in the database pointed at the old detail addresses (/pages/view?slug=about, /news/view?id=5).
 * The site now has clean addresses (/pages/about, /news/5) and redirects the old ones, so this only tidies what is stored:
 * the menu shows the real address and no redirect is needed. Idempotent; tables that do not exist are skipped.
 */
const KINDS = 'news|documents|gallery|services|training|occasions|committees|board';

export class CleanDetailLinks1767000000000 implements MigrationInterface {
  name = 'CleanDetailLinks1767000000000';

  public async up(r: QueryRunner): Promise<void> {
    for (const table of ['nav_items', 'footer_links']) {
      const has = (await r.query(`SELECT to_regclass('public.${table}') AS t`))[0]?.t;
      if (!has) continue;
      await r.query(`UPDATE "${table}" SET "url" = regexp_replace("url", '^/(${KINDS})/view/?\\?id=([0-9]+)$', '/\\1/\\2') WHERE "url" ~ '^/(${KINDS})/view/?\\?id=[0-9]+$'`);
      await r.query(`UPDATE "${table}" SET "url" = regexp_replace("url", '^/pages/view/?\\?slug=([A-Za-z0-9_-]+)$', '/pages/\\1') WHERE "url" ~ '^/pages/view/?\\?slug=[A-Za-z0-9_-]+$'`);
    }
  }

  public async down(): Promise<void> {
    // nothing to undo: the old addresses still work through the redirect
  }
}
