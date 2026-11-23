import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The main menu can hold standalone links (a single page in the bar, not only dropdowns):
 *  - nav_groups.is_single: the "group" is one link shown directly in the bar (it holds exactly one nav_items row);
 *  - nav_items.is_custom: the link was added from Settings -> Main menu (so it can be edited and deleted there; links created by a page's
 *    migration stay protected as before).
 * Idempotent.
 */
export class AddNavStandaloneLinks1768000000000 implements MigrationInterface {
  name = 'AddNavStandaloneLinks1768000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE nav_groups ADD COLUMN IF NOT EXISTS is_single boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE nav_items ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM nav_items WHERE group_id IN (SELECT id FROM nav_groups WHERE is_single = true)`);
    await q.query(`DELETE FROM nav_groups WHERE is_single = true`);
    await q.query(`ALTER TABLE nav_items DROP COLUMN IF EXISTS is_custom`);
    await q.query(`ALTER TABLE nav_groups DROP COLUMN IF EXISTS is_single`);
  }
}
