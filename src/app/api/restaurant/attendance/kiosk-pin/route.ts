import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getAttendanceActorContext } from "@/core/attendance/authHelper";
import { hashPin } from "@/core/attendance/punchService";
import { z } from "zod";

const setPinSchema = z.object({
  employeeId: z.string().min(1),
  kioskPin: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, "PIN must be a 4-digit number"),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAttendanceActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
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
    const emp = await prisma.employee.findFirst({
      where: {
        id: employeeId,
        restaurantId: auth.ctx.restaurantId,
        archivedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        outletAssignments: { select: { outletId: true } },
      },
    });

    if (!emp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (auth.ctx.accessibleOutletIds !== null) {
      const ok = emp.outletAssignments.some((a) =>
        auth.ctx.accessibleOutletIds!.includes(a.outletId)
      );
      if (!ok) {
        return NextResponse.json(
          { error: "Employee is outside your authorized outlet scope" },
          { status: 403 }
        );
      }
    }

    const hashed = hashPin(kioskPin);
    await prisma.employee.update({
      where: { id: emp.id },
      data: { kioskPin: hashed },
    });

    return NextResponse.json({
      success: true,
      message: `Kiosk PIN configured for ${emp.firstName}`,
      employee: {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        employeeCode: emp.employeeCode,
      },
    });
  } catch (error: any) {
    console.error("Set Kiosk PIN Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
