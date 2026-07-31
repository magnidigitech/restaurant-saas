import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getTenantSession } from "@/core/auth/session";
import { verifyAccess } from "@/core/permissions/check";
import { z } from "zod";

const createOutletSchema = z.object({
  name: z.string().min(2),
  address: z.string().optional(),
  timezone: z.string().default("UTC"),
  currency: z.string().default("USD"),
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

    const outlets = await prisma.restaurantOutlet.findMany({
      where: { restaurantId: session.activeRestaurantId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ outlets });
  } catch (error: any) {
    console.error("List Outlets Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getTenantSession();
    if (!session || !session.activeRestaurantId) {
      return NextResponse.json({ error: "Unauthorized tenant session" }, { status: 401 });
    }

    const restaurantId = session.activeRestaurantId!;

    const accessCheck = await verifyAccess(
      session.userId,
      restaurantId,
      {},
      session.tokenVersion
    );
    if (!accessCheck.authorized) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    const body = await req.json();
    const result = createOutletSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request payload", details: result.error.flatten() }, { status: 400 });
    }

    const data = result.data;

    const newOutlet = await prisma.$transaction(async (tx) => {
      // 1. Fetch active subscription plan limit
      const sub = await tx.restaurantSubscription.findFirst({
        where: { restaurantId, status: "ACTIVE" },
        include: { plan: true },
        orderBy: { startDate: "desc" },
      });

      const maxOutlets = sub?.plan.maxOutlets ?? 1;

      // 2. Count existing outlets
      const currentOutletCount = await tx.restaurantOutlet.count({
        where: { restaurantId },
      });

      if (currentOutletCount >= maxOutlets) {
        throw new Error(`Outlet limit reached (${maxOutlets}). Upgrade your subscription plan to add more outlets.`);
      }

      // 3. Create outlet
      const outlet = await tx.restaurantOutlet.create({
        data: {
          restaurantId,
          name: data.name,
          address: data.address,
          timezone: data.timezone,
          currency: data.currency,
        },
      });

      // 4. Write Audit Log
      await tx.auditLog.create({
        data: {
          restaurantId,
          userId: session.userId,
          userEmail: session.email,
          action: "OUTLET_CREATED",
          entityType: "RestaurantOutlet",
          entityId: outlet.id,
          newValues: JSON.stringify(data),
        },
      });

      return outlet;
    });

    return NextResponse.json({ success: true, outlet: newOutlet });
  } catch (error: any) {
    console.error("Create Outlet Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 400 });
  }
}
