import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/core/database/client";
import { EmploymentStatus, WorkerType } from "@prisma/client";
import { getWorkforceActorContext } from "@/modules/workforce/authHelper";
import {
  assertEmployeeInScope,
  previewSchedulingImpact,
  SCHEDULING_BLOCKED_STATUSES,
  transitionEmploymentRecord,
  WorkforceError,
} from "@/modules/workforce/service";

const employmentRecordSchema = z.object({
  departmentId: z.string().optional().nullable(),
  designationId: z.string().optional().nullable(),
  primaryOutletId: z.string().optional().nullable(),
  employmentType: z.nativeEnum(WorkerType).optional(),
  workerType: z.nativeEnum(WorkerType).optional(),
  effectiveFrom: z.string().min(1, "Effective date is required"),
  probationEndDate: z.string().optional().nullable(),
  confirmationDate: z.string().optional().nullable(),
  noticePeriod: z.number().int().min(0).optional().nullable(),
  status: z.nativeEnum(EmploymentStatus).default("ACTIVE"),
  notes: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  weeklyHoursLimit: z.number().min(1).max(168).optional().nullable(),
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

    const records = await prisma.employmentRecord.findMany({
      where: { employeeId: id, restaurantId: auth.ctx.restaurantId },
      include: {
        department: true,
        designation: true,
        primaryOutlet: true,
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ records });
  } catch (error) {
    if (error instanceof WorkforceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get Employment Records Error:", error);
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
    const parsed = employmentRecordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const effectiveFrom = new Date(data.effectiveFrom);

    if (data.preview) {
      await assertEmployeeInScope(auth.ctx, id);
      const isBlocking = SCHEDULING_BLOCKED_STATUSES.includes(data.status);
      const latest = await prisma.employmentRecord.findFirst({
        where: { employeeId: id },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        select: { primaryOutletId: true },
      });
      const primaryChanged =
        Boolean(data.primaryOutletId) &&
        latest?.primaryOutletId &&
        data.primaryOutletId !== latest.primaryOutletId;

      if (!isBlocking && !primaryChanged) {
        return NextResponse.json({
          preview: true,
          count: 0,
          requiresResolution: false,
          affectedShifts: [],
        });
      }

      const impact = await previewSchedulingImpact({
        restaurantId: auth.ctx.restaurantId,
        employeeId: id,
        effectiveDate: effectiveFrom,
        outletId: !isBlocking && primaryChanged ? latest!.primaryOutletId! : undefined,
      });

      return NextResponse.json({ preview: true, ...impact });
    }

    const res = await transitionEmploymentRecord(auth.ctx, id, {
      status: data.status,
      workerType: data.workerType || data.employmentType || "FULL_TIME",
      effectiveFrom,
      departmentId: data.departmentId,
      designationId: data.designationId,
      primaryOutletId: data.primaryOutletId,
      probationEndDate: data.probationEndDate
        ? new Date(data.probationEndDate)
        : null,
      confirmationDate: data.confirmationDate
        ? new Date(data.confirmationDate)
        : null,
      noticePeriod: data.noticePeriod,
      reason: data.reason ?? data.notes,
      weeklyHoursLimit: data.weeklyHoursLimit,
      resolution: data.resolution,
    });

    return NextResponse.json(
      {
        success: true,
        record: res.record,
        cancelledShiftsCount: res.cancelledShiftsCount,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof WorkforceError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    console.error("Transition Employment Record Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
