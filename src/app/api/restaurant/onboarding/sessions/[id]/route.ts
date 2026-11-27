import { NextRequest, NextResponse } from "next/server";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import {
  HROnboardingService,
  OnboardingError,
} from "@/modules/hr-onboarding/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getWorkforceActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const onboarding = await HROnboardingService.getSessionById(
      auth.ctx.restaurantId,
      id,
      auth.ctx.accessibleOutletIds
    );
    return NextResponse.json({ onboarding });
  } catch (error: any) {
    if (error instanceof OnboardingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: error.message || "Not found" },
      { status: 404 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getWorkforceActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await HROnboardingService.getSessionById(
      auth.ctx.restaurantId,
      id,
      auth.ctx.accessibleOutletIds
    );
    await HROnboardingService.deleteSession(auth.ctx.restaurantId, id);
    return NextResponse.json({
      success: true,
      message: "Onboarding session deleted successfully",
    });
  } catch (error: any) {
    if (error instanceof OnboardingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to delete onboarding session" },
      { status: 500 }
    );
  }
}
