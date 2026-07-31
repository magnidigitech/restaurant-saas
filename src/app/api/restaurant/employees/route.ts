import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  personalEmail: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  joiningDate: z.string().optional(),
  workerType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "CONSULTANT", "TEMPORARY"]).default("FULL_TIME"),
  // Optional initial employment record details
  departmentId: z.string().optional(),
  designationId: z.string().optional(),
  primaryOutletId: z.string().optional(),
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
    const search = searchParams.get("search") || "";
    const departmentId = searchParams.get("departmentId");
    const outletId = searchParams.get("outletId");
    const includeArchived = searchParams.get("includeArchived") === "true";

    const employees = await prisma.employee.findMany({
      where: {
        restaurantId: session.activeRestaurantId,
        ...(!includeArchived && { archivedAt: null }),
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { employeeCode: { contains: search, mode: "insensitive" } },
            { personalEmail: { contains: search, mode: "insensitive" } },
          ],
        }),
        ...(departmentId && {
          employmentRecords: {
            some: { departmentId, status: "ACTIVE" },
          },
        }),
        ...(outletId && {
          outletAssignments: {
            some: { outletId },
          },
        }),
      },
      include: {
        employmentRecords: {
          where: { status: "ACTIVE" },
          include: {
            department: true,
            designation: true,
            primaryOutlet: true,
          },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
        outletAssignments: {
          include: { outlet: true },
        },
        memberships: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ employees });
  } catch (error: any) {
    console.error("List Employees Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const result = createEmployeeSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    const newEmployee = await prisma.$transaction(async (tx) => {
      // 1. Enforce maxEmployees subscription limit
      const sub = await tx.restaurantSubscription.findFirst({
        where: { restaurantId, status: "ACTIVE" },
        include: { plan: true },
        orderBy: { startDate: "desc" },
      });

      const maxEmployees = sub?.plan.maxEmployees ?? 30;

      const currentEmployeeCount = await tx.employee.count({
        where: { restaurantId, archivedAt: null },
      });

      if (currentEmployeeCount >= maxEmployees) {
        throw new Error(`Employee limit reached (${maxEmployees}). Upgrade subscription plan to onboard more employees.`);
      }

      // 2. Auto-generate employee code (EMP-00001 format per restaurant)
      const countTotal = await tx.employee.count({
        where: { restaurantId },
      });

      let nextNumber = countTotal + 1;
      let employeeCode = `EMP-${String(nextNumber).padStart(5, "0")}`;

      // Handle rare race conditions/collisions
      let existingCode = await tx.employee.findUnique({
        where: { restaurantId_employeeCode: { restaurantId, employeeCode } },
      });
      while (existingCode) {
        nextNumber++;
        employeeCode = `EMP-${String(nextNumber).padStart(5, "0")}`;
        existingCode = await tx.employee.findUnique({
          where: { restaurantId_employeeCode: { restaurantId, employeeCode } },
        });
      }

      // 3. Create Employee (NO USER OR LOGIN CREATED HERE)
      const employee = await tx.employee.create({
        data: {
          restaurantId,
          employeeCode,
          firstName: data.firstName,
          lastName: data.lastName,
          personalEmail: data.personalEmail || null,
          phone: data.phone || null,
          alternatePhone: data.alternatePhone || null,
          gender: data.gender || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
          workerType: data.workerType,
        },
      });

      // 4. Create initial active EmploymentRecord if details provided
      if (data.departmentId || data.designationId || data.primaryOutletId) {
        await tx.employmentRecord.create({
          data: {
            restaurantId,
            employeeId: employee.id,
            departmentId: data.departmentId || null,
            designationId: data.designationId || null,
            primaryOutletId: data.primaryOutletId || null,
            employmentType: data.workerType,
            effectiveFrom: employee.joiningDate,
            status: "ACTIVE",
          },
        });
      }

      // 5. Create initial primary EmployeeOutletAssignment if outlet specified
      if (data.primaryOutletId) {
        await tx.employeeOutletAssignment.create({
          data: {
            restaurantId,
            employeeId: employee.id,
            outletId: data.primaryOutletId,
            isPrimary: true,
            assignmentType: "PRIMARY",
            effectiveFrom: employee.joiningDate,
          },
        });
      }

      // 6. Audit Log
      await tx.auditLog.create({
        data: {
          restaurantId,
          userId: session.userId,
          userEmail: session.email,
          action: "EMPLOYEE_CREATED",
          entityType: "Employee",
          entityId: employee.id,
          newValues: JSON.stringify({
            employeeCode,
            name: `${employee.firstName} ${employee.lastName}`,
            email: employee.personalEmail,
          }),
        },
      });

      return employee;
    });

    return NextResponse.json({ success: true, employee: newEmployee });
  } catch (error: any) {
    console.error("Create Employee Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
