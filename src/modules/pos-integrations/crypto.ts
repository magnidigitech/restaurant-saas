import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/core/database/client";
import { ProviderCredentials } from "./types";

const SENSITIVE_KEYS = new Set([
  "clientSecret",
  "apiToken",
  "accessToken",
  "webhookSecret",
  "refreshToken",
]);

function getPosEncryptionKey(): Buffer {
  const secret =
    process.env.POS_ENCRYPTION_KEY ||
    process.env.VAULT_MASTER_KEY ||
    process.env.SESSION_SECRET ||
    "restobird-pos-dev-fallback-key";
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

function encryptString(plaintext: string): string {
  const key = getPosEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decryptString(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted POS credential payload");
  }
  const [ivB64, tagB64, ctB64] = parts;
  const key = getPosEncryptionKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Encrypts POS provider credentials JSON using AES-256-GCM.
 */
export function encryptPosCredentials(credentials: ProviderCredentials): string {
  return encryptString(JSON.stringify(credentials || {}));
}

/**
 * Decrypts POS provider credentials JSON from `credentialsEncrypted`.
 */
export function decryptPosCredentials(encrypted: string): ProviderCredentials {
  const raw = decryptString(encrypted);
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Decrypted POS credentials payload is invalid");
  }
  return parsed as ProviderCredentials;
}

export function encryptWebhookSecret(secret: string): string {
  return encryptString(secret);
}

export function decryptWebhookSecret(encrypted: string): string {
  return decryptString(encrypted);
}

/**
 * Strips secrets and tokens from credential objects for safe API/UI display.
 */
export function maskPosCredentials(
  credentials?: ProviderCredentials | null
): Record<string, string | boolean | undefined> {
  if (!credentials) return {};
  return {
    environment: credentials.environment || "SANDBOX",
    restaurantGuid: credentials.restaurantGuid,
    merchantId: credentials.merchantId,
    locationId: credentials.locationId,
    region: credentials.region,
    hasClientId: Boolean(credentials.clientId),
    hasClientSecret: Boolean(credentials.clientSecret),
    hasApiToken: Boolean(credentials.apiToken || credentials.accessToken),
    hasWebhookSecret: Boolean(credentials.webhookSecret),
  };
}

/**
 * Sanitizes provider/network error messages so bearer tokens, client secrets,
 * or raw credential payloads are never leaked into DB columns, logs, or API responses.
 */
export function sanitizeProviderError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Provider communication error";

  let sanitized = raw
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(
      /(client_secret|clientSecret|api_key|apiKey|access_token|accessToken|apiToken|password|secret)["':=\s]+[^\s,"'}]+/gi,
      "$1=[REDACTED]"
    )
    .replace(/\s+/g, " ")
    .trim();

  if (sanitized.length > 320) {
    sanitized = `${sanitized.slice(0, 317)}...`;
  }
  return sanitized || "Provider communication error";
}

/**
 * Safely resolves credentials for an integration, migrating any legacy plaintext
 * `credentials` JSON to `credentialsEncrypted`, verifying decryption round-trip,
 * and clearing the plaintext column only after verification succeeds.
 */
export async function resolveAndMigrateIntegrationCredentials(integration: {
  id: string;
  credentials: Prisma.JsonValue | null;
  credentialsEncrypted: string | null;
}): Promise<ProviderCredentials> {
  if (integration.credentialsEncrypted) {
    const decrypted = decryptPosCredentials(integration.credentialsEncrypted);
    if (integration.credentials !== null) {
      await prisma.posIntegration.update({
        where: { id: integration.id },
        data: { credentials: Prisma.JsonNull },
      });
    }
    return decrypted;
  }

  if (integration.credentials && typeof integration.credentials === "object") {
    const legacy = integration.credentials as ProviderCredentials;
    const encrypted = encryptPosCredentials(legacy);
    const verified = decryptPosCredentials(encrypted);

    if (JSON.stringify(legacy) !== JSON.stringify(verified)) {
      throw new Error("Credential encryption verification failed; plaintext retained");
    }

    await prisma.posIntegration.update({
      where: { id: integration.id },
      data: {
        credentialsEncrypted: encrypted,
        credentials: Prisma.JsonNull,
      },
    });

    return verified;
  }

  return {};
}

export function redactObjectSecrets<T extends Record<string, any>>(obj: T): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = v ? "[REDACTED]" : undefined;
    } else {
      out[k] = v;
    }
  }
  return out;
}
