import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { ChecklistService } from "@/modules/operations/checklistService";
import { z } from "zod";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["OPENING", "CLOSING", "MID_DAY", "FOOD_SAFETY", "WEEKLY_MAINTENANCE", "CUSTOM"]).default("OPENING"),
  departmentId: z.string().uuid().optional(),
  description: z.string().optional(),
  estimatedMinutes: z.number().int().min(1).default(20),
  items: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      roleRequired: z.string().optional(),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
      requiresValueInput: z.boolean().default(false),
      valueInputLabel: z.string().optional(),
      requiresPhoto: z.boolean().default(false),
    })
  ).min(1),
});

export async function GET() {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const templates = await ChecklistService.getTemplates(session.activeRestaurantId);
    return NextResponse.json({ success: true, templates });
  } catch (error: any) {
    console.error("Get Checklist Templates Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = createTemplateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const template = await ChecklistService.createTemplate(session.activeRestaurantId, result.data);
    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    console.error("Create Template Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create template" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const { action, templateId } = body;

    if (!templateId) {
      return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
    }

    if (action === "DUPLICATE") {
      const duplicated = await ChecklistService.duplicateTemplate(templateId, session.activeRestaurantId);
      return NextResponse.json({ success: true, template: duplicated });
    }

    if (action === "UPDATE") {
      const result = createTemplateSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
      }

      const updated = await ChecklistService.updateTemplate(templateId, session.activeRestaurantId, result.data);
      return NextResponse.json({ success: true, template: updated });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Update/Duplicate Template Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const accessCheck = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get("id");

    if (!templateId) {
      return NextResponse.json({ error: "Missing template id" }, { status: 400 });
    }

    await ChecklistService.deleteTemplate(templateId, session.activeRestaurantId);
    return NextResponse.json({ success: true, message: "Template deleted successfully" });
  } catch (error: any) {
    console.error("Delete Template Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete template" }, { status: 500 });
  }
}
