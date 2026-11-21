import { DataSource, QueryRunner } from 'typeorm';

/**
 * Runs `fn` with a query runner whose queries read the table itself, never an index (SET LOCAL ... = off inside one transaction).
 * Used for "which distinct values really exist" lookups (the news categories): when an index of the table is damaged, PostgreSQL answers
 * a DISTINCT from the index and returns values that no longer exist and misses ones that do. A scan of the table is always right, and
 * the news table is small enough for that to cost nothing.
 */
export async function withoutIndexes<T>(ds: DataSource, fn: (qr: QueryRunner) => Promise<T>): Promise<T> {
  const qr = ds.createQueryRunner();
  await qr.connect();
  try {
    await qr.startTransaction();
    await qr.query('SET LOCAL enable_indexscan = off');
    await qr.query('SET LOCAL enable_indexonlyscan = off');
    await qr.query('SET LOCAL enable_bitmapscan = off');
    const out = await fn(qr);
    await qr.commitTransaction();
    return out;
  } catch (e) {
    if (qr.isTransactionActive) await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}
