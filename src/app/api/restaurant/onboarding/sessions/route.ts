import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { HROnboardingService } from "@/modules/hr-onboarding/service";
import { sendEmployeeOnboardingEmail } from "@/core/mail";
import { z } from "zod";

const startSchema = z.object({
  employeeId: z.string().min(1),
  templateId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "hr_onboarding", permissionKey: "hr:view_employees" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const employeeId = searchParams.get("employeeId") || undefined;

    const sessions = await HROnboardingService.getSessions(session.activeRestaurantId, { status, employeeId });
    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error("GET Sessions Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "hr_onboarding", permissionKey: "hr:manage_onboarding" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = startSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const onboarding = await HROnboardingService.startOnboarding(
      session.activeRestaurantId,
      result.data.employeeId,
      result.data.templateId
    );

    // Trigger branded employee onboarding email
    const employee = await prisma.employee.findUnique({
      where: { id: result.data.employeeId },
      include: {
        employmentRecords: {
          where: { status: "ACTIVE" },
          include: { department: true, designation: true },
          take: 1,
        },
      },
    });

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: session.activeRestaurantId },
      include: { branding: true },
    });

    let emailSent = false;
    if (employee?.personalEmail) {
      const activeRecord = employee.employmentRecords[0];
      const emailResult = await sendEmployeeOnboardingEmail({
        employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
        employeeCode: employee.employeeCode,
        personalEmail: employee.personalEmail,
        restaurantName: restaurant?.name || "Our Restaurant",
        department: activeRecord?.department?.name,
        designation: activeRecord?.designation?.name,
        accessToken: onboarding.accessToken,
        branding: restaurant?.branding,
      }).catch((err) => {
        console.warn("Failed to dispatch onboarding email:", err);
        return { success: false };
      });
      emailSent = emailResult?.success ?? false;
    }

    return NextResponse.json({ success: true, onboarding, emailSent });
  } catch (error: any) {
    console.error("POST Session Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
