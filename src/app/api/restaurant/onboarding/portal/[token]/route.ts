import { NextRequest, NextResponse } from "next/server";
import { HROnboardingService } from "@/modules/hr-onboarding/service";
import { z } from "zod";

const updateTaskSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(["PENDING", "COMPLETED", "WAIVED", "REJECTED"]),
  notes: z.string().nullish(),
  fileUploadId: z.string().nullish(),
  responseValue: z.string().nullish(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const session = await HROnboardingService.getSessionByToken(token);
    return NextResponse.json({ session });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Invalid or expired link" }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json();
    const result = updateTaskSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const progress = await HROnboardingService.updateTaskProgressByToken(
      token,
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
