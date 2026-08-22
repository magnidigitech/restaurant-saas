import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { hashPin } from "@/core/attendance/punchService";
import { z } from "zod";

const setPinSchema = z.object({
  employeeId: z.string().min(1),
  kioskPin: z.string().length(4).regex(/^\d{4}$/, "PIN must be a 4-digit number"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = setPinSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid PIN payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { employeeId, kioskPin } = result.data;
    const hashed = hashPin(kioskPin);

    // Direct SQL update ensures bulletproof execution regardless of dev server memory caching
    await prisma.$executeRawUnsafe(
      `UPDATE employees SET kiosk_pin = $1, updated_at = NOW() WHERE id = $2 AND restaurant_id = $3`,
      hashed,
      employeeId,
      session.activeRestaurantId
    );

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Kiosk PIN configured for ${employee.firstName}`,
      employee,
    });
  } catch (error: any) {
    console.error("Set Kiosk PIN Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
