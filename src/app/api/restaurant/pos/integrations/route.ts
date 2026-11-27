import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getIntegrationsList,
  connectPosIntegration,
  validateProviderCredentials,
} from "@/modules/pos-integrations/service";
import {
  assertPosOutletInScope,
  getPosActorContext,
} from "@/modules/pos-integrations/authHelper";
import { sanitizeProviderError } from "@/modules/pos-integrations/crypto";

const connectSchema = z.object({
  outletId: z.string().min(1),
  provider: z.enum(["TOAST", "SQUARE", "CLOVER"]),
  credentials: z.record(z.string(), z.any()),
  providerLocationId: z.string().optional(),
  providerLocationName: z.string().optional(),
  syncFrequency: z.enum(["5_MIN", "15_MIN", "30_MIN", "HOURLY", "MANUAL"]).optional(),
  isTestMode: z.boolean().optional(),
  action: z.enum(["VALIDATE", "CONNECT"]).optional(),
});

export async function GET() {
  try {
    const auth = await getPosActorContext({ requireView: true });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const integrations = await getIntegrationsList(
      auth.ctx.restaurantId,
      auth.ctx.accessibleOutletIds
    );
    return NextResponse.json({ success: true, integrations });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeProviderError(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = connectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid POS integration payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const auth = await getPosActorContext({
      requireManage: true,
      outletId: parsed.data.outletId,
    });
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const scope = assertPosOutletInScope(auth.ctx, parsed.data.outletId);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    if (parsed.data.action === "VALIDATE") {
      const validation = await validateProviderCredentials(
        parsed.data.provider,
        parsed.data.credentials
      );
      return NextResponse.json({ success: validation.valid, ...validation });
    }

    const integration = await connectPosIntegration({
      restaurantId: auth.ctx.restaurantId,
      outletId: parsed.data.outletId,
      provider: parsed.data.provider,
      credentials: parsed.data.credentials,
      providerLocationId: parsed.data.providerLocationId,
      providerLocationName: parsed.data.providerLocationName,
      syncFrequency: parsed.data.syncFrequency,
      isTestMode: parsed.data.isTestMode,
    });

    return NextResponse.json({ success: true, integration });
  } catch (error: any) {
    return NextResponse.json(
      { error: sanitizeProviderError(error) },
      { status: 400 }
    );
  }
}
