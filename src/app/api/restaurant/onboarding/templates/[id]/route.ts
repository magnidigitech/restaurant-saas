import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { HROnboardingService } from "@/modules/hr-onboarding/service";
import { z } from "zod";

const updateTemplateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const addTaskSchema = z.object({
  action: z.literal("add_task"),
  title: z.string().min(1),
  description: z.string().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().optional(),
  requiresDoc: z.boolean().optional(),
  taskType: z.enum(["CHECKBOX", "DOCUMENT", "FORM_INPUT", "SIGNATURE", "DATE"]).optional(),
  fieldConfig: z.string().optional(),
});

const updateTaskSchema = z.object({
  action: z.literal("update_task"),
  taskId: z.string(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  isRequired: z.boolean().optional(),
  sortOrder: z.number().optional(),
  requiresDoc: z.boolean().optional(),
  taskType: z.enum(["CHECKBOX", "DOCUMENT", "FORM_INPUT", "SIGNATURE", "DATE"]).optional(),
  fieldConfig: z.string().optional(),
});

const deleteTaskSchema = z.object({
  action: z.literal("delete_task"),
  taskId: z.string(),
});

const reorderTasksSchema = z.object({
  action: z.literal("reorder_tasks"),
  orderedTaskIds: z.array(z.string()),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "hr_onboarding", permissionKey: "hr:view_employees" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    const template = await HROnboardingService.getTemplateById(session.activeRestaurantId, id);
    return NextResponse.json({ template });
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

    if (body.action === "add_task") {
      const result = addTaskSchema.safeParse(body);
      if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
      await HROnboardingService.addTask(session.activeRestaurantId, id, result.data);
      const updatedTemplate = await HROnboardingService.getTemplateById(session.activeRestaurantId, id);
      return NextResponse.json({ success: true, template: updatedTemplate });
    }

    if (body.action === "update_task") {
      const result = updateTaskSchema.safeParse(body);
      if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
      await HROnboardingService.updateTask(session.activeRestaurantId, result.data.taskId, result.data);
      const updatedTemplate = await HROnboardingService.getTemplateById(session.activeRestaurantId, id);
      return NextResponse.json({ success: true, template: updatedTemplate });
    }

    if (body.action === "delete_task") {
      const result = deleteTaskSchema.safeParse(body);
      if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
      await HROnboardingService.deleteTask(session.activeRestaurantId, result.data.taskId);
      const updatedTemplate = await HROnboardingService.getTemplateById(session.activeRestaurantId, id);
      return NextResponse.json({ success: true, template: updatedTemplate });
    }

    if (body.action === "reorder_tasks") {
      const result = reorderTasksSchema.safeParse(body);
      if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
      await HROnboardingService.reorderTasks(session.activeRestaurantId, id, result.data.orderedTaskIds);
      const updatedTemplate = await HROnboardingService.getTemplateById(session.activeRestaurantId, id);
      return NextResponse.json({ success: true, template: updatedTemplate });
    }

    // Plain template update
    const result = updateTemplateSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    await HROnboardingService.updateTemplate(session.activeRestaurantId, id, result.data);
    const updatedTemplate = await HROnboardingService.getTemplateById(session.activeRestaurantId, id);
    return NextResponse.json({ success: true, template: updatedTemplate });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const access = await verifyAccess(session.userId, session.activeRestaurantId, { moduleKey: "hr_onboarding", permissionKey: "hr:manage_onboarding" }, session.tokenVersion);
    if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

    await HROnboardingService.archiveTemplate(session.activeRestaurantId, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
