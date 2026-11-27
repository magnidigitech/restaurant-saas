import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/core/database/client";
import { EmploymentStatus, WorkerType } from "@prisma/client";
import { MasterDataService } from "@/modules/master-data/service";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import {
  listDirectoryEmployees,
  sanitizeAuditPayload,
  WorkforceError,
} from "@/modules/workforce/service";

const createEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  personalEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  joiningDate: z.string().optional(),
  workerType: z.nativeEnum(WorkerType).default("FULL_TIME"),
  weeklyHoursLimit: z.number().min(1).max(168).optional(),
  departmentId: z.string().optional(),
  departmentName: z.string().optional(),
  designationId: z.string().optional(),
  designationName: z.string().optional(),
  primaryOutletId: z.string().optional(),
  status: z.nativeEnum(EmploymentStatus).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const outletId = sp.get("outletId") || undefined;

    const auth = await getWorkforceActorContext({ outletId });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const departmentId = sp.get("departmentId") || undefined;
    const search = sp.get("search") || undefined;
    const workerTypeRaw = sp.get("workerType") || undefined;
    const statusRaw = sp.get("employmentStatus") || undefined;

    const workerType =
      workerTypeRaw && workerTypeRaw in WorkerType
        ? (workerTypeRaw as WorkerType)
        : undefined;
    const employmentStatus =
      statusRaw && statusRaw in EmploymentStatus
        ? (statusRaw as EmploymentStatus)
        : undefined;

    const employees = await listDirectoryEmployees(auth.ctx, {
      search,
      outletId,
      departmentId,
      workerType,
      employmentStatus,
    });

    return NextResponse.json({
      employees,
      permissions: {
        canManageWorkforce: auth.ctx.canManageWorkforce,
        canViewSensitive: auth.ctx.canViewSensitive,
      },
    });
  } catch (error) {
    if (error instanceof WorkforceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("List Employees Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getWorkforceActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { ctx } = auth;
    const body = await req.json();
    const result = createEmployeeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;

    if (
      data.primaryOutletId &&
      ctx.accessibleOutletIds !== null &&
      !ctx.accessibleOutletIds.includes(data.primaryOutletId)
    ) {
      return NextResponse.json(
        { error: "Primary outlet is outside your authorized scope" },
        { status: 403 }
      );
    }

    const newEmployee = await prisma.$transaction(async (tx) => {
      const sub = await tx.restaurantSubscription.findFirst({
        where: { restaurantId: ctx.restaurantId, status: "ACTIVE" },
        include: { plan: true },
        orderBy: { startDate: "desc" },
      });

      const maxEmployees = sub?.plan.maxEmployees ?? 30;
      const currentEmployeeCount = await tx.employee.count({
        where: { restaurantId: ctx.restaurantId, archivedAt: null },
      });

      if (currentEmployeeCount >= maxEmployees) {
        throw new WorkforceError(
          `Employee limit reached (${maxEmployees}). Upgrade subscription plan to onboard more employees.`,
          400
        );
      }

      const countTotal = await tx.employee.count({
        where: { restaurantId: ctx.restaurantId },
      });

      let nextNumber = countTotal + 1;
      let employeeCode = `EMP-${String(nextNumber).padStart(5, "0")}`;

      let existingCode = await tx.employee.findUnique({
        where: {
          restaurantId_employeeCode: {
            restaurantId: ctx.restaurantId,
            employeeCode,
          },
        },
      });
      while (existingCode) {
        nextNumber++;
        employeeCode = `EMP-${String(nextNumber).padStart(5, "0")}`;
        existingCode = await tx.employee.findUnique({
          where: {
            restaurantId_employeeCode: {
              restaurantId: ctx.restaurantId,
              employeeCode,
            },
          },
        });
      }

      const employee = await tx.employee.create({
        data: {
          restaurantId: ctx.restaurantId,
          employeeCode,
          firstName: data.firstName,
          lastName: data.lastName,
          personalEmail: data.personalEmail || null,
          phone: data.phone || null,
          alternatePhone: data.alternatePhone || null,
          gender: data.gender || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          joiningDate: data.joiningDate
            ? new Date(data.joiningDate)
            : new Date(),
          workerType: data.workerType,
          weeklyHoursLimit: data.weeklyHoursLimit || null,
        },
        select: {
          id: true,
          restaurantId: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          phone: true,
          joiningDate: true,
          workerType: true,
          weeklyHoursLimit: true,
          createdAt: true,
        },
      });

      let departmentId = data.departmentId || null;
      if (data.departmentName) {
        departmentId = await MasterDataService.findOrCreateDepartmentByName(
          ctx.restaurantId,
          data.departmentName
        );
      } else if (departmentId && !departmentId.includes("-")) {
        departmentId = await MasterDataService.findOrCreateDepartmentByName(
          ctx.restaurantId,
          departmentId
        );
      }

      let designationId = data.designationId || null;
      if (data.designationName) {
        designationId = await MasterDataService.findOrCreateDesignationByName(
          ctx.restaurantId,
          data.designationName
        );
      } else if (designationId && !designationId.includes("-")) {
        designationId = await MasterDataService.findOrCreateDesignationByName(
          ctx.restaurantId,
          designationId
        );
      }

      if (departmentId || designationId || data.primaryOutletId) {
        await tx.employmentRecord.create({
          data: {
            restaurantId: ctx.restaurantId,
            employeeId: employee.id,
            departmentId,
            designationId,
            primaryOutletId: data.primaryOutletId || null,
            employmentType: data.workerType,
            effectiveFrom: employee.joiningDate,
            status: data.status || "ACTIVE",
          },
        });
      }

      if (data.primaryOutletId) {
        await tx.employeeOutletAssignment.create({
          data: {
            restaurantId: ctx.restaurantId,
            employeeId: employee.id,
            outletId: data.primaryOutletId,
            isPrimary: true,
            assignmentType: "PRIMARY",
            effectiveFrom: employee.joiningDate,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          restaurantId: ctx.restaurantId,
          userId: ctx.userId,
          userEmail: ctx.userEmail,
          action: "EMPLOYEE_CREATED",
          entityType: "Employee",
          entityId: employee.id,
          newValues: sanitizeAuditPayload({
            employeeCode: employee.employeeCode,
            firstName: employee.firstName,
            lastName: employee.lastName,
            workerType: employee.workerType,
            primaryOutletId: data.primaryOutletId || null,
          }),
        },
      });

      return employee;
    });

    return NextResponse.json(
      { success: true, employee: newEmployee },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof WorkforceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Create Employee Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
