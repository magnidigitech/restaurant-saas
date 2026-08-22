import crypto from "crypto";

export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string; // Base64 (12 bytes for GCM)
  authTag: string; // Base64 (16 bytes for GCM)
}

export interface DecryptedSecretPayload {
  username?: string;
  password?: string;
  websiteUrl?: string;
  totpSecret?: string;
  notes?: string;
  licenseKey?: string;
  cardholderName?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  apiKey?: string;
  apiSecret?: string;
  customFields?: { label: string; value: string; isSecret?: boolean }[];
}

export const PBKDF2_ITERATIONS = 600000;
export const KEY_LENGTH_BYTES = 32; // 256 bits

/**
 * Generates cryptographically secure random bytes in hex or base64.
 */
export function generateRandomSalt(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function generateRandomIv(bytes = 12): string {
  return crypto.randomBytes(bytes).toString("base64");
}

/**
 * Derives a 256-bit AES symmetric key from a master password and salt using PBKDF2-SHA256.
 */
export async function deriveMasterKey(
  masterPassword: string,
  saltHex: string,
  iterations = PBKDF2_ITERATIONS
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      masterPassword,
      Buffer.from(saltHex, "hex"),
      iterations,
      KEY_LENGTH_BYTES,
      "sha256",
      (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      }
    );
  });
}

/**
 * Computes a key verifier hash to validate if the master password is correct without storing it.
 */
export function computeKeyVerifier(masterKey: Buffer): string {
  return crypto.createHmac("sha256", masterKey).update("VAULT_KEY_VERIFIER_STRING").digest("hex");
}

/**
 * Encrypts arbitrary secret data using AES-256-GCM.
 */
export async function encryptSecret(
  data: DecryptedSecretPayload,
  masterKey: Buffer
): Promise<EncryptedPayload> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);

  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypts AES-256-GCM encrypted payload back into plaintext secret object.
 */
export async function decryptSecret(
  payload: EncryptedPayload,
  masterKey: Buffer
): Promise<DecryptedSecretPayload> {
  try {
    const iv = Buffer.from(payload.iv, "base64");
    const authTag = Buffer.from(payload.authTag, "base64");
    const ciphertext = Buffer.from(payload.ciphertext, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch (error) {
    throw new Error("Decryption failed. Invalid master password or corrupted ciphertext payload.");
  }
}
