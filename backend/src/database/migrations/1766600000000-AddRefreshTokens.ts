import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refresh tokens: the short sign-in cookie (access token) is renewed silently from a long-lived, rotating refresh token, so people who are
 * working are not signed out. Only the SHA-256 of each token is stored. Idempotent.
 */
export class AddRefreshTokens1766600000000 implements MigrationInterface {
  name = 'AddRefreshTokens1766600000000';

  public async up(r: QueryRunner): Promise<void> {
    await r.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" bigserial PRIMARY KEY,
        "user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "token_hash" varchar(64) NOT NULL,
        "family_id" varchar(36) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await r.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_refresh_tokens_hash" ON "refresh_tokens" ("token_hash")`);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user" ON "refresh_tokens" ("user_id")`);
    await r.query(`CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_family" ON "refresh_tokens" ("family_id")`);
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
  }
}
