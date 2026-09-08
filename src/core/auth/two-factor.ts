import crypto from "crypto";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import * as jose from "jose";

// ==========================================
// 1. Field-Level AES-256-GCM Encryption
// ==========================================

function getEncryptionKey(): Buffer {
  if (process.env.TWO_FACTOR_ENCRYPTION_KEY) {
    const raw = process.env.TWO_FACTOR_ENCRYPTION_KEY;
    if (raw.length === 64) {
      return Buffer.from(raw, "hex");
    }
    return crypto.scryptSync(raw, "resto-bird-two-factor-salt", 32);
  }

  // Fallback derived key using JWT_SECRET or local fallback salt
  const secretSource =
    process.env.JWT_SECRET || "resto-bird-mfa-default-secret-key-must-change-in-production";
  return crypto.scryptSync(secretSource, "resto-bird-two-factor-salt-fixed", 32);
}

/**
 * Encrypts a plaintext TOTP secret with AES-256-GCM before database storage.
 * Format: ivHex:authTagHex:cipherHex
 */
export function encryptTotpSecret(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted TOTP secret from the database.
 */
export function decryptTotpSecret(encryptedPayload: string): string {
  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// ==========================================
// 2. TOTP Generation, QR Code & Verification
// ==========================================

export function generateTotpSecret(): string {
  return generateSecret();
}

export function generateTotpUri(email: string, secret: string): string {
  return generateURI({
    issuer: "Resto Bird",
    label: email,
    secret,
  });
}

export async function generateQrCodeDataUrl(uri: string): Promise<string> {
  return await QRCode.toDataURL(uri, {
    width: 280,
    margin: 2,
    color: {
      dark: "#0F172A",
      light: "#FFFFFF",
    },
  });
}

export function formatManualKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Verifies a 6-digit TOTP code against the plaintext secret.
 */
export async function verifyTotpCode(secret: string, token: string): Promise<boolean> {
  try {
    const cleanToken = token.replace(/\s+/g, "").trim();
    if (!/^\d{6}$/.test(cleanToken)) {
      return false;
    }

    const result = await verify({
      secret,
      token: cleanToken,
    });

    return result.valid === true;
  } catch (err) {
    console.error("TOTP verification error:", err);
    return false;
  }
}

// ==========================================
// 3. Recovery Codes Generator & Hasher
// ==========================================

const RECOVERY_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateRandomSegment(length: number): string {
  let result = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += RECOVERY_CHARS[bytes[i] % RECOVERY_CHARS.length];
  }
  return result;
}

/**
 * Generates an array of human-readable recovery codes e.g. "RB-8K7P-2M4Q".
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part1 = generateRandomSegment(4);
    const part2 = generateRandomSegment(4);
    codes.push(`RB-${part1}-${part2}`);
  }
  return codes;
}

/**
 * One-way SHA-256 hash for database storage of recovery codes.
 */
export function hashRecoveryCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Timing-safe recovery code comparison.
 */
export function verifyRecoveryCodeMatch(plainCode: string, storedHash: string): boolean {
  const inputHash = hashRecoveryCode(plainCode);
  if (inputHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(storedHash));
}

// ==========================================
// 4. Temporary 2FA Login Challenge Token
// ==========================================

const CHALLENGE_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "resto-bird-mfa-challenge-secret-key-123456"
);

export interface TwoFactorChallengePayload {
  type: "2FA_CHALLENGE";
  userId: string;
  email: string;
  name: string;
  restaurantId: string;
  subdomain: string;
  tokenVersion: number;
}

/**
 * Creates a short-lived (5 minutes), single-purpose 2FA challenge JWT.
 */
export async function sign2FAChallenge(payload: Omit<TwoFactorChallengePayload, "type">): Promise<string> {
  return await new jose.SignJWT({ ...payload, type: "2FA_CHALLENGE" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(CHALLENGE_SECRET);
}

/**
 * Verifies a 2FA challenge token. Returns payload or null if expired/invalid.
 */
export async function verify2FAChallenge(token: string): Promise<TwoFactorChallengePayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, CHALLENGE_SECRET, {
      algorithms: ["HS256"],
    });

    if (payload.type !== "2FA_CHALLENGE") {
      return null;
    }

    return payload as unknown as TwoFactorChallengePayload;
  } catch (error) {
    return null;
  }
}
