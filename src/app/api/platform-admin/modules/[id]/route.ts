import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";
import { logAudit } from "@/core/audit/logger";
import { z } from "zod";

const updateModuleSchema = z.object({
  priceMonthly: z.coerce.number().min(0),
  status: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized platform admin session" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const result = updateModuleSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.module.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    const updated = await prisma.module.update({
      where: { id },
      data: {
        priceMonthly: result.data.priceMonthly,
        ...(result.data.status && { status: result.data.status }),
      },
    });

    const serializedModule = {
      ...updated,
      priceMonthly: Number(updated.priceMonthly),
    };

    const serializedExisting = {
      ...existing,
      priceMonthly: Number(existing.priceMonthly),
    };

    await logAudit({
      userId: session.userId,
      userEmail: session.email,
      action: "MODULE_PRICING_UPDATED",
      entityType: "Module",
      entityId: id,
      previousValues: serializedExisting,
      newValues: serializedModule,
    });

    return NextResponse.json({ success: true, module: serializedModule });
  } catch (error: any) {
    console.error("Update Module Pricing Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
