import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Signing in fails while the rest of the site works, and the log says "Connection terminated unexpectedly" on the user lookup
 * (SELECT ... FROM users LEFT JOIN roles LEFT JOIN cities WHERE email = ...). That is the database server cutting the connection, not an
 * application error - the same picture as the damaged index on `news` (see ReindexNewsTitle / ReindexNewsTable).
 * REINDEX rebuilds every index of a table from its data (the data is not touched), for the tables the sign-in reads and writes.
 *
 * It can never stop the backend from starting: a table that is missing is skipped, and a table that cannot be rebuilt right now
 * (busy for more than 5 seconds, damaged file ...) only produces a warning in the DATABASE log; the index can then be rebuilt later by hand: REINDEX TABLE users;
 * Safe to run again.
 */
export class ReindexLoginTables1767800000000 implements MigrationInterface {
  name = 'ReindexLoginTables1767800000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`DO $mig$
      DECLARE t text;
      BEGIN
        PERFORM set_config('lock_timeout', '5s', true); -- never wait long for a busy table: skip it (warning) instead of holding up the start
        FOREACH t IN ARRAY ARRAY['users', 'roles', 'cities', 'permissions', 'role_permissions', 'refresh_tokens', 'audit_logs'] LOOP
          BEGIN
            IF to_regclass(format('%I', t)) IS NOT NULL THEN
              EXECUTE format('REINDEX TABLE %I', t);
            END IF;
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'REINDEX TABLE % skipped: %', t, SQLERRM;
          END;
        END LOOP;
      END $mig$;`);
  }

  public async down(): Promise<void> {
    // nothing to undo
  }
}
