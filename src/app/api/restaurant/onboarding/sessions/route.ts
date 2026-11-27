import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { EmploymentStatus, WorkerType } from "@prisma/client";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import {
  HROnboardingService,
  OnboardingError,
} from "@/modules/hr-onboarding/service";
import { sendEmployeeOnboardingEmail } from "@/core/mail";
import { z } from "zod";

const startSchema = z.object({
  employeeId: z.string().optional(),
  candidate: z
    .object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      personalEmail: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
    })
    .optional(),
  templateId: z.string().min(1),
  intendedOutletId: z.string().optional().nullable(),
  intendedDepartmentId: z.string().optional().nullable(),
  intendedDesignationId: z.string().optional().nullable(),
  intendedStartDate: z.string().optional().nullable(),
  intendedEmploymentStatus: z.nativeEnum(EmploymentStatus).optional(),
  intendedWorkerType: z.nativeEnum(WorkerType).optional(),
  provisionAppAccess: z.boolean().optional(),
  appRoleId: z.string().optional().nullable(),
  expiresInDays: z.number().int().min(1).max(60).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;

    const auth = await getWorkforceActorContext({ outletId });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const status = searchParams.get("status") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;
    const search = searchParams.get("search") || undefined;

    const sessions = await HROnboardingService.getSessions(
      auth.ctx.restaurantId,
      { status, employeeId, outletId, search },
      auth.ctx.accessibleOutletIds
    );
    return NextResponse.json({ sessions });
  } catch (error: any) {
    if (error instanceof OnboardingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("GET Sessions Error:", error);
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

    const body = await req.json();
    const result = startSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;
    if (
      data.intendedOutletId &&
      auth.ctx.accessibleOutletIds !== null &&
      !auth.ctx.accessibleOutletIds.includes(data.intendedOutletId)
    ) {
      return NextResponse.json(
        { error: "Intended outlet is outside your authorized scope" },
        { status: 403 }
      );
    }

    const onboarding = await HROnboardingService.startOnboarding(
      auth.ctx.restaurantId,
      {
        employeeId: data.employeeId,
        candidate: data.candidate,
        templateId: data.templateId,
        intendedOutletId: data.intendedOutletId,
        intendedDepartmentId: data.intendedDepartmentId,
        intendedDesignationId: data.intendedDesignationId,
        intendedStartDate: data.intendedStartDate
          ? new Date(data.intendedStartDate)
          : null,
        intendedEmploymentStatus: data.intendedEmploymentStatus,
        intendedWorkerType: data.intendedWorkerType,
        provisionAppAccess: data.provisionAppAccess,
        appRoleId: data.appRoleId,
        expiresInDays: data.expiresInDays,
        actor: {
          userId: auth.ctx.userId,
          userEmail: auth.ctx.userEmail,
        },
      }
    );

    const employee = await prisma.employee.findUnique({
      where: { id: onboarding.employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        personalEmail: true,
      },
    });

    const [restaurant, dept, desig] = await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: auth.ctx.restaurantId },
        include: { branding: true },
      }),
      onboarding.intendedDepartmentId
        ? prisma.department.findUnique({
            where: { id: onboarding.intendedDepartmentId },
            select: { name: true },
          })
        : null,
      onboarding.intendedDesignationId
        ? prisma.designation.findUnique({
            where: { id: onboarding.intendedDesignationId },
            select: { name: true },
          })
        : null,
    ]);

    let emailSent = false;
    if (employee?.personalEmail) {
      const emailResult = await sendEmployeeOnboardingEmail({
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        employeeCode: employee.employeeCode,
        personalEmail: employee.personalEmail,
        restaurantName: restaurant?.name || "Our Restaurant",
        department: dept?.name,
        designation: desig?.name,
        accessToken: onboarding.accessToken,
        branding: restaurant?.branding,
      }).catch(() => ({ success: false }));
      emailSent = emailResult?.success ?? false;
    }

    return NextResponse.json({
      success: true,
      onboarding,
      emailSent,
    });
  } catch (error: any) {
    if (error instanceof OnboardingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    console.error("POST Session Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
  }
}
