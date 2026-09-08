import { Pool } from "pg";
import { connectionString } from "./client";

let ensured = false;

/**
 * Ensures two_factor_auth and two_factor_recovery_codes tables exist in PostgreSQL.
 * Runs once idempotently with CREATE TABLE IF NOT EXISTS.
 */
export async function ensureTwoFactorTables(): Promise<void> {
  if (ensured) return;

  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "two_factor_auth" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "enabled" BOOLEAN NOT NULL DEFAULT false,
        "secret_encrypted" TEXT,
        "verified_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "two_factor_auth_pkey" PRIMARY KEY ("id")
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "two_factor_auth_user_id_key" ON "two_factor_auth"("user_id");

      CREATE TABLE IF NOT EXISTS "two_factor_recovery_codes" (
        "id" TEXT NOT NULL,
        "two_factor_auth_id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "code_hash" TEXT NOT NULL,
        "used_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "two_factor_recovery_codes_pkey" PRIMARY KEY ("id")
      );

      CREATE INDEX IF NOT EXISTS "two_factor_recovery_codes_user_id_idx" ON "two_factor_recovery_codes"("user_id");
      CREATE INDEX IF NOT EXISTS "two_factor_recovery_codes_two_factor_auth_id_idx" ON "two_factor_recovery_codes"("two_factor_auth_id");
    `);
    ensured = true;
  } catch (err: any) {
    console.warn("Could not auto-ensure two_factor tables:", err?.message || err);
  } finally {
    await pool.end().catch(() => {});
  }
}
