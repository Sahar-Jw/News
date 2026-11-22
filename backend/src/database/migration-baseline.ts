import 'dotenv/config';
import { baselineMigrations, migrationsInCode, parseBaselineSetting } from './migration-history';

/**
 * Records the migrations of the code as "already applied" WITHOUT running them - for a database whose tables already contain their result
 * (created by synchronize, or restored without the typeorm_migrations table).
 *   npm run migration:baseline:prod -- all            every migration of the code
 *   npm run migration:baseline:prod -- 1767500000000  only migrations up to that timestamp; newer ones stay pending and run normally
 * Safe to repeat. Add --dry to only print what would be recorded.
 */
(async () => {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const arg = args.find((a) => !a.startsWith('--'));
  if (!arg) {
    console.error('Usage: migration:baseline -- <all | timestamp> [--dry]');
    process.exit(2);
  }
  const { on, upTo } = parseBaselineSetting(arg);
  if (!on) {
    console.error(`Not understood: "${arg}" (use "all" or a timestamp such as 1767500000000)`);
    process.exit(2);
  }
  if (dry) {
    const list = migrationsInCode().filter((m) => upTo === undefined || m.timestamp <= upTo);
    console.log(`--dry: would record ${list.length} migration(s) (those already recorded are skipped). Nothing was changed.`);
    return;
  }
  const r = await baselineMigrations(process.env, upTo);
  console.log(`recorded ${r.recorded.length} migration(s) as applied; ${r.skippedAlreadyRecorded} were already recorded; ${r.leftPending.length} left pending${r.note ? ` (${r.note})` : ''}.`);
  for (const n of r.leftPending) console.log(`  pending: ${n}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
