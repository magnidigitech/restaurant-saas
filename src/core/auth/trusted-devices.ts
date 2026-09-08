import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/core/database/client";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";

export const TRUSTED_DEVICE_COOKIE = "resto_trusted_device";

export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function parseDeviceName(userAgent: string): string {
  if (!userAgent) return "Unknown Device";
  let os = "Device";
  if (userAgent.includes("Mac OS") || userAgent.includes("Macintosh")) os = "MacBook / macOS";
  else if (userAgent.includes("Windows")) os = "Windows PC";
  else if (userAgent.includes("iPhone")) os = "iPhone";
  else if (userAgent.includes("iPad")) os = "iPad";
  else if (userAgent.includes("Android")) os = "Android Device";
  else if (userAgent.includes("Linux")) os = "Linux";

  let browser = "Browser";
  if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) browser = "Chrome";
  else if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) browser = "Safari";
  else if (userAgent.includes("Firefox")) browser = "Firefox";
  else if (userAgent.includes("Edg")) browser = "Edge";

  return `${os} · ${browser}`;
}

/**
 * Creates a trusted device record in PostgreSQL and issues a secure HTTP-only cookie.
 */
export async function createTrustedDevice(
  userId: string,
  organizationId: string,
  reqHeaders?: Headers,
  days: number = 30
): Promise<{ deviceId: string; expiresAt: Date }> {
  await ensureTwoFactorTables();

  // Generate 32-byte opaque token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashDeviceToken(rawToken);

  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const ipAddress = reqHeaders?.get("x-forwarded-for") || reqHeaders?.get("x-real-ip") || null;
  const userAgent = reqHeaders?.get("user-agent") || "";
  const deviceName = parseDeviceName(userAgent);

  const device = await prisma.trustedDevice.create({
    data: {
      userId,
      organizationId,
      deviceName,
      tokenHash,
      ipAddress,
      expiresAt,
      lastUsedAt: new Date(),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(TRUSTED_DEVICE_COOKIE, rawToken, {
    httpOnly: true,
    secure: false, // matches local dev/proxy
    sameSite: "lax",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });

  return { deviceId: device.id, expiresAt };
}

/**
 * Validates whether the incoming request carries a valid trusted device cookie for the given user and restaurant.
 */
export async function isCurrentDeviceTrusted(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    await ensureTwoFactorTables();
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value;
    if (!rawToken) return false;

    const tokenHash = hashDeviceToken(rawToken);

    const device = await prisma.trustedDevice.findUnique({
      where: { tokenHash },
    });

    if (!device) return false;

    // Must match user and org, not be revoked, and not be expired
    if (device.userId !== userId || device.organizationId !== organizationId) return false;
    if (device.revokedAt !== null) return false;
    if (new Date(device.expiresAt) < new Date()) return false;

    // Update last used timestamp
    await prisma.trustedDevice.update({
      where: { id: device.id },
      data: { lastUsedAt: new Date() },
    });

    return true;
  } catch (err) {
    console.warn("Error checking trusted device:", err);
    return false;
  }
}

/**
 * Revokes a specific trusted device by ID.
 */
export async function revokeTrustedDevice(deviceId: string, userId: string): Promise<boolean> {
  await ensureTwoFactorTables();
  const device = await prisma.trustedDevice.findUnique({
    where: { id: deviceId },
  });

  if (!device || device.userId !== userId) {
    return false;
  }

  await prisma.trustedDevice.update({
    where: { id: deviceId },
    data: { revokedAt: new Date() },
  });

  return true;
}

/**
 * Clears the trusted device cookie from the client.
 */
export async function clearTrustedDeviceCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(TRUSTED_DEVICE_COOKIE);
}
