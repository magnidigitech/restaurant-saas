import { NextRequest, NextResponse } from "next/server";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import {
  getCateringOrderById,
  updateCateringOrder,
  deleteCateringOrder,
} from "@/modules/catering/service";

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
    const order = await getCateringOrderById(session.activeRestaurantId, id);

    if (!order) {
      return NextResponse.json({ error: "Catering order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
      { moduleKey: "catering", permissionKey: "catering:manage_orders" },
      session.tokenVersion
    );
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { id } = await params;
    const body = await req.json();

    const order = await updateCateringOrder(session.activeRestaurantId, id, body);
    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
  }
}

export async function DELETE(
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
      { moduleKey: "catering", permissionKey: "catering:manage_orders" },
      session.tokenVersion
    );
    if (!access.authorized) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { id } = await params;
    await deleteCateringOrder(session.activeRestaurantId, id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 400 }
    );
  }
}
