import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/core/database/client";
import { disconnectIntegration } from "@/modules/pos-integrations/service";
import {
  assertPosOutletInScope,
  getPosActorContext,
} from "@/modules/pos-integrations/authHelper";
import { sanitizeProviderError } from "@/modules/pos-integrations/crypto";

const patchSchema = z.object({
  status: z.enum(["ACTIVE", "NEEDS_REAUTH", "DISCONNECTED", "ERROR"]).optional(),
  providerLocationId: z.string().nullable().optional(),
  providerLocationName: z.string().nullable().optional(),
  environment: z.enum(["SANDBOX", "PRODUCTION"]).optional(),
  syncFrequency: z.enum(["5_MIN", "15_MIN", "30_MIN", "HOURLY", "MANUAL"]).optional(),
  stockPostingEnabled: z.boolean().optional(),
  stockPostingEffectiveFrom: z.string().datetime().nullable().optional(),
});

export async function DELETE(
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
    });
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const scope = assertPosOutletInScope(auth.ctx, integration.outletId);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") === "DELETE" ? "DELETE" : "DEACTIVATE";
    const result = await disconnectIntegration(auth.ctx.restaurantId, id, action);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeProviderError(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getPosActorContext({ requireManage: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const integration = await prisma.posIntegration.findFirst({
      where: { id, restaurantId: auth.ctx.restaurantId },
    });
    if (!integration) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const scope = assertPosOutletInScope(auth.ctx, integration.outletId);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const nextEffectiveFrom =
      parsed.data.stockPostingEnabled === true
        ? parsed.data.stockPostingEffectiveFrom
          ? new Date(parsed.data.stockPostingEffectiveFrom)
          : integration.stockPostingEffectiveFrom || new Date()
        : parsed.data.stockPostingEffectiveFrom !== undefined
          ? parsed.data.stockPostingEffectiveFrom
            ? new Date(parsed.data.stockPostingEffectiveFrom)
            : null
          : undefined;

    const updated = await prisma.posIntegration.update({
      where: { id },
      data: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.providerLocationId !== undefined
          ? { providerLocationId: parsed.data.providerLocationId }
          : {}),
        ...(parsed.data.providerLocationName !== undefined
          ? { providerLocationName: parsed.data.providerLocationName }
          : {}),
        ...(parsed.data.environment !== undefined
          ? { environment: parsed.data.environment, isTestMode: parsed.data.environment === "SANDBOX" }
          : {}),
        ...(parsed.data.syncFrequency !== undefined
          ? { syncFrequency: parsed.data.syncFrequency }
          : {}),
        ...(parsed.data.stockPostingEnabled !== undefined
          ? { stockPostingEnabled: parsed.data.stockPostingEnabled }
          : {}),
        ...(nextEffectiveFrom !== undefined
          ? { stockPostingEffectiveFrom: nextEffectiveFrom }
          : {}),
      },
      select: {
        id: true,
        restaurantId: true,
        outletId: true,
        provider: true,
        providerLocationId: true,
        providerLocationName: true,
        status: true,
        environment: true,
        syncFrequency: true,
        stockPostingEnabled: true,
        stockPostingEffectiveFrom: true,
        lastSyncAt: true,
        lastSuccessfulSyncAt: true,
        lastSyncStatus: true,
      },
    });

    return NextResponse.json({ success: true, integration: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeProviderError(error) },
      { status: 500 }
    );
  }
}
