import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createAssignmentSchema = z.object({
  outletId: z.string().min(1),
  isPrimary: z.boolean().default(false),
  assignmentType: z.enum(["PRIMARY", "TEMPORARY", "TRAINING"]).default("PRIMARY"),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const { id: employeeId } = await params;
    const assignments = await prisma.employeeOutletAssignment.findMany({
      where: { employeeId, restaurantId: session.activeRestaurantId },
      include: { outlet: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ assignments });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: employeeId } = await params;
    const body = await req.json();
    const result = createAssignmentSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    // Verify outlet belongs to restaurant
    const outlet = await prisma.restaurantOutlet.findFirst({
      where: { id: data.outletId, restaurantId: session.activeRestaurantId },
    });
    if (!outlet) {
      return NextResponse.json({ error: "Outlet not found or access denied" }, { status: 404 });
    }

    const assignment = await prisma.employeeOutletAssignment.upsert({
      where: {
        employeeId_outletId: { employeeId, outletId: data.outletId },
      },
      create: {
        restaurantId: session.activeRestaurantId,
        employeeId,
        outletId: data.outletId,
        isPrimary: data.isPrimary,
        assignmentType: data.assignmentType,
      },
      update: {
        isPrimary: data.isPrimary,
        assignmentType: data.assignmentType,
      },
      include: { outlet: true },
    });

    return NextResponse.json({ success: true, assignment });
  } catch (error: any) {
    console.error("Create Outlet Assignment Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
