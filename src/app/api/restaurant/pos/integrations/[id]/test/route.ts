import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { testIntegrationConnection } from "@/modules/pos-integrations/service";
import {
  assertPosOutletInScope,
  getPosActorContext,
} from "@/modules/pos-integrations/authHelper";
import { sanitizeProviderError } from "@/modules/pos-integrations/crypto";

export async function POST(
  _req: NextRequest,
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

    const result = await testIntegrationConnection(auth.ctx.restaurantId, id);
    return NextResponse.json({ success: result.valid, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeProviderError(error) },
      { status: 400 }
    );
  }
}
