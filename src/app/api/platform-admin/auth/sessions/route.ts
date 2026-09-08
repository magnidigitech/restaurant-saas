import { NextRequest, NextResponse } from "next/server";
import { getPlatformSession } from "@/core/auth/session";
import { listPlatformSessions, revokePlatformSession, revokeAllOtherPlatformSessions } from "@/core/auth/sessions";

export async function GET() {
  try {
    const session = await getPlatformSession();
    if (!session?.userId || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await listPlatformSessions(session.userId);
    return NextResponse.json({ sessions });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to list platform sessions" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getPlatformSession();
    if (!session?.userId || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const success = await revokePlatformSession(id, session.userId);
    if (!success) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Session signed out" });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to revoke session" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getPlatformSession();
    if (!session?.userId || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const revokedCount = await revokeAllOtherPlatformSessions(session.userId);
    return NextResponse.json({
      success: true,
      message: `Signed out of ${revokedCount} other session(s)`,
      revokedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to sign out other sessions" }, { status: 500 });
  }
}
