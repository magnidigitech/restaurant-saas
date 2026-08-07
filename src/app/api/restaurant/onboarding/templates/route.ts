import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { HROnboardingService } from "@/modules/hr-onboarding/service";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  tasks: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    isRequired: z.boolean().optional(),
    sortOrder: z.number().optional(),
    requiresDoc: z.boolean().optional(),
  })).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "hr_onboarding", permissionKey: "hr:view_employees" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const templates = await HROnboardingService.getTemplates(session.activeRestaurantId);
    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error("GET Templates Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "hr_onboarding", permissionKey: "hr:manage_onboarding" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const body = await req.json();
    const result = createTemplateSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });

    const template = await HROnboardingService.createTemplate(session.activeRestaurantId, result.data);
    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    console.error("POST Template Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
