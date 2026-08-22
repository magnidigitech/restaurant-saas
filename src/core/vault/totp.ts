import crypto from "crypto";

/**
 * Decodes a base32 string into a Buffer.
 */
function base32Decode(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates an RFC 6238 compliant 6-digit Time-Based One-Time Password (TOTP).
 */
export function generateTOTP(secretBase32: string, timeStepSeconds = 30, digits = 6): { code: string; secondsRemaining: number } {
  if (!secretBase32 || secretBase32.trim().length === 0) {
    return { code: "", secondsRemaining: 0 };
  }

  try {
    const key = base32Decode(secretBase32);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / timeStepSeconds);
    const secondsRemaining = timeStepSeconds - (epoch % timeStepSeconds);

    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter), 0);

    const hmac = crypto.createHmac("sha1", key);
    hmac.update(buffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0xf;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const otp = (binary % Math.pow(10, digits)).toString().padStart(digits, "0");

    return { code: otp, secondsRemaining };
  } catch (error) {
    return { code: "ERROR", secondsRemaining: 0 };
  }
}
