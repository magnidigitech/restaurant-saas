import { NextRequest, NextResponse } from "next/server";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import {
  HROnboardingService,
  OnboardingError,
} from "@/modules/hr-onboarding/service";

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

    const body = await req.json().catch(() => ({}));
    const updated = await HROnboardingService.revokeInvitation(
      auth.ctx.restaurantId,
      id,
      { userId: auth.ctx.userId, userEmail: auth.ctx.userEmail },
      body.reason,
      auth.ctx.accessibleOutletIds
    );

    return NextResponse.json({ success: true, onboarding: updated });
  } catch (error: any) {
    if (error instanceof OnboardingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
  }
}
