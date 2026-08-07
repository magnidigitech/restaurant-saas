import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { HROnboardingService } from "@/modules/hr-onboarding/service";
import { z } from "zod";

const updateTaskSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(["PENDING", "COMPLETED", "WAIVED", "REJECTED"]),
  notes: z.string().nullish(),
  fileUploadId: z.string().nullish(),
  responseValue: z.string().nullish(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "hr_onboarding", permissionKey: "hr:view_employees" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const onboarding = await HROnboardingService.getSessionById(session.activeRestaurantId, id);
    return NextResponse.json({ tasks: onboarding.progresses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Not found" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "hr_onboarding", permissionKey: "hr:manage_onboarding" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = updateTaskSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const progress = await HROnboardingService.updateTaskProgress(
      session.activeRestaurantId,
      id,
      result.data.taskId,
      {
        status: result.data.status,
        notes: result.data.notes || undefined,
        fileUploadId: result.data.fileUploadId || undefined,
        responseValue: result.data.responseValue || undefined,
      }
    );
    return NextResponse.json({ success: true, progress });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
