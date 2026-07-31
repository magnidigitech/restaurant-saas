import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const permissions = await prisma.permission.findMany({
      include: { module: true },
      orderBy: { id: "asc" },
    });

    return NextResponse.json({ permissions });
  } catch (error: any) {
    console.error("List Permissions Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
