import 'dotenv/config';
import { historyState, migrationsInCode } from './migration-history';

/**
 * Read-only: which migrations are recorded as applied in THIS database and which are pending (they would run on the next
 * `migration:run` / start with RUN_MIGRATIONS_ON_START=true).   npm run migration:status   |   npm run migration:status:prod
 */
(async () => {
  const st = await historyState(process.env);
  const code = migrationsInCode();
  const have = new Set(st.recorded);
  const pending = code.filter((m) => !have.has(m.name));
  console.log(`tables in the database: ${st.hasTables ? 'yes' : 'NO (empty database)'}`);
  console.log(`migrations in the code: ${code.length}   recorded as applied: ${code.length - pending.length}   pending: ${pending.length}`);
  if (st.hasTables && st.recorded.length === 0) {
    console.log('\nThis database has tables but NO migration history. Do not run migrations yet: record the history first with\n  npm run migration:baseline:prod -- all        (or: -- <timestamp>, see the README)');
  } else if (pending.length) {
    console.log('\nPending (will run, oldest first):');
    for (const m of pending) console.log(`  ${m.name}`);
  } else console.log('\nUp to date.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
