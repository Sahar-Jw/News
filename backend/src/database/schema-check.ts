import 'dotenv/config';
import 'reflect-metadata';
import dataSource from './data-source';

/**
 * Read-only: prints the SQL TypeORM would run to make the database match the entities - and runs NOTHING.
 *   npm run schema:check        (dev)         npm run schema:check:prod        (built app)
 * Use it to see exactly what differs, e.g. after importing a dump into a new database. Lines with DROP deserve a careful look.
 */
(async () => {
  await dataSource.initialize();
  try {
    const log = await dataSource.driver.createSchemaBuilder().log();
    const up = log.upQueries.map((q) => q.query);
    if (up.length === 0) console.log('The database matches the entities: nothing to change.');
    else {
      console.log(`${up.length} difference(s) between the database and the entities (NOTHING was executed):\n`);
      for (const q of up) console.log(`${/^\s*(ALTER TABLE .* DROP|DROP)/i.test(q) ? '!! ' : '   '}${q};`);
    }
  } finally {
    await dataSource.destroy();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
