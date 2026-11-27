import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { executeSync } from "@/modules/pos-integrations/service";
import {
  assertPosOutletInScope,
  getPosActorContext,
} from "@/modules/pos-integrations/authHelper";
import { sanitizeProviderError } from "@/modules/pos-integrations/crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getPosActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const integration = await prisma.posIntegration.findFirst({
      where: { id, restaurantId: auth.ctx.restaurantId },
      select: { id: true, outletId: true },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const scope = assertPosOutletInScope(auth.ctx, integration.outletId);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const body = await req.json().catch(() => ({}));
    const runType =
      body.mode === "BACKFILL"
        ? "BACKFILL"
        : body.mode === "INCREMENTAL"
          ? "INCREMENTAL"
          : "MANUAL";

    const result = await executeSync(auth.ctx.restaurantId, id, {
      runType,
      since: body.since ? new Date(body.since) : undefined,
      until: body.until ? new Date(body.until) : undefined,
      maxPages: body.maxPages ? Number(body.maxPages) : undefined,
      userId: auth.ctx.userId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const msg = sanitizeProviderError(error);
    const status = msg.includes("already running") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
