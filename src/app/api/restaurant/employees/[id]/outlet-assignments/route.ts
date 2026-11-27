import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/core/database/client";
import { AssignmentType } from "@prisma/client";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import {
  assertEmployeeInScope,
  endOutletAssignment,
  previewSchedulingImpact,
  upsertOutletAssignment,
  WorkforceError,
} from "@/modules/workforce/service";

const outletAssignmentSchema = z.object({
  outletId: z.string().min(1, "Outlet ID is required"),
  isPrimary: z.boolean().default(false),
  assignmentType: z.nativeEnum(AssignmentType).default("TEMPORARY"),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

const endAssignmentSchema = z.object({
  outletId: z.string().min(1, "Outlet ID is required"),
  effectiveTo: z.string().min(1, "Effective end date is required"),
  reason: z.string().optional().nullable(),
  preview: z.boolean().optional(),
  resolution: z.enum(["CANCEL_SHIFTS", "KEEP_SHIFTS"]).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getWorkforceActorContext();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    await assertEmployeeInScope(auth.ctx, id);

    const assignments = await prisma.employeeOutletAssignment.findMany({
      where: { employeeId: id, restaurantId: auth.ctx.restaurantId },
      include: {
        outlet: { select: { id: true, name: true, timezone: true } },
      },
      orderBy: [{ isPrimary: "desc" }, { effectiveFrom: "desc" }],
    });

    return NextResponse.json({ assignments });
  } catch (error) {
    if (error instanceof WorkforceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get Outlet Assignments Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getWorkforceActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = outletAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const assignment = await upsertOutletAssignment(auth.ctx, id, {
      outletId: data.outletId,
      isPrimary: data.isPrimary,
      assignmentType: data.assignmentType,
      effectiveFrom: data.effectiveFrom
        ? new Date(data.effectiveFrom)
        : new Date(),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      reason: data.reason,
    });

    return NextResponse.json({ success: true, assignment }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkforceError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    console.error("Upsert Outlet Assignment Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getWorkforceActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = endAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const effectiveTo = new Date(data.effectiveTo);

    if (data.preview) {
      await assertEmployeeInScope(auth.ctx, id);
      const impact = await previewSchedulingImpact({
        restaurantId: auth.ctx.restaurantId,
        employeeId: id,
        effectiveDate: effectiveTo,
        outletId: data.outletId,
      });
      return NextResponse.json({ preview: true, ...impact });
    }

    const res = await endOutletAssignment(auth.ctx, id, {
      outletId: data.outletId,
      effectiveTo,
      reason: data.reason,
      resolution: data.resolution,
    });

    return NextResponse.json({
      success: true,
      assignment: res.assignment,
      cancelledShiftsCount: res.cancelledShiftsCount,
    });
  } catch (error) {
    if (error instanceof WorkforceError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    console.error("End Outlet Assignment Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
