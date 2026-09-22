import crypto from "crypto";
import { sendMail } from "@/core/mail/mailer";

interface StoredEmailCode {
  code: string;
  recipientEmail: string;
  expiresAt: number;
  used: boolean;
}

// In-memory store for 2FA email codes (key -> StoredEmailCode)
const emailCodeStore = new Map<string, StoredEmailCode>();

/**
 * Returns the destination email address for 2FA emails.
 * For Platform Admin (/platform-admin), ALWAYS send to getrestobird@gmail.com.
 * For Tenant users, send to their registered email.
 */
export function getDestinationEmail(userEmail: string, isPlatformAdmin = false): string {
  if (isPlatformAdmin) {
    return "getrestobird@gmail.com";
  }
  const normalized = userEmail.trim().toLowerCase();
  if (normalized === "admin@restobird.com" || normalized === "admin@platform.com") {
    return "getrestobird@gmail.com";
  }
  return userEmail;
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP code.
 */
export function generateNumericOtp(): string {
  const num = crypto.randomInt(100000, 999999);
  return num.toString();
}

/**
 * Stores a 2FA email code for a given key (valid for 10 minutes by default).
 */
export function storeEmailCode(key: string, code: string, recipientEmail: string, ttlMs = 10 * 60 * 1000) {
  // Clean up expired entries periodically
  const now = Date.now();
  for (const [k, v] of emailCodeStore.entries()) {
    if (now > v.expiresAt || v.used) {
      emailCodeStore.delete(k);
    }
  }

  emailCodeStore.set(key, {
    code,
    recipientEmail,
    expiresAt: now + ttlMs,
    used: false,
  });
}

/**
 * Verifies and IMMEDIATELY consumes (deletes/invalidates) a 2FA email code.
 * Ensures the code is ONE-TIME USE ONLY.
 */
export function verifyAndConsumeEmailCode(key: string, inputCode: string): { valid: boolean; error?: string } {
  const record = emailCodeStore.get(key);
  if (!record) {
    return { valid: false, error: "No verification code was requested or code has expired." };
  }

  if (record.used) {
    emailCodeStore.delete(key);
    return { valid: false, error: "This verification code has already been used." };
  }

  if (Date.now() > record.expiresAt) {
    emailCodeStore.delete(key);
    return { valid: false, error: "Verification code has expired. Please request a new code." };
  }

  const cleanInput = inputCode.replace(/\D/g, "").trim();
  if (record.code !== cleanInput) {
    return { valid: false, error: "Invalid verification code. Please check your email and try again." };
  }

  // Code matches and is valid! IMMEDIATELY consume/delete code to prevent reuse
  emailCodeStore.delete(key);

  return { valid: true };
}

/**
 * Helper to send the 2FA Email Code via SMTP / Mailer.
 */
export async function send2FAEmailCode(
  userEmail: string,
  userName: string,
  key: string,
  isPlatformAdmin = false
): Promise<{ success: boolean; destinationEmail: string; error?: string }> {
  const destinationEmail = getDestinationEmail(userEmail, isPlatformAdmin);
  const otpCode = generateNumericOtp();

  // Save in store
  storeEmailCode(key, otpCode, destinationEmail);

  const subject = `Your Resto Bird 2FA Verification Code: ${otpCode}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background-color: #0B0E14; color: #FFFFFF; border-radius: 16px; border: 1px solid #1E2638;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="https://restobird.com/resto-bird-logo.png" alt="Resto Bird Logo" style="height: 40px; width: auto; margin-bottom: 12px;" />
        <h1 style="color: #FFFFFF; font-size: 20px; font-weight: 700; margin: 0;">Two-Factor Authentication Code</h1>
        <p style="color: #94A3B8; font-size: 13px; margin-top: 6px;">Resto Bird Platform Access Protection</p>
      </div>

      <div style="background-color: #121826; border-radius: 12px; padding: 20px; border: 1px solid #1E293B; text-align: center; margin-bottom: 24px;">
        <p style="color: #CBD5E1; font-size: 13px; margin-top: 0; margin-bottom: 12px;">Hello <strong>${userName || userEmail}</strong>,</p>
        <p style="color: #94A3B8; font-size: 12px; margin-bottom: 16px;">Use the following 6-digit one-time security code to complete your login:</p>
        
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #F59E0B; background-color: #090D15; padding: 16px 24px; border-radius: 8px; border: 1px solid #F59E0B40; display: inline-block;">
          ${otpCode}
        </div>

        <p style="color: #94A3B8; font-size: 11px; margin-top: 16px; margin-bottom: 0;">This code is valid for <strong>10 minutes</strong> and can only be used <strong>once</strong>.</p>
      </div>

      <div style="color: #64748B; font-size: 11px; text-align: center; border-top: 1px solid #1E293B; padding-top: 16px;">
        <p style="margin: 0;">If you did not request this login verification, please secure your account immediately.</p>
        <p style="margin: 4px 0 0 0;">Resto Bird Platform Security &bull; Confidential</p>
      </div>
    </div>
  `;

  const text = `Resto Bird 2FA Verification Code: ${otpCode}\nValid for 10 minutes (One-time use only).`;

  const result = await sendMail({
    to: destinationEmail,
    subject,
    html,
    text,
  });

  if (!result.success) {
    return { success: false, destinationEmail, error: result.error || "Failed to send email" };
  }

  return { success: true, destinationEmail };
}
