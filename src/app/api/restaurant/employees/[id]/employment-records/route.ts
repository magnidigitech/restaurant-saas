import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createEmploymentRecordSchema = z.object({
  departmentId: z.string().optional(),
  designationId: z.string().optional(),
  primaryOutletId: z.string().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "CONSULTANT", "TEMPORARY"]).optional(),
  effectiveFrom: z.string().optional(),
  probationEndDate: z.string().optional(),
  confirmationDate: z.string().optional(),
  noticePeriod: z.number().optional(),
  reportingManagerEmployeeId: z.string().optional(),
  status: z.enum(["ACTIVE", "PROBATION", "ON_LEAVE", "NOTICE", "SUSPENDED", "TERMINATED", "RESIGNED"]).default("ACTIVE"),
  notes: z.string().optional(),
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

    const { id } = await params;
    const records = await prisma.employmentRecord.findMany({
      where: { employeeId: id, restaurantId: session.activeRestaurantId },
      include: {
        department: true,
        designation: true,
        primaryOutlet: true,
        reportingManager: true,
      },
      orderBy: { effectiveFrom: "desc" },
    });

    return NextResponse.json({ records });
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

    const restaurantId = session.activeRestaurantId!;

    const accessCheck = await verifyAccess(
      session.userId,
      restaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { id: employeeId } = await params;
    const body = await req.json();
    const result = createEmploymentRecordSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    // Verify employee belongs to tenant
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, restaurantId },
    });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found or access denied" }, { status: 404 });
    }

    const record = await prisma.$transaction(async (tx) => {
      // Deactivate previous active records
      await tx.employmentRecord.updateMany({
        where: { employeeId, restaurantId, status: "ACTIVE" },
        data: { status: "SUSPENDED", effectiveTo: new Date() },
      });

      return tx.employmentRecord.create({
        data: {
          restaurantId,
          employeeId,
          departmentId: data.departmentId || null,
          designationId: data.designationId || null,
          primaryOutletId: data.primaryOutletId || null,
          employmentType: data.employmentType || employee.workerType,
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
          probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null,
          confirmationDate: data.confirmationDate ? new Date(data.confirmationDate) : null,
          noticePeriod: data.noticePeriod || null,
          reportingManagerEmployeeId: data.reportingManagerEmployeeId || null,
          status: data.status,
          notes: data.notes || null,
        },
      });
    });

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error("Create Employment Record Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
