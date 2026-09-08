import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/core/database/client";
import { ensureTwoFactorTables } from "@/core/database/ensure-tables";
import { parseDeviceName } from "./trusted-devices";

export const USER_SESSION_ID_COOKIE = "resto_session_id";

export function hashSessionId(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex");
}

/**
 * Tracks or updates a user session upon login or activity.
 */
export async function trackUserSession(
  userId: string,
  organizationId: string,
  reqHeaders?: Headers
): Promise<string> {
  await ensureTwoFactorTables();

  const cookieStore = await cookies();
  const existingSessionToken = cookieStore.get(USER_SESSION_ID_COOKIE)?.value;

  const ipAddress = reqHeaders?.get("x-forwarded-for") || reqHeaders?.get("x-real-ip") || null;
  const userAgent = reqHeaders?.get("user-agent") || "";
  const deviceName = parseDeviceName(userAgent);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hrs

  if (existingSessionToken) {
    const tokenHash = hashSessionId(existingSessionToken);
    const existing = await prisma.userSession.findUnique({
      where: { tokenHash },
    });

    if (existing && !existing.revokedAt && existing.userId === userId) {
      await prisma.userSession.update({
        where: { id: existing.id },
        data: {
          lastActiveAt: new Date(),
          ipAddress: ipAddress || existing.ipAddress,
          userAgent: userAgent || existing.userAgent,
          deviceName: deviceName || existing.deviceName,
        },
      });
      return existingSessionToken;
    }
  }

  // Create new session
  const rawSessionId = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionId(rawSessionId);

  await prisma.userSession.create({
    data: {
      userId,
      organizationId,
      tokenHash,
      ipAddress,
      userAgent,
      deviceName,
      expiresAt,
    },
  });

  cookieStore.set(USER_SESSION_ID_COOKIE, rawSessionId, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 24 * 60 * 60,
  });

  return rawSessionId;
}

/**
 * Lists all active (non-revoked) sessions for the given user, indicating which one is current.
 */
export async function listUserSessions(userId: string) {
  await ensureTwoFactorTables();
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(USER_SESSION_ID_COOKIE)?.value;
  const currentTokenHash = currentToken ? hashSessionId(currentToken) : null;

  const sessions = await prisma.userSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActiveAt: "desc" },
  });

  return sessions.map((s) => ({
    id: s.id,
    deviceName: s.deviceName || "Unknown Device",
    ipAddress: s.ipAddress || "Unknown IP",
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
    isCurrent: s.tokenHash === currentTokenHash,
  }));
}

/**
 * Revoke a single session by ID
 */
export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  await ensureTwoFactorTables();
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.userId !== userId) return false;

  await prisma.userSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });

  return true;
}

/**
 * Revoke all sessions for a user EXCEPT the current active session.
 */
export async function revokeAllOtherSessions(userId: string): Promise<number> {
  await ensureTwoFactorTables();
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(USER_SESSION_ID_COOKIE)?.value;
  const currentTokenHash = currentToken ? hashSessionId(currentToken) : null;

  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      tokenHash: { not: currentTokenHash || "" },
    },
    data: { revokedAt: new Date() },
  });

  return result.count;
}
