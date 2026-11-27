import { NextRequest, NextResponse } from "next/server";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import {
  HROnboardingService,
  OnboardingError,
} from "@/modules/hr-onboarding/service";
import { z } from "zod";

const approveSchema = z.object({
  reviewNotes: z.string().optional(),
  existingEmployeeResolution: z
    .enum(["USE_EXISTING", "KEEP_SEPARATE"])
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getWorkforceActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (!auth.ctx.canViewSensitive && !auth.ctx.isAdmin) {
      return NextResponse.json(
        { error: "Missing onboarding approval permission" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const result = approveSchema.safeParse(body);
    const data = result.success ? result.data : {};

    const outcome = await HROnboardingService.approveOnboarding(
      auth.ctx.restaurantId,
      id,
      { userId: auth.ctx.userId, userEmail: auth.ctx.userEmail },
      {
        reviewNotes: data.reviewNotes,
        existingEmployeeResolution: data.existingEmployeeResolution,
        accessibleOutletIds: auth.ctx.accessibleOutletIds,
      }
    );

    return NextResponse.json({
      success: true,
      onboarding: outcome.onboarding,
      employeeId: outcome.employeeId,
      alreadyApproved: outcome.alreadyApproved,
    });
  } catch (error: any) {
    if (error instanceof OnboardingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
  }
}
