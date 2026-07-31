import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";

// GET /api/platform-admin/modules - List all system modules with pricing
export async function GET(req: NextRequest) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized platform admin session" }, { status: 401 });
    }

    const modules = await prisma.module.findMany({
      orderBy: { sortOrder: "asc" },
    });

    const serialized = modules.map((m) => ({
      ...m,
      priceMonthly: Number(m.priceMonthly),
    }));

    return NextResponse.json({ modules: serialized });
  } catch (error: any) {
    console.error("List Platform Modules Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
