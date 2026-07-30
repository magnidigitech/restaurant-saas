import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auditLogs = await prisma.auditLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // retrieve latest 100 entries
    });

    return NextResponse.json({ auditLogs });
  } catch (error: any) {
    console.error("List Audit Logs Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
