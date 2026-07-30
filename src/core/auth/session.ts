import { cookies } from "next/headers";
import { signToken, verifyToken, SessionPayload } from "./jwt";

export const PLATFORM_SESSION_COOKIE = "platform_admin_session";
export const TENANT_SESSION_COOKIE = "tenant_session";

export async function setPlatformSession(payload: SessionPayload) {
  const token = await signToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(PLATFORM_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export async function getPlatformSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(PLATFORM_SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch (e) {
    // Falls back if called outside Request/Server context
    return null;
  }
}

export async function clearPlatformSession() {
  const cookieStore = await cookies();
  cookieStore.delete(PLATFORM_SESSION_COOKIE);
}

export async function setTenantSession(payload: SessionPayload) {
  const token = await signToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(TENANT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });
}

export async function getTenantSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TENANT_SESSION_COOKIE)?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch (e) {
    return null;
  }
}

export async function clearTenantSession() {
  const cookieStore = await cookies();
  cookieStore.delete(TENANT_SESSION_COOKIE);
}

// Request parsing helper (for Middleware or standalone tests)
export async function getSessionFromToken(token: string): Promise<SessionPayload | null> {
  return await verifyToken(token);
}
