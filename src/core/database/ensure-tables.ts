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

      CREATE TABLE IF NOT EXISTS "passkeys" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "organization_id" TEXT NOT NULL,
        "credential_id" TEXT NOT NULL,
        "public_key" TEXT NOT NULL,
        "counter" BIGINT NOT NULL DEFAULT 0,
        "device_type" TEXT,
        "backed_up" BOOLEAN NOT NULL DEFAULT false,
        "name" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "last_used_at" TIMESTAMP(3),
        "revoked_at" TIMESTAMP(3),
        CONSTRAINT "passkeys_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "passkeys_credential_id_key" ON "passkeys"("credential_id");
      CREATE INDEX IF NOT EXISTS "passkeys_user_id_idx" ON "passkeys"("user_id");
      CREATE INDEX IF NOT EXISTS "passkeys_organization_id_idx" ON "passkeys"("organization_id");

      CREATE TABLE IF NOT EXISTS "trusted_devices" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "organization_id" TEXT NOT NULL,
        "device_name" TEXT,
        "token_hash" TEXT NOT NULL,
        "ip_address" TEXT,
        "last_used_at" TIMESTAMP(3),
        "expires_at" TIMESTAMP(3) NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "revoked_at" TIMESTAMP(3),
        CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "trusted_devices_token_hash_key" ON "trusted_devices"("token_hash");
      CREATE INDEX IF NOT EXISTS "trusted_devices_user_id_idx" ON "trusted_devices"("user_id");
      CREATE INDEX IF NOT EXISTS "trusted_devices_organization_id_idx" ON "trusted_devices"("organization_id");

      CREATE TABLE IF NOT EXISTS "user_sessions" (
        "id" TEXT NOT NULL,
        "user_id" TEXT NOT NULL,
        "organization_id" TEXT NOT NULL,
        "token_hash" TEXT NOT NULL,
        "ip_address" TEXT,
        "user_agent" TEXT,
        "device_name" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expires_at" TIMESTAMP(3) NOT NULL,
        "revoked_at" TIMESTAMP(3),
        CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_token_hash_key" ON "user_sessions"("token_hash");
      CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions"("user_id");
      CREATE INDEX IF NOT EXISTS "user_sessions_organization_id_idx" ON "user_sessions"("organization_id");

      CREATE TABLE IF NOT EXISTS "restaurant_security_policies" (
        "id" TEXT NOT NULL,
        "restaurant_id" TEXT NOT NULL,
        "require_mfa_roles" TEXT NOT NULL DEFAULT '["OWNER","ADMIN"]',
        "allowed_methods" TEXT NOT NULL DEFAULT '["PASSKEY","TOTP","RECOVERY_CODE"]',
        "trusted_device_duration_days" INTEGER NOT NULL DEFAULT 30,
        "enforce_immediate_mfa" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "restaurant_security_policies_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "restaurant_security_policies_restaurant_id_key" ON "restaurant_security_policies"("restaurant_id");

      CREATE TABLE IF NOT EXISTS "security_audit_logs" (
        "id" TEXT NOT NULL,
        "organization_id" TEXT,
        "user_id" TEXT,
        "user_email" TEXT,
        "event" TEXT NOT NULL,
        "ip_address" TEXT,
        "user_agent" TEXT,
        "metadata" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "security_audit_logs_organization_id_idx" ON "security_audit_logs"("organization_id");
      CREATE INDEX IF NOT EXISTS "security_audit_logs_user_id_idx" ON "security_audit_logs"("user_id");
      CREATE INDEX IF NOT EXISTS "security_audit_logs_created_at_idx" ON "security_audit_logs"("created_at");

      CREATE TABLE IF NOT EXISTS "platform_two_factor_auth" (
        "id" TEXT NOT NULL,
        "platform_user_id" TEXT NOT NULL,
        "enabled" BOOLEAN NOT NULL DEFAULT false,
        "secret_encrypted" TEXT,
        "verified_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "platform_two_factor_auth_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "platform_two_factor_auth_platform_user_id_key" ON "platform_two_factor_auth"("platform_user_id");

      CREATE TABLE IF NOT EXISTS "platform_two_factor_recovery_codes" (
        "id" TEXT NOT NULL,
        "platform_two_factor_id" TEXT NOT NULL,
        "platform_user_id" TEXT NOT NULL,
        "code_hash" TEXT NOT NULL,
        "used_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "platform_two_factor_recovery_codes_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "platform_two_factor_recovery_codes_platform_user_id_idx" ON "platform_two_factor_recovery_codes"("platform_user_id");
      CREATE INDEX IF NOT EXISTS "platform_two_factor_recovery_codes_platform_two_factor_id_idx" ON "platform_two_factor_recovery_codes"("platform_two_factor_id");

      CREATE TABLE IF NOT EXISTS "platform_passkeys" (
        "id" TEXT NOT NULL,
        "platform_user_id" TEXT NOT NULL,
        "credential_id" TEXT NOT NULL,
        "public_key" TEXT NOT NULL,
        "counter" BIGINT NOT NULL DEFAULT 0,
        "device_type" TEXT,
        "backed_up" BOOLEAN NOT NULL DEFAULT false,
        "name" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "last_used_at" TIMESTAMP(3),
        "revoked_at" TIMESTAMP(3),
        CONSTRAINT "platform_passkeys_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "platform_passkeys_credential_id_key" ON "platform_passkeys"("credential_id");
      CREATE INDEX IF NOT EXISTS "platform_passkeys_platform_user_id_idx" ON "platform_passkeys"("platform_user_id");

      CREATE TABLE IF NOT EXISTS "platform_trusted_devices" (
        "id" TEXT NOT NULL,
        "platform_user_id" TEXT NOT NULL,
        "device_name" TEXT,
        "token_hash" TEXT NOT NULL,
        "ip_address" TEXT,
        "last_used_at" TIMESTAMP(3),
        "expires_at" TIMESTAMP(3) NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "revoked_at" TIMESTAMP(3),
        CONSTRAINT "platform_trusted_devices_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "platform_trusted_devices_token_hash_key" ON "platform_trusted_devices"("token_hash");
      CREATE INDEX IF NOT EXISTS "platform_trusted_devices_platform_user_id_idx" ON "platform_trusted_devices"("platform_user_id");

      CREATE TABLE IF NOT EXISTS "platform_user_sessions" (
        "id" TEXT NOT NULL,
        "platform_user_id" TEXT NOT NULL,
        "token_hash" TEXT NOT NULL,
        "ip_address" TEXT,
        "user_agent" TEXT,
        "device_name" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expires_at" TIMESTAMP(3) NOT NULL,
        "revoked_at" TIMESTAMP(3),
        CONSTRAINT "platform_user_sessions_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "platform_user_sessions_token_hash_key" ON "platform_user_sessions"("token_hash");
      CREATE INDEX IF NOT EXISTS "platform_user_sessions_platform_user_id_idx" ON "platform_user_sessions"("platform_user_id");
    `);
    ensured = true;
  } catch (err: any) {
    console.warn("Could not auto-ensure two_factor tables:", err?.message || err);
  } finally {
    await pool.end().catch(() => {});
  }
}
