import { NextRequest, NextResponse } from "next/server";
import { getPayrollActorContext } from "@/modules/payroll/authHelper";
import { TipPoolService, TipPoolError } from "@/modules/payroll/tipPoolService";
import { z } from "zod";

const tipPoolActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["PREVIEW", "SAVE", "FINALIZE"]),
    outletId: z.string().uuid(),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    ruleId: z.string().uuid().optional(),
    adjustmentsAmount: z.number().optional(),
    fohPercentage: z.number().min(0).max(100).optional(),
    bohPercentage: z.number().min(0).max(100).optional(),
    distributionMethod: z
      .enum(["HOURS_WORKED", "EQUAL_SPLIT", "ROLE_POINT_SYSTEM"])
      .optional(),
    rolePoints: z.record(z.string(), z.number()).optional(),
    includeCashTips: z.boolean().optional(),
    includeCardTips: z.boolean().optional(),
    includeServiceCharges: z.boolean().optional(),
    deductRefunds: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("FINALIZE_RUN"),
    tipPoolRunId: z.string().uuid(),
  }),
]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get("outletId") || undefined;

    const auth = await getPayrollActorContext({ requireView: true, outletId });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const [runs, rules] = await Promise.all([
      TipPoolService.getRuns(auth.ctx.restaurantId, {
        outletId,
        accessibleOutletIds: auth.ctx.accessibleOutletIds,
      }),
      TipPoolService.getRules(auth.ctx.restaurantId, outletId),
    ]);

    return NextResponse.json({ success: true, runs, rules });
  } catch (error: any) {
    const status = error instanceof TipPoolError ? error.status : 500;
    return NextResponse.json(
      { error: error.message || "Failed to load tip pool runs" },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Backward-compatible default action if omitted
    const normalizedBody = body.action ? body : { ...body, action: "PREVIEW" };
    const parsed = tipPoolActionSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid tip pool payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    if (payload.action === "FINALIZE_RUN") {
      const auth = await getPayrollActorContext({ requireRun: true });
      if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
      const existing = (await TipPoolService.getRuns(auth.ctx.restaurantId)).find(
        (r) => r.id === payload.tipPoolRunId
      );
      if (!existing) {
        return NextResponse.json({ error: "Tip pool run not found" }, { status: 404 });
      }
      if (
        auth.ctx.accessibleOutletIds !== null &&
        (!existing.outletId || !auth.ctx.accessibleOutletIds.includes(existing.outletId))
      ) {
        return NextResponse.json(
          { error: "Outlet is outside your authorized scope" },
          { status: 403 }
        );
      }

      const result = await TipPoolService.finalizeExistingRun(
        auth.ctx.restaurantId,
        payload.tipPoolRunId,
        auth.ctx.userId,
        auth.ctx.userEmail
      );
      return NextResponse.json({ success: true, ...result });
    }

    const auth = await getPayrollActorContext({
      requireRun: payload.action !== "PREVIEW",
      requireView: true,
      outletId: payload.outletId,
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (payload.action === "PREVIEW") {
      const preview = await TipPoolService.previewTipPool(auth.ctx.restaurantId, payload);
      return NextResponse.json({ success: true, preview });
    }

    const saved = await TipPoolService.saveOrFinalizeRun(auth.ctx.restaurantId, {
      ...payload,
      finalize: payload.action === "FINALIZE",
      actorUserId: auth.ctx.userId,
      actorEmail: auth.ctx.userEmail,
    });
    return NextResponse.json({ success: true, ...saved });
  } catch (error: any) {
    const status = error instanceof TipPoolError ? error.status : 500;
    return NextResponse.json(
      { error: error.message || "Tip pool calculation failed", code: error.code },
      { status }
    );
  }
}
