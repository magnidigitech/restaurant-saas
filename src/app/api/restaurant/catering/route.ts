import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import {
  listCateringOrders,
  createCateringOrder,
  getCateringRecipes,
  listCateringPackages,
} from "@/modules/catering/service";

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;

    const [data, recipes, packages] = await Promise.all([
      listCateringOrders(session.activeRestaurantId, { search, status }),
      getCateringRecipes(session.activeRestaurantId),
      listCateringPackages(session.activeRestaurantId),
    ]);

    return NextResponse.json({
      orders: data.orders,
      metrics: data.metrics,
      recipes,
      packages,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await verifyAccess(
      session.userId,
      session.activeRestaurantId,
      { moduleKey: "catering", permissionKey: "catering:manage_orders" },
      session.tokenVersion
    );
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await req.json();
    if (!body.eventName || !body.clientName || !body.eventDate) {
      return NextResponse.json(
        { error: "Event Name, Client Name, and Event Date are required." },
        { status: 400 }
      );
    }

    const order = await createCateringOrder(session.activeRestaurantId, body);
    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
  }
}
