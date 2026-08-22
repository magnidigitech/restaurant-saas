import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createLeaveSchema = z.object({
  employeeId: z.string().min(1),
  leaveType: z.enum(["CASUAL", "SICK", "ANNUAL", "UNPAID", "MATERNITY_PATERNITY"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  totalDays: z.number().min(0.5).default(1),
  reason: z.string().min(1),
});

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const employeeId = searchParams.get("employeeId");

    const whereClause: any = {
      restaurantId: session.activeRestaurantId,
    };
    if (status) whereClause.status = status;
    if (employeeId) whereClause.employeeId = employeeId;

    const leaves = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, leaves });
  } catch (error: any) {
    console.error("List Leaves Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

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
    const result = createLeaveSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid leave payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;

    const leave = await prisma.leaveRequest.create({
      data: {
        restaurantId: session.activeRestaurantId,
        employeeId: data.employeeId,
        leaveType: data.leaveType,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        totalDays: data.totalDays,
        reason: data.reason,
        status: "PENDING",
      },
      include: {
        employee: true,
      },
    });

    return NextResponse.json({ success: true, leave }, { status: 201 });
  } catch (error: any) {
    console.error("Create Leave Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
