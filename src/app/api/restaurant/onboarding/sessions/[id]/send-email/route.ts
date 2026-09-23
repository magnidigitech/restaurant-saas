import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { HROnboardingService } from "@/modules/hr-onboarding/service";
import { sendEmployeeOnboardingEmail } from "@/core/mail";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      { moduleKey: "hr_onboarding", permissionKey: "hr:manage_onboarding" },
      session.tokenVersion
    );
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const onboarding = await HROnboardingService.getSessionById(session.activeRestaurantId, id);
    if (!onboarding || !onboarding.employee) {
      return NextResponse.json({ error: "Onboarding session or employee not found" }, { status: 404 });
    }

    const employee = onboarding.employee;
    if (!employee.personalEmail) {
      return NextResponse.json({ error: "Employee does not have a personal email registered" }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: session.activeRestaurantId },
      include: { branding: true },
    });

    const activeRecord = await prisma.employmentRecord.findFirst({
      where: { employeeId: employee.id, status: "ACTIVE" },
      include: { department: true, designation: true },
    });

    const emailResult = await sendEmployeeOnboardingEmail({
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      employeeCode: employee.employeeCode,
      personalEmail: employee.personalEmail,
      restaurantName: restaurant?.name || "Our Restaurant",
      department: activeRecord?.department?.name,
      designation: activeRecord?.designation?.name,
      accessToken: onboarding.accessToken,
      branding: restaurant?.branding,
    });

    if (!emailResult?.success) {
      return NextResponse.json({ error: "Failed to dispatch onboarding email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Email successfully sent to ${employee.personalEmail}` });
  } catch (error: any) {
    console.error("Send Onboarding Email Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
