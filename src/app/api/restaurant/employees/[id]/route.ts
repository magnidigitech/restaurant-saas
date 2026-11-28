import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/core/database/client";
import { WorkerType } from "@prisma/client";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import {
  assertEmployeeInScope,
  getEmployeeProfile,
  sanitizeAuditPayload,
  WorkforceError,
} from "@/modules/workforce/service";

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  personalEmail: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  alternatePhone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  joiningDate: z.string().optional(),
  workerType: z.nativeEnum(WorkerType).optional(),
  weeklyHoursLimit: z.number().min(1).max(168).optional().nullable(),
  archived: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getWorkforceActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const employee = await getEmployeeProfile(auth.ctx, id);
    return NextResponse.json({ employee });
  } catch (error) {
    if (error instanceof WorkforceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get Employee Detail Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getWorkforceActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    await assertEmployeeInScope(auth.ctx, id, { includeArchived: true });

    const body = await req.json();
    const result = updateEmployeeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    const existing = await prisma.employee.findFirst({
      where: { id, restaurantId: auth.ctx.restaurantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        workerType: true,
        weeklyHoursLimit: true,
        archivedAt: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Employee not found or access denied" },
        { status: 404 }
      );
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.personalEmail !== undefined && {
          personalEmail: data.personalEmail || null,
        }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.alternatePhone !== undefined && {
          alternatePhone: data.alternatePhone,
        }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.dateOfBirth !== undefined && {
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        }),
        ...(data.joiningDate && { joiningDate: new Date(data.joiningDate) }),
        ...(data.workerType && { workerType: data.workerType }),
        ...(data.weeklyHoursLimit !== undefined && {
          weeklyHoursLimit: data.weeklyHoursLimit,
        }),
        ...(data.archived !== undefined && {
          archivedAt: data.archived ? new Date() : null,
        }),
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        phone: true,
        workerType: true,
        weeklyHoursLimit: true,
        archivedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        restaurantId: auth.ctx.restaurantId,
        userId: auth.ctx.userId,
        userEmail: auth.ctx.userEmail,
        action: data.archived ? "EMPLOYEE_ARCHIVED" : "EMPLOYEE_UPDATED",
        entityType: "Employee",
        entityId: id,
        previousValues: sanitizeAuditPayload(
          existing as unknown as Record<string, unknown>
        ),
        newValues: sanitizeAuditPayload(
          updated as unknown as Record<string, unknown>
        ),
      },
    });

    return NextResponse.json({ success: true, employee: updated });
  } catch (error) {
    if (error instanceof WorkforceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Update Employee Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
