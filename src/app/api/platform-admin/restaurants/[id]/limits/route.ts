import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/database/client";
import { getPlatformSession } from "@/core/auth/session";
import { z } from "zod";

const updateLimitsSchema = z.object({
  maxOutlets: z.number().int().min(1).optional(),
  maxEmployees: z.number().int().min(1).optional(),
  maxAdminUsers: z.number().int().min(1).optional(),
  storageQuotaGb: z.number().int().min(1).optional(),
});

// PATCH /api/platform-admin/restaurants/[id]/limits
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPlatformSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Unauthorized: Platform Super Admin privileges required" }, { status: 401 });
    }

    const { id: restaurantId } = await props.params;

    const body = await req.json();
    const result = updateLimitsSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid payload", details: result.error.flatten() }, { status: 400 });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        subscriptions: {
          include: { plan: true },
          take: 1,
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const activeSub = restaurant.subscriptions[0];
    if (!activeSub) {
      return NextResponse.json({ error: "No active subscription plan attached to this restaurant" }, { status: 400 });
    }

    // Update the subscription plan limits
    const updatedPlan = await prisma.subscriptionPlan.update({
      where: { id: activeSub.planId },
      data: {
        maxOutlets: result.data.maxOutlets ?? activeSub.plan.maxOutlets,
        maxEmployees: result.data.maxEmployees ?? activeSub.plan.maxEmployees,
        maxAdminUsers: result.data.maxAdminUsers ?? activeSub.plan.maxAdminUsers,
        storageQuotaGb: result.data.storageQuotaGb ?? activeSub.plan.storageQuotaGb,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        restaurantId,
        userId: session.userId,
        userEmail: session.email,
        action: "TENANT_LIMITS_UPDATED",
        entityType: "SubscriptionPlan",
        entityId: updatedPlan.id,
        previousValues: JSON.stringify({
          maxOutlets: activeSub.plan.maxOutlets,
          maxEmployees: activeSub.plan.maxEmployees,
          maxAdminUsers: activeSub.plan.maxAdminUsers,
          storageQuotaGb: activeSub.plan.storageQuotaGb,
        }),
        newValues: JSON.stringify(result.data),
      },
    });

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
    });
  } catch (error: any) {
    console.error("Update Limits Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
