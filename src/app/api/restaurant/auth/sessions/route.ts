import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { listUserSessions, revokeSession, revokeAllOtherSessions } from "@/core/auth/sessions";
import { logSecurityAudit } from "@/core/auth/security-audit";

export async function GET() {
  try {
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await listUserSessions(session.userId);
    return NextResponse.json({ sessions });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to list sessions" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const success = await revokeSession(id, session.userId);
    if (!success) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await logSecurityAudit({
      organizationId: session.activeRestaurantId,
      userId: session.userId,
      userEmail: session.email,
      event: "SESSION_REVOKED",
      reqHeaders: req.headers,
      metadata: { sessionId: id },
    });

    return NextResponse.json({ success: true, message: "Session signed out" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const revokedCount = await revokeAllOtherSessions(session.userId);

    await logSecurityAudit({
      organizationId: session.activeRestaurantId,
      userId: session.userId,
      userEmail: session.email,
      event: "ALL_SESSIONS_REVOKED",
      reqHeaders: req.headers,
      metadata: { revokedCount },
    });

    return NextResponse.json({
      success: true,
      message: `Signed out of ${revokedCount} other active session(s)`,
      revokedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to sign out other sessions" }, { status: 500 });
  }
}
