import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const result = statusSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const updated = await prisma.restaurant.update({
      where: { id },
      data: { status: result.data.status },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        restaurantId: id,
        userId: session.userId,
        userEmail: session.email,
        action: "TENANT_STATUS_CHANGED",
        entityType: "Restaurant",
        entityId: id,
        newValues: JSON.stringify({ status: result.data.status }),
      },
    });

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error: any) {
    console.error("Status Update Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
