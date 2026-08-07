import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { HROnboardingService } from "@/modules/hr-onboarding/service";
import { z } from "zod";

const approveSchema = z.object({ reviewNotes: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "hr_onboarding", permissionKey: "hr:approve_onboarding" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json().catch(() => ({}));
    const result = approveSchema.safeParse(body);
    const reviewNotes = result.success ? result.data.reviewNotes : undefined;

    const onboarding = await HROnboardingService.approveOnboarding(session.activeRestaurantId, id, session.userId, reviewNotes);
    return NextResponse.json({ success: true, onboarding });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
