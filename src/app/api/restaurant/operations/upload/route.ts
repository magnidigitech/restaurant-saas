import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/core/database/client";
import { getOperationsActorContext } from "@/modules/operations/authHelper";

const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const auth = await getOperationsActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { ctx } = auth;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const executionId = formData.get("executionId") as string | null;

    if (!file || !executionId) {
      return NextResponse.json(
        { error: "file and executionId are required" },
        { status: 400 }
      );
    }

    const execution = await prisma.shiftChecklistExecution.findFirst({
      where: { id: executionId, restaurantId: ctx.restaurantId },
      select: { id: true, outletId: true, assignedEmployeeId: true, status: true },
    });
    if (!execution) {
      return NextResponse.json({ error: "Checklist execution not found" }, { status: 404 });
    }
    if (execution.status === "VERIFIED") {
      return NextResponse.json(
        { error: "Checklist is already verified and locked" },
        { status: 409 }
      );
    }

    const isAssignee = Boolean(
      ctx.employeeId && execution.assignedEmployeeId === ctx.employeeId
    );
    const isScopedManager =
      ctx.canManageOperations &&
      (ctx.accessibleOutletIds === null ||
        ctx.accessibleOutletIds.includes(execution.outletId));

    if (!isAssignee && !isScopedManager) {
      return NextResponse.json(
        { error: "You are not permitted to upload photos to this checklist" },
        { status: 403 }
      );
    }

    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Only PNG, JPG, and WebP images are supported" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Photo exceeds 5 MB limit" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = `${randomUUID()}.${ext}`;
    const dir = join(
      process.cwd(),
      "public",
      "uploads",
      ctx.restaurantId,
      "checklists",
      executionId
    );
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, fileName), buffer);

    const url = `/api/uploads/${ctx.restaurantId}/checklists/${executionId}/${fileName}`;
    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    console.error("Checklist photo upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload photo" },
      { status: 500 }
    );
  }
}
