import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { calculateEventIngredients } from "@/modules/catering/service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      { moduleKey: "catering", permissionKey: "catering:view" },
      session.tokenVersion
    );
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { id } = await params;
    const ingredientReport = await calculateEventIngredients(
      session.activeRestaurantId,
      id
    );

    return NextResponse.json({ success: true, report: ingredientReport });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
  }
}
