import { NextRequest, NextResponse } from "next/server";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import { HROnboardingService } from "@/modules/hr-onboarding/service";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  roleName: z.string().optional(),
  isDefault: z.boolean().optional(),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        isRequired: z.boolean().optional(),
        sortOrder: z.number().optional(),
        requiresDoc: z.boolean().optional(),
        taskType: z
          .enum(["CHECKBOX", "DOCUMENT", "FORM_INPUT", "SIGNATURE", "DATE"])
          .optional(),
        fieldConfig: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET() {
  try {
    const auth = await getWorkforceActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const templates = await HROnboardingService.getTemplates(
      auth.ctx.restaurantId
    );
    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error("GET Templates Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getWorkforceActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const result = createTemplateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const template = await HROnboardingService.createTemplate(
      auth.ctx.restaurantId,
      result.data
    );
    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    console.error("POST Template Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
  }
}
