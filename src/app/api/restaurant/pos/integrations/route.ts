import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import {
  getIntegrationsList,
  connectPosIntegration,
  validateProviderCredentials,
} from "@/modules/pos-integrations/service";
import { PosProviderType, PosEnvironmentType } from "@/modules/pos-integrations/types";
import { z } from "zod";

const connectSchema = z.object({
  provider: z.enum(["TOAST", "SQUARE", "CLOVER"]),
  outletId: z.string().min(1),
  environment: z.enum(["PRODUCTION", "SANDBOX"]).default("SANDBOX"),
  credentials: z.record(z.string(), z.any()),
  providerLocationId: z.string().optional(),
  providerLocationName: z.string().optional(),
  importPeriodDays: z.number().int().min(1).max(365).optional(),
});

const validateSchema = z.object({
  provider: z.enum(["TOAST", "SQUARE", "CLOVER"]),
  environment: z.enum(["PRODUCTION", "SANDBOX"]).default("SANDBOX"),
  credentials: z.record(z.string(), z.any()),
});

export async function GET(req: NextRequest) {
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

    const integrations = await getIntegrationsList(session.activeRestaurantId);
    return NextResponse.json({ success: true, integrations });
  } catch (error: any) {
    console.error("List POS Integrations Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load integrations" }, { status: 500 });
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
      { requiredRoles: ["OWNER", "MANAGER", "ADMIN"] },
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const url = new URL(req.url);

    // If query ?validateOnly=true, validate credentials only
    if (url.searchParams.get("validateOnly") === "true") {
      const parsed = validateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid credentials format", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const valResult = await validateProviderCredentials(
        parsed.data.provider as PosProviderType,
        { ...parsed.data.credentials, environment: parsed.data.environment as PosEnvironmentType }
      );
      return NextResponse.json({ success: valResult.valid, result: valResult });
    }

    const parsed = connectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid connection payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await connectPosIntegration(session.activeRestaurantId, {
      provider: parsed.data.provider as PosProviderType,
      outletId: parsed.data.outletId,
      environment: parsed.data.environment as PosEnvironmentType,
      credentials: {
        ...parsed.data.credentials,
        environment: parsed.data.environment as PosEnvironmentType,
      },
      providerLocationId: parsed.data.providerLocationId,
      providerLocationName: parsed.data.providerLocationName,
      importPeriodDays: parsed.data.importPeriodDays,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Connect POS Integration Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to establish POS integration" },
      { status: 400 }
    );
  }
}
