import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { MasterDataService } from "@/modules/master-data/service";
import { z } from "zod";

const createCostCenterSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
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

    const costCenters = await MasterDataService.getCostCenters(session.activeRestaurantId);
    return NextResponse.json({ costCenters });
  } catch (error: any) {
    console.error("List Cost Centers Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = createCostCenterSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const costCenter = await MasterDataService.createCostCenter(
      session.activeRestaurantId,
      result.data
    );

    return NextResponse.json({ success: true, costCenter });
  } catch (error: any) {
    console.error("Create Cost Center Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
