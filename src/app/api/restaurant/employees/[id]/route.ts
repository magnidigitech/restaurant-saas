import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  personalEmail: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  alternatePhone: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  joiningDate: z.string().optional(),
  workerType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "CONSULTANT", "TEMPORARY"]).optional(),
  archived: z.boolean().optional(),
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

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { id } = await params;

    const employee = await prisma.employee.findFirst({
      where: { id, restaurantId: session.activeRestaurantId },
      include: {
        employmentRecords: {
          include: {
            department: true,
            designation: true,
            primaryOutlet: true,
            reportingManager: true,
          },
          orderBy: { effectiveFrom: "desc" },
        },
        outletAssignments: {
          include: { outlet: true },
        },
        emergencyContacts: true,
        documents: true,
        memberships: {
          include: { user: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({ employee });
  } catch (error: any) {
    console.error("Get Employee Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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

    const { id } = await params;
    const body = await req.json();
    const result = updateEmployeeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    const existing = await prisma.employee.findFirst({
      where: { id, restaurantId: session.activeRestaurantId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Employee not found or access denied" }, { status: 404 });
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.personalEmail !== undefined && { personalEmail: data.personalEmail }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.alternatePhone !== undefined && { alternatePhone: data.alternatePhone }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }),
        ...(data.joiningDate && { joiningDate: new Date(data.joiningDate) }),
        ...(data.workerType && { workerType: data.workerType }),
        ...(data.archived !== undefined && { archivedAt: data.archived ? new Date() : null }),
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId: session.activeRestaurantId,
        userId: session.userId,
        userEmail: session.email,
        action: data.archived ? "EMPLOYEE_ARCHIVED" : "EMPLOYEE_UPDATED",
        entityType: "Employee",
        entityId: id,
        previousValues: JSON.stringify(existing),
        newValues: JSON.stringify(updated),
      },
    });

    return NextResponse.json({ success: true, employee: updated });
  } catch (error: any) {
    console.error("Update Employee Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
