import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import {
  HROnboardingService,
  OnboardingError,
} from "@/modules/hr-onboarding/service";
import { sendEmployeeOnboardingEmail } from "@/core/mail";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getWorkforceActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const updated = await HROnboardingService.resendInvitation(
      auth.ctx.restaurantId,
      id,
      { userId: auth.ctx.userId, userEmail: auth.ctx.userEmail },
      auth.ctx.accessibleOutletIds
    );

    const sessionDetail = await HROnboardingService.getSessionById(
      auth.ctx.restaurantId,
      id,
      auth.ctx.accessibleOutletIds
    );

    const employee = sessionDetail.employee;
    let emailSent = false;

    if (employee?.personalEmail) {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: auth.ctx.restaurantId },
        include: { branding: true },
      });

      const emailResult = await sendEmployeeOnboardingEmail({
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        employeeCode: employee.employeeCode,
        personalEmail: employee.personalEmail,
        restaurantName: restaurant?.name || "Our Restaurant",
        department: sessionDetail.intendedDepartment?.name,
        designation: sessionDetail.intendedDesignation?.name,
        accessToken: updated.accessToken,
        branding: restaurant?.branding,
      }).catch(() => ({ success: false }));

      emailSent = emailResult?.success ?? false;
    }

    return NextResponse.json({
      success: true,
      onboarding: updated,
      emailSent,
      message: employee?.personalEmail
        ? `Invitation refreshed${emailSent ? ` and sent to ${employee.personalEmail}` : ""}`
        : "Invitation link refreshed (no personal email on file)",
    });
  } catch (error: any) {
    if (error instanceof OnboardingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Send Onboarding Email Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
