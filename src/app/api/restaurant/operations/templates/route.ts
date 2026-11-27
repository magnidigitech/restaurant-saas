import { NextRequest, NextResponse } from "next/server";
import { ChecklistService, ChecklistError } from "@/modules/operations/checklistService";
import { getOperationsActorContext } from "@/modules/operations/authHelper";
import { z } from "zod";

const itemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  sectionName: z.string().optional(),
  roleRequired: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  isRequired: z.boolean().default(true),
  requiresValueInput: z.boolean().default(false),
  valueInputLabel: z.string().optional(),
  minValue: z.number().nullable().optional(),
  maxValue: z.number().nullable().optional(),
  unit: z.string().optional(),
  requiresPhoto: z.boolean().default(false),
});

const createTemplateSchema = z.object({
  name: z.string().min(1),
  type: z
    .enum(["OPENING", "CLOSING", "MID_DAY", "FOOD_SAFETY", "WEEKLY_MAINTENANCE", "CUSTOM"])
    .default("OPENING"),
  departmentId: z.string().uuid().optional(),
  description: z.string().optional(),
  estimatedMinutes: z.number().int().min(1).default(20),
  items: z.array(itemSchema).min(1),
});

export async function GET() {
  try {
    const auth = await getOperationsActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const templates = await ChecklistService.getTemplates(auth.ctx.restaurantId);
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    const status = error instanceof ChecklistError ? error.status : 500;
    return NextResponse.json(
      { error: error.message || "Failed to load templates" },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getOperationsActorContext({ requireManage: true });
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

    const template = await ChecklistService.createTemplate(
      auth.ctx.restaurantId,
      result.data
    );
    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    const status = error instanceof ChecklistError ? error.status : 500;
    return NextResponse.json(
      { error: error.message || "Failed to create template" },
      { status }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getOperationsActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const { action, templateId } = body;

    if (!templateId) {
      return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
    }

    if (action === "DUPLICATE") {
      const duplicated = await ChecklistService.duplicateTemplate(
        templateId,
        auth.ctx.restaurantId
      );
      return NextResponse.json({ success: true, template: duplicated });
    }

    if (action === "UPDATE") {
      const result = createTemplateSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json(
          { error: "Invalid payload", details: result.error.flatten() },
          { status: 400 }
        );
      }

      const updated = await ChecklistService.updateTemplate(
        templateId,
        auth.ctx.restaurantId,
        result.data
      );
      return NextResponse.json({ success: true, template: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    const status = error instanceof ChecklistError ? error.status : 500;
    return NextResponse.json(
      { error: error.message || "Failed to update template" },
      { status }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await getOperationsActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("id");
    if (!templateId) {
      return NextResponse.json({ error: "Missing template id" }, { status: 400 });
    }

    await ChecklistService.deleteTemplate(templateId, auth.ctx.restaurantId);
    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error: any) {
    const status = error instanceof ChecklistError ? error.status : 500;
    return NextResponse.json(
      { error: error.message || "Failed to delete template" },
      { status }
    );
  }
}
