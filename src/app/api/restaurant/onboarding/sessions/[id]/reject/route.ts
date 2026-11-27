import { NextRequest, NextResponse } from "next/server";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import {
  HROnboardingService,
  OnboardingError,
} from "@/modules/hr-onboarding/service";
import { z } from "zod";

const rejectSchema = z.object({
  reviewNotes: z.string().min(1, "Please provide a candidate-facing note"),
  taskCorrections: z
    .array(
      z.object({
        taskId: z.string().min(1),
        note: z.string().min(1),
      })
    )
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
        { error: "Missing onboarding review permission" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = rejectSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Please provide a candidate-facing note" },
        { status: 400 }
      );
    }

    const onboarding = await HROnboardingService.requestCorrections(
      auth.ctx.restaurantId,
      id,
      { userId: auth.ctx.userId, userEmail: auth.ctx.userEmail },
      {
        reviewNotes: result.data.reviewNotes,
        taskCorrections: result.data.taskCorrections,
      },
      auth.ctx.accessibleOutletIds
    );
    return NextResponse.json({ success: true, onboarding });
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
